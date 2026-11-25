import io
import struct
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from bharatbite_ml import sources as sources_module
from bharatbite_ml.sources import (
    SourcePolicyError,
    fetch_wikimedia,
    load_registry,
    normalise_licence,
    require_training_allowed,
    search_terms,
    training_sources,
    validate_registry,
)


def png_bytes(width: int, height: int) -> bytes:
    ihdr = struct.pack(">II", width, height) + bytes([8, 2, 0, 0, 0])
    chunk = struct.pack(">I", len(ihdr)) + b"IHDR" + ihdr + b"\x00\x00\x00\x00"
    iend = struct.pack(">I", 0) + b"IEND" + b"\x00\x00\x00\x00"
    return b"\x89PNG\r\n\x1a\n" + chunk + iend


def jpeg_bytes(width: int, height: int) -> bytes:
    sof = b"\xff\xc0" + struct.pack(">H", 17) + bytes([8]) + struct.pack(">HH", height, width) + bytes([3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1])
    return b"\xff\xd8" + sof + b"\xff\xd9"


class RegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = load_registry()

    def test_registry_is_sound(self):
        self.assertEqual(validate_registry(self.registry), [])

    def test_only_clear_licence_sources_may_train(self):
        allowed = {source.id for source in training_sources(self.registry)}
        self.assertEqual(allowed, {"wikimedia-commons", "open-images-v7", "own-capture"})
        for source in self.registry:
            if source.id in allowed:
                self.assertIn(source.license_status, {"clear", "mixed"})
            else:
                self.assertTrue(source.eval_only or source.rejection, source.id)

    def test_scraped_kaggle_set_is_refused(self):
        with self.assertRaises(SourcePolicyError) as ctx:
            require_training_allowed(self.registry, "kaggle-indian-food-images-80")
        message = str(ctx.exception)
        self.assertIn("may not be used for training", message)
        self.assertIn("Google Images", " ".join(s.notes for s in self.registry if s.id == "kaggle-indian-food-images-80"))

    def test_apache_labelled_scraped_set_is_rejected_outright(self):
        source = next(s for s in self.registry if s.id == "kaggle-ashishpadala-indian-food-images")
        self.assertFalse(source.usable_for_training)
        self.assertIsNotNone(source.rejection)
        self.assertFalse(source.eval_only, "a dataset whose licence contradicts its source is not even an eval proxy")

    def test_unknown_source_is_refused(self):
        with self.assertRaises(SourcePolicyError):
            require_training_allowed(self.registry, "some-dataset-i-invented")

    def test_ambiguous_licence_with_training_allowed_is_a_problem(self):
        registry = load_registry()
        registry[3].training_allowed = True
        problems = validate_registry(registry)
        self.assertTrue(any("ambiguous licence cannot allow training" in p for p in problems))

    def test_duplicate_ids_are_a_problem(self):
        registry = load_registry()
        registry.append(registry[0])
        self.assertTrue(any("duplicate source id" in p for p in validate_registry(registry)))


class LicenceTests(unittest.TestCase):
    def test_mapping(self):
        self.assertEqual(normalise_licence("CC0"), "CC0-1.0")
        self.assertEqual(normalise_licence("CC BY 4.0"), "CC-BY-4.0")
        self.assertEqual(normalise_licence("CC BY-SA 3.0"), "CC-BY-SA-4.0")
        self.assertEqual(normalise_licence("Public domain"), "CC0-1.0")
        self.assertEqual(normalise_licence("CC BY 2.0"), "CC-BY-4.0")

    def test_non_free_licences_are_not_mapped(self):
        for value in ("Fair use", "All rights reserved", "Non-free", "", "CC BY-NC 4.0"):
            self.assertIsNone(normalise_licence(value), value)

    def test_search_terms_are_deduplicated(self):
        terms = search_terms("poha-dish", "Poha", ("kanda poha", "poha"))
        self.assertEqual(terms[0], "Poha")
        self.assertEqual(len(terms), len({t.lower() for t in terms}))
        self.assertIn("poha dish", terms)


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
        return False


def commons_page(page_id: int, licence: str, artist: str = "Someone", thumb: str | None = "https://upload.example/x.jpg"):
    meta = {"LicenseShortName": {"value": licence}, "Artist": {"value": f"<a href='#'>{artist}</a>"}}
    return {
        "pageid": page_id,
        "title": f"File:dish-{page_id}.jpg",
        "imageinfo": [
            {
                "thumburl": thumb,
                "descriptionurl": f"https://commons.example/wiki/File:dish-{page_id}.jpg",
                "width": 1200,
                "height": 900,
                "extmetadata": meta,
            }
        ],
    }


