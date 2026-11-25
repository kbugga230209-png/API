import base64
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from bharatbite_ml import ed25519
from bharatbite_ml.dataset import sha256_file
from bharatbite_ml.export_manifest import (
    ManifestRefused,
    build_manifest,
    canonical_manifest_payload,
    load_secret,
    verify_signed_manifest,
    write_manifest,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
CORE_MANIFEST_JS = REPO_ROOT / "packages" / "core" / "dist" / "manifest.js"
SECRET = bytes(range(32))
SECRET_HEX = SECRET.hex()

SAMPLE = {
    "schemaVersion": 1,
    "modelId": "bharatbite-indian-food",
    "version": "1.2.0",
    "channel": "stable",
    "format": "tflite",
    "architecture": "efficientnet_lite0_int8",
    "fileUrl": "https://cdn.bharatbite.app/models/indian-food-1.2.0.tflite",
    "sizeBytes": 4700000,
    "sha256": "0" * 64,
    "inputShape": [1, 224, 224, 3],
    "labels": 50,
    "validationTop1": 0.8123,
    "minAppVersion": "0.1.0",
    "releasedAt": "2026-12-01T10:00:00Z",
    "notes": "भारत स्थानीय व्यंजन",
    "signature": "placeholder",
}


class ManifestSigningTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.artifact = self.root / "model.tflite"
        self.artifact.write_bytes(b"TFL3" + b"fake-weights" * 100)
        self.sha = sha256_file(self.artifact)
        self.results = self.root / "results.json"
        self.results.write_text(json.dumps(self._results(self.sha, top1=0.81)), encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def _results(self, sha: str, top1: float = 0.81, trained: bool = True) -> dict:
        return {
            "schemaVersion": 1,
            "evaluatedOn": {"corpus": "inference-corpus-v1", "split": "test", "images": 3000},
            "device": "Pixel 6a",
            "models": [
                {
                    "architecture": "efficientnet_lite0_int8",
                    "format": "tflite",
                    "trained": trained,
                    "sizeBytes": self.artifact.stat().st_size,
                    "top1": top1,
                    "top5": 0.95,
                    "latencyP50Ms": 40.0,
                    "latencyP95Ms": 62.0,
                    "artifactSha256": sha,
                }
            ],
        }

    def _build(self, **overrides):
        kwargs = dict(
            model_id="bharatbite-indian-food",
            version="1.2.0",
            channel="stable",
            format="tflite",
            architecture="efficientnet_lite0_int8",
            file_url="https://cdn.bharatbite.app/models/indian-food-1.2.0.tflite",
            labels=50,
            min_app_version="0.1.0",
            released_at="2026-12-01T10:00:00Z",
            notes="first trained model",
            secret=SECRET,
        )
        kwargs.update(overrides)
        return build_manifest(self.artifact, json.loads(self.results.read_text()), **kwargs)

    def test_happy_path_signs_and_self_verifies(self):
        signed = self._build()
        self.assertEqual(signed.manifest["sha256"], self.sha)
        self.assertEqual(signed.manifest["sizeBytes"], self.artifact.stat().st_size)
        self.assertEqual(signed.manifest["validationTop1"], 0.81)
        self.assertTrue(verify_signed_manifest(signed.manifest, signed.public_key_base64))
        self.assertEqual(base64.b64decode(signed.public_key_base64), ed25519.public_key(SECRET))

    def test_refuses_without_artifact(self):
        with self.assertRaises(ManifestRefused) as ctx:
            self._build()
            self.artifact.unlink()
            self._build()
        self.assertTrue(ctx.exception.reasons)

    def test_refuses_when_artifact_does_not_match_benchmark(self):
        self.artifact.write_bytes(b"TFL3different-bytes")
        with self.assertRaises(ManifestRefused) as ctx:
            self._build()
        self.assertIn("not on", "; ".join(ctx.exception.reasons))

    def test_refuses_when_gate_fails(self):
        self.results.write_text(json.dumps(self._results(self.sha, top1=0.55)), encoding="utf-8")
        with self.assertRaises(ManifestRefused) as ctx:
            self._build()
        self.assertIn("gate not met", "; ".join(ctx.exception.reasons))

    def test_refuses_untrained_results(self):
        self.results.write_text(json.dumps(self._results(self.sha, trained=False)), encoding="utf-8")
        with self.assertRaises(ManifestRefused):
            self._build()

    def test_refuses_non_https_url(self):
        with self.assertRaises(ManifestRefused):
            self._build(file_url="http://cdn.bharatbite.app/model.tflite")

    def test_refuses_unknown_architecture(self):
        with self.assertRaises(ManifestRefused):
            self._build(architecture="resnet50")

    def test_refuses_bad_channel(self):
        with self.assertRaises(ManifestRefused):
            self._build(channel="nightly")

    def test_refuses_zero_labels(self):
        with self.assertRaises(ManifestRefused):
            self._build(labels=0)

    def test_signature_is_detached_and_canonical(self):
        signed = self._build()
        payload = canonical_manifest_payload(signed.manifest)
        self.assertNotIn("signature", payload)
        self.assertTrue(payload.startswith('{"architecture":'))
        signature = base64.b64decode(signed.manifest["signature"])
        self.assertTrue(ed25519.verify(ed25519.public_key(SECRET), payload.encode(), signature))

    def test_tampering_with_any_field_breaks_verification(self):
        signed = self._build()
        tampered = dict(signed.manifest, validationTop1=0.99)
        self.assertFalse(verify_signed_manifest(tampered, signed.public_key_base64))

    def test_written_files(self):
        signed = self._build()
        manifest_path, key_path = write_manifest(signed, self.root / "out")
        reloaded = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertTrue(verify_signed_manifest(reloaded, key_path.read_text().strip()))
        self.assertEqual(reloaded["schemaVersion"], 1)

    def test_load_secret_validates_length(self):
        self.assertEqual(len(load_secret(SECRET_HEX)), 32)
        with self.assertRaises(ManifestRefused):
            load_secret("abcd")

    def test_float_serialization_matches_json(self):
        payload = canonical_manifest_payload(SAMPLE)
        parsed = json.loads(payload)
        self.assertEqual(parsed["validationTop1"], 0.8123)
        self.assertEqual(parsed["inputShape"], [1, 224, 224, 3])
        self.assertEqual(parsed["notes"], "भारत स्थानीय व्यंजन")

    @unittest.skipUnless(shutil.which("node") and CORE_MANIFEST_JS.exists(), "node or core dist missing")
    def test_canonical_payload_matches_shipped_typescript(self):
        payload = canonical_manifest_payload(SAMPLE)
        script = (
            "const m = require(process.argv[1]);"
            "const input = JSON.parse(process.argv[2]);"
            "process.stdout.write(m.canonicalManifestPayload(input));"
        )
        completed = subprocess.run(
            ["node", "-e", script, str(CORE_MANIFEST_JS), json.dumps(SAMPLE, ensure_ascii=False)],
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertEqual(completed.stdout, payload)


if __name__ == "__main__":
    unittest.main()
