"""Dataset manifest validation, leakage detection and split construction.

This module never downloads or generates images. It is the gate a dataset must
pass before a training run is allowed: provenance and licence recorded per image,
hashes that match the bytes on disk, no duplicate image spanning two splits, and
every class present in every split.

Manifest shape (JSON):

    {
      "schemaVersion": 1,
      "corpus": "inference-corpus-v1",
      "classes": ["thepla", "idli", ...],          # must match labels.json
      "images": [
        {
          "path": "images/thepla/0001.jpg",
          "label": "thepla",
          "split": "train",                        # train | val | test
          "sha256": "…64 hex…",
          "license": "CC-BY-4.0",
          "sourceUrl": "https://…",
          "attribution": "Photo by …",
          "capturedRegion": "gujarat"              # optional, used for coverage
        }
      ]
    }
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from random import Random

# Licences that permit redistribution inside a commercial product, with
# attribution where the licence requires it. Anything not listed is rejected:
# an unclear licence on a training image is a legal risk we do not take.
LICENSE_ALLOW = {
    "CC0-1.0",
    "CC-BY-4.0",
    "CC-BY-SA-4.0",
    "Apache-2.0",
    "MIT",
    "owner_owned",
    "bharatbite_captured",
}
LICENSE_REQUIRE_ATTRIBUTION = {"CC-BY-4.0", "CC-BY-SA-4.0", "Apache-2.0", "MIT"}

SPLITS = ("train", "val", "test")
MIN_IMAGES_PER_CLASS = 40
MAX_IMBALANCE_RATIO = 8.0
MIN_VAL_PER_CLASS = 5


@dataclass
class Issue:
    level: str  # "error" | "warning"
    code: str
    message: str


@dataclass
class DatasetReport:
    total_images: int = 0
    per_class: dict[str, int] = field(default_factory=dict)
    per_split: dict[str, int] = field(default_factory=dict)
    issues: list[Issue] = field(default_factory=list)

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.level == "error"]

    @property
    def warnings(self) -> list[Issue]:
        return [i for i in self.issues if i.level == "warning"]

    @property
    def ok(self) -> bool:
        return not self.errors

    def add(self, level: str, code: str, message: str) -> None:
        self.issues.append(Issue(level, code, message))

    def summary(self) -> str:
        return (
            f"{self.total_images} images across {len(self.per_class)} classes; "
            f"{len(self.errors)} errors, {len(self.warnings)} warnings; splits "
            + ", ".join(f"{k}={v}" for k, v in sorted(self.per_split.items()))
        )


def sha256_file(path: Path, chunk: int = 1 << 20) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(chunk), b""):
            digest.update(block)
    return digest.hexdigest()


def load_manifest(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def validate_manifest(
    manifest: dict,
    root: Path,
    declared_classes: list[str] | None = None,
    verify_hashes: bool = True,
    min_images_per_class: int = MIN_IMAGES_PER_CLASS,
    min_val_per_class: int = MIN_VAL_PER_CLASS,
) -> DatasetReport:
    report = DatasetReport()
    images = manifest.get("images") or []

    if manifest.get("schemaVersion") != 1:
        report.add("error", "schema_version", "manifest.schemaVersion must be 1")
    if not images:
        report.add("error", "empty_manifest", "manifest contains no images — there is nothing to train on")
        return report

    manifest_classes = list(manifest.get("classes") or [])
    if not manifest_classes:
        report.add("error", "no_classes", "manifest.classes is empty")
    if declared_classes is not None:
        unknown = sorted(set(manifest_classes) - set(declared_classes))
        if unknown:
            report.add("error", "class_not_in_labels", f"classes not in labels.json: {unknown}")

    first_seen: dict[str, tuple[str, str]] = {}
    split_of_hash: dict[str, str] = {}
    per_class_split: dict[str, dict[str, int]] = {}
    regions: dict[str, set[str]] = {}

    for index, image in enumerate(images):
        where = f"images[{index}]"
        for required in ("path", "label", "split", "sha256", "license", "sourceUrl", "attribution"):
            if not image.get(required):
                report.add("error", "missing_field", f"{where} is missing {required}")
        label = image.get("label")
        split = image.get("split")
        if split not in SPLITS:
            report.add("error", "bad_split", f"{where} has split {split!r}, expected one of {SPLITS}")
            continue
        if declared_classes is not None and label not in declared_classes:
            report.add("error", "unknown_label", f"{where} label {label!r} is not in labels.json")
        license_id = image.get("license")
        if license_id and license_id not in LICENSE_ALLOW:
            report.add("error", "license_not_allowed", f"{where} licence {license_id!r} is not in the allow-list")
        if license_id in LICENSE_REQUIRE_ATTRIBUTION and not str(image.get("attribution", "")).strip():
            report.add("error", "attribution_required", f"{where} licence {license_id} requires attribution")

        digest = str(image.get("sha256", "")).lower()
        if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            report.add("error", "bad_hash", f"{where} sha256 is not 64 hex characters")

        path = Path(root) / image.get("path", "")
        if not path.is_file():
            report.add("error", "missing_file", f"{where} file not found: {image.get('path')}")
        elif verify_hashes:
            actual = sha256_file(path)
            if actual != digest:
                report.add("error", "hash_mismatch", f"{where} sha256 mismatch for {image.get('path')}")

        if digest in split_of_hash and split_of_hash[digest] != split:
            prior = first_seen.get(digest, ("?", "?"))
            report.add(
                "error",
                "split_leakage",
                f"identical bytes in {prior[1]} and {split}: {prior[0]} == {image.get('path')}",
            )
        elif digest in split_of_hash:
            report.add("warning", "duplicate_in_split", f"duplicate image inside {split}: {image.get('path')}")
        split_of_hash.setdefault(digest, split)
        first_seen.setdefault(digest, (str(image.get("path")), split))

        report.total_images += 1
        report.per_class[label] = report.per_class.get(label, 0) + 1
        report.per_split[split] = report.per_split.get(split, 0) + 1
        per_class_split.setdefault(label, {}).setdefault(split, 0)
        per_class_split[label][split] += 1
        if image.get("capturedRegion"):
            regions.setdefault(label, set()).add(str(image["capturedRegion"]))

    for label, counts in sorted(per_class_split.items()):
        if report.per_class.get(label, 0) < min_images_per_class:
            report.add(
                "error",
                "class_too_small",
                f"class {label!r} has {report.per_class.get(label, 0)} images, need at least {min_images_per_class}",
            )
        if counts.get("val", 0) < min_val_per_class:
            report.add("error", "class_missing_val", f"class {label!r} has {counts.get('val', 0)} validation images")

    present = [n for n in report.per_class.values() if n > 0]
    if present:
        ratio = max(present) / min(present)
        if ratio > MAX_IMBALANCE_RATIO:
            report.add(
                "warning",
                "class_imbalance",
                f"largest class has {ratio:.1f}× the images of the smallest (threshold {MAX_IMBALANCE_RATIO})",
            )

    for label in manifest_classes:
        if report.per_class.get(label, 0) == 0:
            report.add("error", "class_without_images", f"declared class {label!r} has no images")

    return report


def build_split(
    members: dict[str, list[str]],
    val_fraction: float = 0.15,
    test_fraction: float = 0.15,
    seed: int = 20261125,
) -> dict[str, list[str]]:
    """Deterministic, class-stratified split of image hashes.

    `members` maps a class label to its image identifiers (SHA-256 hex). Each
    class is shuffled with the same seeded RNG so the plan can be reproduced and
    audited later; a class keeps at least one validation image so per-class
    recall can be measured even for small classes.
    """
    if not 0 < val_fraction < 1 or not 0 <= test_fraction < 1:
        raise ValueError("fractions must be between 0 and 1")
    if val_fraction + test_fraction >= 1:
        raise ValueError("val + test fractions must leave a training set")
    if not members:
        raise ValueError("no classes to split")

    rng = Random(seed)
    plan: dict[str, list[str]] = {"train": [], "val": [], "test": []}
    for label in sorted(members):
        items = list(dict.fromkeys(members[label]))
        if not items:
            continue
        rng.shuffle(items)
        n_val = max(1, round(len(items) * val_fraction))
        n_test = round(len(items) * test_fraction)
        if n_val + n_test >= len(items):
            n_val, n_test = max(1, len(items) // 5), 0
        plan["val"].extend(items[:n_val])
        plan["test"].extend(items[n_val : n_val + n_test])
        plan["train"].extend(items[n_val + n_test :])
    return {key: sorted(value) for key, value in plan.items()}


def split_report(plan: dict[str, list[str]]) -> dict[str, object]:
    sets = {split: set(items) for split, items in plan.items()}
    overlaps = {}
    for a in SPLITS:
        for b in SPLITS:
            if a < b:
                shared = sets[a] & sets[b]
                if shared:
                    overlaps[f"{a}/{b}"] = sorted(shared)[:5]
    return {"counts": {k: len(v) for k, v in plan.items()}, "overlaps": overlaps}