class FetchTests(unittest.TestCase):
    def test_dry_run_writes_nothing(self):
        with TemporaryDirectory() as tmp, mock.patch.object(
            sources_module, "_api", return_value={"query": {"pages": [commons_page(1, "CC BY 4.0")]}}
        ):
            report = fetch_wikimedia(Path(tmp), per_class=1, classes=["thepla"], dry_run=True)
            self.assertEqual(report.per_class_counts["thepla"], 1)
            self.assertEqual(list(Path(tmp).rglob("*.jpg")), [])

    def test_real_fetch_records_provenance_and_skips_bad_licences(self):
        payload = {
            "query": {
                "pages": [
                    commons_page(10, "CC BY-SA 4.0", artist="Asha Patel"),
                    commons_page(11, "Fair use"),
                    commons_page(12, "CC0"),
                    commons_page(13, "CC BY 4.0", artist=""),
                    commons_page(14, "CC0"),
                ]
            }
        }
        # Distinct bytes per thumbnail; two pages share bytes to exercise dedupe.
        blobs = {
            10: b"\xff\xd8" + b"A" * 6000,
            11: b"x" * 6000,
            12: b"\xff\xd8" + b"B" * 6000,
            13: b"y" * 6000,
            14: b"\xff\xd8" + b"A" * 6000,  # same bytes as page 10
        }

        def fake_urlopen(request, timeout=None):
            url = request.full_url if hasattr(request, "full_url") else str(request)
            for key in blobs:
                if f"dish-{key}" in url:
                    return FakeResponse(blobs[key])
            return FakeResponse(b"\xff\xd8" + b"z" * 6000)

        # thumb URLs must be page-specific
        payload["query"]["pages"][0]["imageinfo"][0]["thumburl"] = "https://upload.example/dish-10.jpg"
        payload["query"]["pages"][1]["imageinfo"][0]["thumburl"] = "https://upload.example/dish-11.jpg"
        payload["query"]["pages"][2]["imageinfo"][0]["thumburl"] = "https://upload.example/dish-12.jpg"
        payload["query"]["pages"][3]["imageinfo"][0]["thumburl"] = "https://upload.example/dish-13.jpg"
        payload["query"]["pages"][4]["imageinfo"][0]["thumburl"] = "https://upload.example/dish-14.jpg"

        with TemporaryDirectory() as tmp, mock.patch.object(
            sources_module, "_api", return_value=payload
        ), mock.patch.object(sources_module.urllib.request, "urlopen", side_effect=fake_urlopen):
            report = fetch_wikimedia(Path(tmp), per_class=5, classes=["idli"])

            self.assertEqual(report.per_class_counts["idli"], 2, "CC BY-SA and CC0 accepted; fair use and no-author skipped")
            self.assertTrue(any("Fair use" in entry for entry in report.skipped_licence))
            self.assertTrue(any("attribution missing" in entry for entry in report.skipped_licence))
            self.assertTrue(any("identical bytes" in entry for entry in report.skipped_duplicate))

            saved = report.downloaded[0]
            self.assertEqual(saved["license"], "CC-BY-SA-4.0")
            self.assertEqual(saved["attribution"], "Asha Patel", "HTML must be stripped from the author string")
            self.assertTrue(saved["sourceUrl"].startswith("https://commons.example/wiki/File:"))
            self.assertEqual(len(saved["sha256"]), 64)
            self.assertTrue((Path(tmp) / saved["path"]).is_file())

    def test_small_downloads_are_rejected(self):
        payload = {"query": {"pages": [commons_page(21, "CC0")]}}
        payload["query"]["pages"][0]["imageinfo"][0]["thumburl"] = "https://upload.example/tiny.jpg"
        with TemporaryDirectory() as tmp, mock.patch.object(
            sources_module, "_api", return_value=payload
        ), mock.patch.object(
            sources_module.urllib.request, "urlopen", side_effect=lambda *a, **k: FakeResponse(b"\xff\xd8small")
        ):
            report = fetch_wikimedia(Path(tmp), per_class=1, classes=["poha-dish"])
        self.assertEqual(report.per_class_counts["poha-dish"], 0)
        self.assertTrue(any("suspiciously small" in entry for entry in report.skipped_error))

    def test_network_failure_is_reported_not_raised(self):
        with TemporaryDirectory() as tmp, mock.patch.object(
            sources_module, "_api", side_effect=RuntimeError("TLS closed")
        ):
            report = fetch_wikimedia(Path(tmp), per_class=1, classes=["sambar"])
        self.assertEqual(report.per_class_counts["sambar"], 0)
        self.assertTrue(any("search failed" in entry for entry in report.skipped_error))

    def test_fetch_refuses_for_a_blocked_source(self):
        with TemporaryDirectory() as tmp:
            with mock.patch.object(sources_module, "load_registry", return_value=load_registry()):
                with self.assertRaises(SourcePolicyError):
                    sources_module.require_training_allowed(load_registry(), "food-101")


if __name__ == "__main__":
    unittest.main()
