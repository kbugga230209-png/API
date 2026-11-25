"""Build a dataset manifest from an image directory tree, with hashes and splits.

Layout expected:

    <root>/<label>/<anything>.jpg

Provenance is supplied per invocation (licence, source URL, attribution) because
it must come from a human who actually checked the source — this tool will not
invent it. Splits are assigned deterministically from the image hash, not from
file order, so adding new images later cannot silently reshuffle an existing
test set.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .dataset import LICENSE_ALLOW, LICENSE_REQUIRE_ATTRIBUTION, sha256_file
from .labels import load_labels

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
DEFAULT_TEST_FRACTION = 0.15
DEFAULT_VAL_FRACTION = 0.15


def _split_for(digest: str, val_fraction: float, test_fraction: float) -> str:
    # Stable bucket 0..9999 from the image hash itself: re-running the tool never
    # moves an image that is already in a split, and no RNG state is involved.
    bucket = int(hashlib.sha256(("split:" + digest).encode()).hexdigest()[:8], 16) % 10_000 / 10_000
    if bucket < test_fraction:
        return "test"
    if bucket < test_fraction + val_fraction:
        return "val"
    return "train"


def build_manifest_from_directory(
    root: Path,
    license_id: str,
    source_url: str,
    attribution: str = "",
    classes: list[str] | None = None,
    val_fraction: float = DEFAULT_VAL_FRACTION,
    test_fraction: float = DEFAULT_TEST_FRACTION,
    corpus: str = "inference-corpus-v1",
    limit_per_class: int | None = None,
) -> tuple[dict, list[str]]:
    root = Path(root)
    problems: list[str] = []

    if license_id not in LICENSE_ALLOW:
        problems.append(f"licence {license_id!r} is not in the allow-list {sorted(LICENSE_ALLOW)}")
    if license_id in LICENSE_REQUIRE_ATTRIBUTION and not attribution.strip():
        problems.append(f"licence {license_id} requires a non-empty attribution string")
    if not source_url.strip():
        problems.append("sourceUrl is required — every image must be traceable to where it came from")
    if not 0 < val_fraction < 1 or not 0 <= test_fraction < 1 or val_fraction + test_fraction >= 1:
        problems.append("val/test fractions must leave a non-empty training split")
    if not root.is_dir():
        problems.append(f"dataset root does not exist: {root}")
        return {"schemaVersion": 1, "corpus": corpus, "classes": [], "images": []}, problems

    known = classes or [cls.label for cls in load_labels()]
    known_set = set(known)
    images: list[dict] = []
    seen_dirs = sorted(p for p in root.iterdir() if p.is_dir())
    for label_dir in seen_dirs:
        label = label_dir.name
        if label not in known_set:
            problems.append(f"directory {label!r} is not a recognition class in labels.json")
            continue
        files = sorted(p for p in label_dir.rglob("*") if p.suffix.lower() in IMAGE_SUFFIXES)
        if limit_per_class:
            files = files[:limit_per_class]
        if not files:
            problems.append(f"class {label!r} has no images")
            continue
        for path in files:
            digest = sha256_file(path)
            images.append(
                {
                    "path": str(path.relative_to(root)),
                    "label": label,
                    "split": _split_for(digest, val_fraction, test_fraction),
                    "sha256": digest,
                    "license": license_id,
                    "sourceUrl": source_url,
                    "attribution": attribution,
                }
            )

    missing = sorted(known_set - {image["label"] for image in images})
    if missing:
        problems.append(f"{len(missing)} recognition classes have no images yet: {missing[:10]}")

    manifest = {
        "schemaVersion": 1,
        "corpus": corpus,
        "createdBy": "ml/bharatbite_ml/manifest_tool.py",
        "classes": sorted({image["label"] for image in images}),
        "images": images,
    }
    return manifest, problems


def write_manifest(manifest: dict, path: Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return path
