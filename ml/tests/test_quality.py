import struct
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from bharatbite_ml.quality import (
    assign_grouped_splits,
    dhash_file,
    dhash_pixels,
    find_split_leakage,
    group_key,
    hamming,
    probe_image,
    scan_directory,
)

PIL_AVAILABLE = dhash_file.__module__ and __import__("importlib").util.find_spec("PIL") is not None


def png_bytes(width: int, height: int) -> bytes:
    ihdr = struct.pack(">II", width, height) + bytes([8, 2, 0, 0, 0])
    chunk = struct.pack(">I", len(ihdr)) + b"IHDR" + ihdr + b"\x00\x00\x00\x00"
    iend = struct.pack(">I", 0) + b"IEND" + b"\x00\x00\x00\x00"
    return b"\x89PNG\r\n\x1a\n" + chunk + iend


def jpeg_bytes(width: int, height: int) -> bytes:
    sof = b"\xff\xc0" + struct.pack(">H", 17) + bytes([8]) + struct.pack(">HH", height, width) + bytes([3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1])
    return b"\xff\xd8" + sof + b"\xff\xd9"


class ProbeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, name: str, data: bytes) -> Path:
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path

    def test_valid_png_dims(self):
        probe = probe_image(self.write("a.png", png_bytes(640, 480)))
        self.assertTrue(probe.valid)
        self.assertEqual((probe.format, probe.width, probe.height), ("png", 640, 480))

    def test_valid_jpeg_dims(self):
        probe = probe_image(self.write("b.jpg", jpeg_bytes(800, 600)))
        self.assertTrue(probe.valid)
        self.assertEqual((probe.format, probe.width, probe.height), ("jpeg", 800, 600))

    def test_truncated_jpeg_is_invalid(self):
        probe = probe_image(self.write("c.jpg", jpeg_bytes(300, 300)[:-2]))
        self.assertFalse(probe.valid)
        self.assertIn("truncated", probe.reason)

    def test_truncated_png_is_invalid(self):
        data = png_bytes(300, 300)
        probe = probe_image(self.write("d.png", data[:-8]))
        self.assertFalse(probe.valid)
        self.assertIn("truncated", probe.reason)

    def test_empty_and_non_image_files(self):
        self.assertFalse(probe_image(self.write("e.jpg", b"")).valid)
        self.assertFalse(probe_image(self.write("f.png", b"this is a text file")).valid)

    def test_missing_file(self):
        self.assertFalse(probe_image(self.root / "absent.jpg").valid)


class ScanTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, label: str, name: str, data: bytes) -> None:
        path = self.root / label / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def test_counts_and_problems(self):
        self.write("idli", "a.jpg", jpeg_bytes(800, 600))
        self.write("idli", "b.jpg", jpeg_bytes(640, 480))
        self.write("idli", "c.jpg", jpeg_bytes(300, 300)[:-2])          # truncated
        self.write("idli", "d.jpg", jpeg_bytes(120, 120))              # tiny
        self.write("dosa", "a.jpg", jpeg_bytes(800, 600))
        self.write("toy", "a.jpg", jpeg_bytes(800, 600))               # unknown label

        report = scan_directory(self.root, ["idli", "dosa", "sambar"], near_duplicates=False)
        self.assertEqual(report.per_class["idli"], 2)
        self.assertEqual(report.per_class["dosa"], 1)
        self.assertEqual(len(report.invalid), 1)
        self.assertEqual(len(report.tiny), 1)
        self.assertIn("toy", report.unknown_labels)
        self.assertIn("sambar", report.empty_classes)
        self.assertFalse(report.ok)
        self.assertFalse(report.near_duplicate_available)

    def test_exact_duplicates_across_classes_are_flagged(self):
        blob = jpeg_bytes(800, 600)
        self.write("idli", "a.jpg", blob)
        self.write("dosa", "a.jpg", blob)
        report = scan_directory(self.root, ["idli", "dosa"], near_duplicates=False)
        self.assertEqual(len(report.exact_duplicates), 1)
        self.assertEqual(sorted(report.exact_duplicates[0]), ["dosa/a.jpg", "idli/a.jpg"])

    def test_clean_directory_passes(self):
        for index in range(3):
            self.write("idli", f"{index}.jpg", jpeg_bytes(800 + index, 600))
        report = scan_directory(self.root, ["idli"], near_duplicates=False)
        self.assertTrue(report.ok, report.as_dict())


