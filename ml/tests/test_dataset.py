import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from bharatbite_ml.dataset import build_split, sha256_file, split_report, validate_manifest

CLASSES = ["thepla", "idli", "poha"]


def make_dataset(root: Path, per_class: int = 6, val: int = 2, test: int = 1) -> dict:
    images = []
    for label in CLASSES:
        for index in range(per_class):
            if index < val:
                split = "val"
            elif index < val + test:
                split = "test"
            else:
                split = "train"
            rel = f"images/{label}/{index:03d}.bin"
            path = root / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            payload = f"{label}-{index}".encode() * 8
            path.write_bytes(payload)
            images.append(
                {
                    "path": rel,
                    "label": label,
                    "split": split,
                    "sha256": hashlib.sha256(payload).hexdigest(),
                    "license": "CC-BY-4.0",
                    "sourceUrl": f"https://example.org/{label}/{index}",
                    "attribution": f"Photo by Test {label} {index}",
                }
            )
    return {"schemaVersion": 1, "corpus": "unit-test-corpus", "classes": CLASSES, "images": images}


class DatasetValidationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_valid_dataset_passes(self):
        manifest = make_dataset(self.root)
        report = validate_manifest(manifest, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1)
        self.assertTrue(report.ok, report.summary())
        self.assertEqual(report.total_images, 18)
        self.assertEqual(report.per_split, {"train": 9, "val": 6, "test": 3})

    def test_empty_manifest_is_a_hard_error(self):
        report = validate_manifest({"schemaVersion": 1, "classes": CLASSES, "images": []}, self.root, CLASSES)
        self.assertFalse(report.ok)
        self.assertEqual(report.errors[0].code, "empty_manifest")

    def test_missing_file_detected(self):
        manifest = make_dataset(self.root)
        (self.root / manifest["images"][0]["path"]).unlink()
        report = validate_manifest(manifest, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1)
        self.assertIn("missing_file", [i.code for i in report.errors])

    def test_hash_mismatch_detected(self):
        manifest = make_dataset(self.root)
        (self.root / manifest["images"][0]["path"]).write_bytes(b"tampered")
        report = validate_manifest(manifest, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1)
        self.assertIn("hash_mismatch", [i.code for i in report.errors])

    def test_hash_check_can_be_skipped(self):
        manifest = make_dataset(self.root)
        (self.root / manifest["images"][0]["path"]).write_bytes(b"tampered")
        report = validate_manifest(manifest, self.root, CLASSES, verify_hashes=False, min_images_per_class=5, min_val_per_class=1)
        self.assertNotIn("hash_mismatch", [i.code for i in report.errors])

    def test_duplicate_bytes_across_splits_is_leakage(self):
        manifest = make_dataset(self.root)
        first = manifest["images"][0]
        source = self.root / first["path"]
        copy = self.root / "images" / "thepla" / "leak.bin"
        copy.write_bytes(source.read_bytes())
        clone = dict(first, path="images/thepla/leak.bin", label="idli", split="test")
        manifest["images"].append(clone)
        report = validate_manifest(manifest, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1)
        self.assertIn("split_leakage", [i.code for i in report.errors])

    def test_duplicate_inside_one_split_is_only_a_warning(self):
        manifest = make_dataset(self.root)
        first = manifest["images"][0]
        copy = self.root / "images" / "thepla" / "dup.bin"
        copy.write_bytes((self.root / first["path"]).read_bytes())
        manifest["images"].append(dict(first, path="images/thepla/dup.bin"))
        report = validate_manifest(manifest, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1)
        self.assertTrue(report.ok, report.summary())
        self.assertIn("duplicate_in_split", [i.code for i in report.warnings])

    def test_disallowed_license_rejected(self):
        manifest = make_dataset(self.root)
        manifest["images"][0]["license"] = "all-rights-reserved"
        report = validate_manifest(manifest, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1)
        self.assertIn("license_not_allowed", [i.code for i in report.errors])

    def test_attribution_required_for_cc_by(self):
        manifest = make_dataset(self.root)
        manifest["images"][0]["attribution"] = "  "
        report = validate_manifest(manifest, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1)
        self.assertIn("attribution_required", [i.code for i in report.errors])

    def test_owner_owned_needs_no_attribution(self):
        manifest = make_dataset(self.root)
        for image in manifest["images"]:
            image["license"] = "bharatbite_captured"
            image["attribution"] = ""
        report = validate_manifest(manifest, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1)
        # attribution field is empty for every image, but the licence does not need it
        self.assertNotIn("attribution_required", [i.code for i in report.errors])

    def test_class_without_val_images_fails(self):
        manifest = make_dataset(self.root)
        for image in manifest["images"]:
            if image["label"] == "poha":
                image["split"] = "train"
        report = validate_manifest(manifest, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1)
        self.assertIn("class_missing_val", [i.code for i in report.errors])

    def test_declared_class_without_images_fails(self):
        manifest = make_dataset(self.root)
        manifest["classes"] = CLASSES + ["dhokla"]
        report = validate_manifest(manifest, self.root, CLASSES + ["dhokla"], min_images_per_class=5, min_val_per_class=1)
        self.assertIn("class_without_images", [i.code for i in report.errors])

    def test_label_outside_labels_json_fails(self):
        manifest = make_dataset(self.root)
        manifest["images"][0]["label"] = "pizza"
        report = validate_manifest(manifest, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1)
        self.assertIn("unknown_label", [i.code for i in report.errors])

    def test_bad_hash_format_fails(self):
        manifest = make_dataset(self.root)
        manifest["images"][0]["sha256"] = "not-a-hash"
        report = validate_manifest(manifest, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1, verify_hashes=False)
        self.assertIn("bad_hash", [i.code for i in report.errors])

    def test_imbalance_warns(self):
        manifest = make_dataset(self.root)
        for index in range(60):
            rel = f"images/thepla/extra{index:03d}.bin"
            payload = f"thepla-extra-{index}".encode()
            (self.root / rel).parent.mkdir(parents=True, exist_ok=True)
            (self.root / rel).write_bytes(payload)
            manifest["images"].append(
                {
                    "path": rel,
                    "label": "thepla",
                    "split": "train",
                    "sha256": hashlib.sha256(payload).hexdigest(),
                    "license": "CC0-1.0",
                    "sourceUrl": "https://example.org/x",
                    "attribution": "x",
                }
            )
        report = validate_manifest(manifest, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1)
        self.assertIn("class_imbalance", [i.code for i in report.warnings])

    def test_manifest_round_trips_through_json(self):
        manifest = make_dataset(self.root)
        path = self.root / "manifest.json"
        path.write_text(json.dumps(manifest), encoding="utf-8")
        reloaded = json.loads(path.read_text(encoding="utf-8"))
        report = validate_manifest(reloaded, self.root, CLASSES, min_images_per_class=5, min_val_per_class=1)
        self.assertTrue(report.ok, report.summary())

    def test_sha256_file_matches_hashlib(self):
        target = self.root / "blob.bin"
        target.write_bytes(b"bharatbite")
        self.assertEqual(sha256_file(target), hashlib.sha256(b"bharatbite").hexdigest())


class SplitTests(unittest.TestCase):
    def test_split_is_deterministic_and_disjoint(self):
        hashes = {"thepla": [f"h{index:03d}" for index in range(300)]}
        first = build_split(hashes, seed=7)
        second = build_split(hashes, seed=7)
        self.assertEqual(first, second)
        report = split_report(first)
        self.assertEqual(report["overlaps"], {})
        self.assertEqual(sum(report["counts"].values()), 300)

    def test_split_respects_fractions(self):
        hashes = {"idli": [f"h{index:03d}" for index in range(100)]}
        plan = build_split(hashes, val_fraction=0.2, test_fraction=0.2, seed=1)
        self.assertEqual(len(plan["val"]), 20)
        self.assertEqual(len(plan["test"]), 20)
        self.assertEqual(len(plan["train"]), 60)

    def test_split_rejects_impossible_fractions(self):
        with self.assertRaises(ValueError):
            build_split({"a": ["x"]}, val_fraction=0.6, test_fraction=0.5)

    def test_split_report_flags_overlap(self):
        plan = {"train": ["a", "b"], "val": ["b"], "test": []}
        self.assertIn("train/val", split_report(plan)["overlaps"])


if __name__ == "__main__":
    unittest.main()
