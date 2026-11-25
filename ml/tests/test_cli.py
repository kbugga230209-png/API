import contextlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from bharatbite_ml import cli
from bharatbite_ml.dataset import sha256_file
from bharatbite_ml.export_manifest import verify_signed_manifest

SECRET_HEX = "11" * 32


def run_cli(*argv: str) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = cli.main(list(argv))
    return code, out.getvalue(), err.getvalue()


class CliTests(unittest.TestCase):
    def test_selftest_passes(self):
        code, out, _ = run_cli("selftest")
        payload = json.loads(out)
        self.assertEqual(code, 0)
        self.assertTrue(payload["labelsValid"])
        self.assertEqual(payload["classes"], 50)

    def test_validate_labels_clean(self):
        code, out, _ = run_cli("validate-labels")
        payload = json.loads(out)
        self.assertEqual(code, 0)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["missingVariants"], [])

    def test_benchmark_without_results_is_a_failure_not_a_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "results.json"
            code, _, err = run_cli("benchmark", "--results", str(missing))
            self.assertEqual(code, 1)
            self.assertIn("no evaluation has been run", err)

    def test_new_key_prints_public_key(self):
        code, out, _ = run_cli("new-key")
        self.assertEqual(code, 0)
        self.assertIn("private key", out)
        self.assertIn("public key", out)

    def test_manifest_refuses_without_signing_key(self):
        with mock.patch.dict(os.environ, {cli.SIGNING_ENV: ""}):
            code, _, err = run_cli(
                "manifest",
                "--artifact", "x.tflite",
                "--results", "results.json",
                "--out", "out",
                "--model-id", "m",
                "--version", "1.0.0",
                "--architecture", "efficientnet_lite0_int8",
                "--file-url", "https://example.org/m.tflite",
                "--released-at", "2026-12-01T00:00:00Z",
            )
        self.assertEqual(code, 2)
        self.assertIn("refusing to sign", err)

    def test_infer_from_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "detections.json"
            path.write_text(json.dumps({"detections": [{"label": "thepla", "confidence": 0.95}]}))
            code, out, _ = run_cli("infer", "--detections", str(path))
        payload = json.loads(out)
        self.assertEqual(code, 0)
        self.assertFalse(payload["abstained"])
        self.assertEqual(payload["items"][0]["catalogSlug"], "thepla")


class EndToEndSigningTests(unittest.TestCase):
    """Full chain: image tree -> manifest -> validate -> results -> signed manifest -> verify."""

    def test_tree_to_signed_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "images"
            labels = ["thepla", "idli", "poha"]
            for label in labels:
                folder = root / label
                folder.mkdir(parents=True)
                for index in range(8):
                    (folder / f"{index:02d}.jpg").write_bytes(f"{label}-{index}".encode() * 4)

            manifest_path = Path(tmp) / "manifest.json"
            code, out, _ = run_cli(
                "manifest-from-dir",
                "--root", str(root),
                "--out", str(manifest_path),
                "--license", "CC-BY-4.0",
                "--source-url", "https://example.org/corpus",
                "--attribution", "Example Corpus contributors",
            )
            # The tree only covers 3 of the 50 classes, so the tool reports that
            # honestly instead of claiming a complete dataset.
            payload = json.loads(out)
            self.assertEqual(code, 1)
            self.assertTrue(any("no images yet" in problem for problem in payload["problems"]))
            self.assertFalse(manifest_path.exists())

            # With an explicit class scope it can still produce a usable manifest.
            manifest, problems = __import__(
                "bharatbite_ml.manifest_tool", fromlist=["build_manifest_from_directory"]
            ).build_manifest_from_directory(
                root,
                "CC-BY-4.0",
                "https://example.org/corpus",
                "Example Corpus contributors",
                classes=labels,
            )
            self.assertEqual(problems, [])
            self.assertEqual(len(manifest["images"]), 24)
            for image in manifest["images"]:
                self.assertIn(image["split"], {"train", "val", "test"})
                self.assertEqual(sha256_file(root / image["path"]), image["sha256"])
            manifest_path.write_text(json.dumps(manifest))

            code, out, _ = run_cli(
                "validate-dataset", "--manifest", str(manifest_path), "--root", str(root)
            )
            report = json.loads(out)
            # 8 images per class cannot meet the 40-image minimum: the gate says no.
            self.assertEqual(code, 1)
            self.assertTrue(any("class_too_small" in e["code"] for e in report["errors"]))

            artifact = Path(tmp) / "model.tflite"
            artifact.write_bytes(b"TFL3" + b"w" * 500)
            sha = sha256_file(artifact)
            results = Path(tmp) / "results.json"
            results.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "evaluatedOn": {"corpus": "inference-corpus-v1", "split": "test", "images": 3000},
                        "device": "Pixel 6a",
                        "models": [
                            {
                                "architecture": "efficientnet_lite0_int8",
                                "format": "tflite",
                                "trained": True,
                                "sizeBytes": artifact.stat().st_size,
                                "top1": 0.8,
                                "top5": 0.94,
                                "latencyP50Ms": 40.0,
                                "latencyP95Ms": 61.0,
                                "artifactSha256": sha,
                            }
                        ],
                    }
                )
            )
            out_dir = Path(tmp) / "signed"
            with mock.patch.dict(os.environ, {cli.SIGNING_ENV: SECRET_HEX}):
                code, out, err = run_cli(
                    "manifest",
                    "--artifact", str(artifact),
                    "--results", str(results),
                    "--out", str(out_dir),
                    "--model-id", "bharatbite-indian-food",
                    "--version", "0.1.0",
                    "--architecture", "efficientnet_lite0_int8",
                    "--file-url", "https://cdn.bharatbite.app/models/m.tflite",
                    "--released-at", "2026-12-01T00:00:00Z",
                    "--channel", "dev",
                )
            self.assertEqual(code, 0, err)
            signed_payload = json.loads(out)
            self.assertTrue(signed_payload["selfCheck"])
            manifest_json = json.loads((out_dir / "model-manifest.json").read_text())
            public_key = (out_dir / "model-manifest.public-key.txt").read_text().strip()
            self.assertTrue(verify_signed_manifest(manifest_json, public_key))
            self.assertEqual(manifest_json["sha256"], sha)
            self.assertEqual(manifest_json["labels"], 50)

            code, out, _ = run_cli(
                "verify-manifest",
                "--manifest", str(out_dir / "model-manifest.json"),
                "--public-key", str(out_dir / "model-manifest.public-key.txt"),
            )
            self.assertEqual(code, 0)
            self.assertTrue(json.loads(out)["ok"])


if __name__ == "__main__":
    unittest.main()