class DhashTests(unittest.TestCase):
    def test_dhash_is_deterministic_and_discriminating(self):
        flat = bytes([128] * 72)
        ramp = bytes(range(72))
        self.assertEqual(dhash_pixels(flat), dhash_pixels(bytes(flat)))
        self.assertNotEqual(dhash_pixels(flat), dhash_pixels(ramp))
        with self.assertRaises(ValueError):
            dhash_pixels(bytes(10))

    def test_hamming(self):
        self.assertEqual(hamming(0b1010, 0b1010), 0)
        self.assertEqual(hamming(0b1111, 0b0000), 4)

    @unittest.skipUnless(PIL_AVAILABLE, "Pillow not installed")
    def test_reencoded_and_resized_copies_share_a_hash(self):
        from PIL import Image

        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            original = Image.new("RGB", (400, 300))
            for x in range(400):
                for y in range(300):
                    original.putpixel((x, y), (x % 256, y % 256, 128))
            original.save(root / "original.png")
            original.resize((200, 150)).save(root / "smaller.png", quality=70)
            other = Image.new("RGB", (400, 300), (10, 200, 30))
            other.save(root / "other.png")

            first = dhash_file(root / "original.png")
            second = dhash_file(root / "smaller.png")
            third = dhash_file(root / "other.png")
            self.assertIsNotNone(first)
            self.assertLessEqual(hamming(first, second), 4, "a resized/re-encoded copy must be a near duplicate")
            self.assertGreater(hamming(first, third), 4, "a different photo must not be grouped")

    @unittest.skipUnless(PIL_AVAILABLE, "Pillow not installed")
    def test_scan_groups_near_duplicates(self):
        from PIL import Image

        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "idli").mkdir(parents=True, exist_ok=True)

            gradient = Image.new("RGB", (400, 300))
            for x in range(400):
                for y in range(300):
                    gradient.putpixel((x, y), (x % 256, y % 256, 128))
            gradient.save(root / "idli" / "original.png")
            gradient.resize((320, 240)).save(root / "idli" / "resized.png")

            checker = Image.new("RGB", (400, 300), (10, 20, 30))
            for x in range(0, 400, 20):
                for y in range(0, 300, 20):
                    if (x // 20 + y // 20) % 2 == 0:
                        for dx in range(20):
                            for dy in range(20):
                                checker.putpixel((x + dx, y + dy), (250, 240, 20))
            checker.save(root / "idli" / "checker.png")

            report = scan_directory(root, ["idli"])
            self.assertTrue(report.near_duplicate_available)
            flattened = [path for group in report.near_duplicate_groups for path in group]
            self.assertIn("idli/original.png", flattened)
            self.assertIn("idli/resized.png", flattened)
            self.assertNotIn("idli/checker.png", flattened, "an unrelated photo must not be grouped")
            self.assertEqual(report.exact_duplicates, [])


class GroupedSplitTests(unittest.TestCase):
    def entries(self, groups: int = 10, per_group: int = 2):
        rows = []
        for group in range(groups):
            for copy in range(per_group):
                rows.append(
                    {
                        "path": f"idli/g{group}-c{copy}.jpg",
                        "label": "idli",
                        "sha256": f"{group:064d}",
                        "group": f"dhash:{group}",
                    }
                )
        return rows

    def test_split_is_deterministic(self):
        first = assign_grouped_splits(self.entries(), seed=11)
        second = assign_grouped_splits(self.entries(), seed=11)
        self.assertEqual(first.assignments, second.assignments)

    def test_groups_never_straddle_splits(self):
        split = assign_grouped_splits(self.entries(groups=20), val_fraction=0.2, test_fraction=0.2, seed=5)
        checked = [dict(row, split=split.assignments[row["path"]]) for row in self.entries(groups=20)]
        self.assertEqual(find_split_leakage(checked), [])
        # every copy of a group landed in the same split
        by_group: dict[str, set[str]] = {}
        for row in checked:
            by_group.setdefault(row["group"], set()).add(row["split"])
        self.assertTrue(all(len(splits) == 1 for splits in by_group.values()))
        self.assertGreater(split.counts["train"], 0)
        self.assertGreater(split.counts["val"], 0)

    def test_val_and_test_fractions(self):
        split = assign_grouped_splits(self.entries(groups=100, per_group=1), val_fraction=0.2, test_fraction=0.2, seed=3)
        self.assertEqual(split.counts["val"], 20)
        self.assertEqual(split.counts["test"], 20)
        self.assertEqual(split.counts["train"], 60)

    def test_impossible_fractions_rejected(self):
        with self.assertRaises(ValueError):
            assign_grouped_splits(self.entries(), val_fraction=0.7, test_fraction=0.5)

    def test_leakage_is_detected(self):
        rows = [
            {"path": "a", "label": "idli", "sha256": "1" * 64, "group": "dhash:7", "split": "train"},
            {"path": "b", "label": "idli", "sha256": "2" * 64, "group": "dhash:7", "split": "test"},
        ]
        leaks = find_split_leakage(rows)
        self.assertEqual(len(leaks), 1)
        self.assertIn("train", leaks[0])

    def test_group_key_falls_back_to_sha256(self):
        self.assertEqual(group_key("a" * 64, None), "sha:" + "a" * 64)
        self.assertEqual(group_key("a" * 64, 42), "dhash:42")

    def test_a_photo_listed_under_two_labels_is_one_group(self):
        entries = [
            {"path": "idli/a.jpg", "label": "idli", "sha256": "1" * 64, "group": "dhash:9"},
            {"path": "idli/b.jpg", "label": "idli", "sha256": "2" * 64, "group": "dhash:1"},
            {"path": "dosa/a.jpg", "label": "dosa", "sha256": "1" * 64, "group": "dhash:9"},
        ]
        split = assign_grouped_splits(entries, seed=4)
        checked = [dict(entry, split=split.assignments[entry["path"]]) for entry in entries]
        self.assertEqual(find_split_leakage(checked), [], "a cross-label duplicate must not be split")
        self.assertEqual(
            split.assignments["idli/a.jpg"],
            split.assignments["dosa/a.jpg"],
            "the duplicate pair shares one split",
        )
        self.assertEqual(len(split.conflicts), 1)
        self.assertEqual(split.conflicts[0]["labels"], {"dosa": 1, "idli": 1})
        self.assertEqual(split.conflicts[0]["keptLabel"], "dosa", "ties break alphabetically, deterministically")

    def test_label_that_lost_all_its_photos_is_reported_starved(self):
        entries = [
            {"path": "idli/a.jpg", "label": "idli", "sha256": "1" * 64, "group": "dhash:1"},
            {"path": "idli/b.jpg", "label": "idli", "sha256": "2" * 64, "group": "dhash:1"},
            {"path": "idli/c.jpg", "label": "idli", "sha256": "3" * 64, "group": "dhash:2"},
            {"path": "dosa/a.jpg", "label": "dosa", "sha256": "1" * 64, "group": "dhash:1"},
        ]
        split = assign_grouped_splits(entries, seed=2)
        self.assertEqual(split.starved_labels, ["dosa"])
        self.assertEqual(len(split.conflicts), 1)
        self.assertEqual(split.conflicts[0]["keptLabel"], "idli")

    def test_report_issues_explain_themselves(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "idli").mkdir()
            (root / "idli" / "ok.jpg").write_bytes(jpeg_bytes(800, 600))
            (root / "idli" / "broken.jpg").write_bytes(b"\xff\xd8nope")
            (root / "idli" / "small.jpg").write_bytes(jpeg_bytes(100, 100))
            report = scan_directory(root, ["idli"], near_duplicates=False)
            joined = " | ".join(report.issues)
            self.assertIn("corrupt", joined)
            self.assertIn("200px", joined)
            self.assertFalse(report.ok)

    def test_tiny_class_still_gets_a_validation_image(self):
        split = assign_grouped_splits(
            [{"path": "poha-dish/1.jpg", "label": "poha-dish", "sha256": "1" * 64, "group": "dhash:1"}],
            val_fraction=0.15,
            test_fraction=0.15,
            seed=1,
        )
        self.assertEqual(split.counts["val"], 1)


if __name__ == "__main__":
    unittest.main()
