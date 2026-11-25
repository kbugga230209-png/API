"""Dataset quality checks that run before any training job is allowed to start.

Covers the failures that actually ruin a food classifier:

  * files that are not images or are truncated (header-level check, no decoding),
  * exact duplicates (identical bytes),
  * near duplicates (same photo re-encoded, cropped, resized) via dHash,
  * tiny images that will look like mush after resizing to 224 px,
  * labels that are not recognition classes,
  * class imbalance and missing coverage,
  * and — the one that silently inflates every published accuracy — the same
    photo, or its near twin, appearing in both train and test.

Near-duplicate detection needs pixels, so it requires Pillow. Without it the
report says `available: false` rather than pretending the corpus is clean.
"""
from __future__ import annotations

import hashlib
import struct
from dataclasses import dataclass, field
from pathlib import Path
from random import Random

MIN_SIDE = 200
NEAR_DUPLICATE_HAMMING = 4
MAX_IMBALANCE_RATIO = 8.0
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def _pillow():
    try:
        from PIL import Image  # type: ignore
    except Exception:
        return None
    return Image


@dataclass
class Probe:
    valid: bool
    format: str | None = None
    width: int = 0
    height: int = 0
    reason: str | None = None


def probe_image(path: Path) -> Probe:
    """Header-level validation: catches truncation and non-images without decoding."""
    try:
        head = path.read_bytes()[:32]
        size = path.stat().st_size
    except OSError as exc:
        return Probe(False, reason=f"unreadable: {exc}")
    if size == 0:
        return Probe(False, reason="empty file")
    if head.startswith(b"\xff\xd8\xff"):
        tail = path.read_bytes()[-2:]
        if tail != b"\xff\xd9":
            return Probe(False, reason="truncated JPEG (no EOI marker)")
        width, height = _jpeg_size(path)
        return Probe(True, "jpeg", width, height)
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        if len(head) < 24:
            return Probe(False, reason="truncated PNG header")
        width, height = struct.unpack(">II", head[16:24])
        if b"IEND" not in path.read_bytes()[-16:]:
            return Probe(False, reason="truncated PNG (no IEND chunk)")
        return Probe(True, "png", width, height)
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return Probe(True, "webp", *_webp_size(path))
    return Probe(False, reason="not a JPEG/PNG/WebP image")


def _jpeg_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    index = 2
    while index + 9 < len(data):
        if data[index] != 0xFF:
            index += 1
            continue
        marker = data[index + 1]
        if marker == 0xFF:  # fill byte, legal in JPEG
            index += 1
            continue
        if marker in (0xC0, 0xC1, 0xC2, 0xC3):
            height, width = struct.unpack(">HH", data[index + 5 : index + 9])
            return width, height
        if 0xD0 <= marker <= 0xD8 or marker in (0x01,):
            index += 2
            continue
        length = struct.unpack(">H", data[index + 2 : index + 4])[0]
        index += 2 + length
    return 0, 0


def _webp_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:40]
    if data[12:16] == b"VP8X":
        width = int.from_bytes(data[24:27], "little") + 1
        height = int.from_bytes(data[27:30], "little") + 1
        return width, height
    if data[12:16] == b"VP8L":
        bits = int.from_bytes(data[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    return 0, 0


def dhash_pixels(gray: bytes) -> int:
    """64-bit difference hash from 72 grayscale bytes (9×8)."""
    if len(gray) < 72:
        raise ValueError("dhash needs 72 grayscale bytes")
    value = 0
    for row in range(8):
        offset = row * 9
        for column in range(8):
            value = (value << 1) | (1 if gray[offset + column] < gray[offset + column + 1] else 0)
    return value


def dhash_file(path: Path, Image=None) -> int | None:
    Image = Image or _pillow()
    if Image is None:
        return None
    try:
        with Image.open(path) as image:
            small = image.convert("L").resize((9, 8))
            return dhash_pixels(small.tobytes())
    except Exception:
        return None


def hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


@dataclass
class QualityReport:
    root: str
    total_files: int = 0
    valid_images: int = 0
    per_class: dict[str, int] = field(default_factory=dict)
    invalid: list[dict] = field(default_factory=list)
    tiny: list[dict] = field(default_factory=list)
    unknown_labels: list[str] = field(default_factory=list)
    exact_duplicates: list[list[str]] = field(default_factory=list)
    near_duplicate_groups: list[list[str]] = field(default_factory=list)
    near_duplicate_available: bool = False
    empty_classes: list[str] = field(default_factory=list)
    imbalance_ratio: float = 0.0
    issues: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not (self.invalid or self.tiny or self.unknown_labels or self.exact_duplicates)

    def as_dict(self) -> dict:
        return {
            "root": self.root,
            "totalFiles": self.total_files,
            "validImages": self.valid_images,
            "perClass": dict(sorted(self.per_class.items())),
            "classes": len(self.per_class),
            "invalid": self.invalid[:50],
            "invalidCount": len(self.invalid),
            "tiny": self.tiny[:50],
            "tinyCount": len(self.tiny),
            "unknownLabels": self.unknown_labels,
            "exactDuplicateGroups": len(self.exact_duplicates),
            "nearDuplicateGroups": len(self.near_duplicate_groups),
            "nearDuplicateAvailable": self.near_duplicate_available,
            "emptyClasses": self.empty_classes,
            "imbalanceRatio": round(self.imbalance_ratio, 2),
            "issues": self.issues,
            "ok": self.ok,
        }


def scan_directory(root: Path, classes: list[str] | None = None, near_duplicates: bool = True) -> QualityReport:
    root = Path(root)
    report = QualityReport(root=str(root))
    Image = _pillow() if near_duplicates else None
    report.near_duplicate_available = Image is not None

    known = set(classes or [])
    by_digest: dict[str, list[str]] = {}
    hashes: list[tuple[int, str]] = []

    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        report.total_files += 1
        label = path.parent.name if path.parent != root else "(root)"
        if known and label not in known:
            report.unknown_labels.append(label)
            continue

        probe = probe_image(path)
        if not probe.valid:
            report.invalid.append({"path": str(path.relative_to(root)), "reason": probe.reason})
            continue
        if probe.width and probe.height and min(probe.width, probe.height) < MIN_SIDE:
            report.tiny.append({"path": str(path.relative_to(root)), "width": probe.width, "height": probe.height})
            continue

        report.valid_images += 1
        report.per_class[label] = report.per_class.get(label, 0) + 1
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        by_digest.setdefault(digest, []).append(str(path.relative_to(root)))

        if Image is not None:
            value = dhash_file(path, Image)
            if value is not None:
                hashes.append((value, str(path.relative_to(root))))

    report.exact_duplicates = [group for group in by_digest.values() if len(group) > 1]

    if Image is None:
        report.issues.append("near-duplicate detection skipped: Pillow is not installed")
    else:
        report.near_duplicate_groups = _cluster_near_duplicates(hashes)

    if report.invalid:
        report.issues.append(f"{len(report.invalid)} unreadable or corrupt file(s)")
    if report.tiny:
        report.issues.append(f"{len(report.tiny)} image(s) narrower or shorter than {MIN_SIDE}px")
    if report.unknown_labels:
        report.issues.append(f"label(s) not in labels.json: {', '.join(sorted(set(report.unknown_labels)))}")
    if report.exact_duplicates:
        report.issues.append(f"{len(report.exact_duplicates)} exact-duplicate group(s) — keep one copy")
    if report.near_duplicate_groups:
        report.issues.append(
            f"{len(report.near_duplicate_groups)} near-duplicate group(s) — group them into one split"
        )

    if known:
        report.empty_classes = sorted(label for label in known if report.per_class.get(label, 0) == 0)
    counts = [n for n in report.per_class.values() if n > 0]
    if counts:
        report.imbalance_ratio = max(counts) / min(counts)
        if report.imbalance_ratio > MAX_IMBALANCE_RATIO:
            report.issues.append(f"class imbalance {report.imbalance_ratio:.1f}× exceeds {MAX_IMBALANCE_RATIO}")
    return report


def _cluster_near_duplicates(hashes: list[tuple[int, str]], threshold: int = NEAR_DUPLICATE_HAMMING) -> list[list[str]]:
    parent = list(range(len(hashes)))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for i in range(len(hashes)):
        for j in range(i + 1, len(hashes)):
            if hamming(hashes[i][0], hashes[j][0]) <= threshold:
                union(i, j)

    groups: dict[int, list[str]] = {}
    for index, (_, path) in enumerate(hashes):
        groups.setdefault(find(index), []).append(path)
    return [sorted(group) for group in groups.values() if len(group) > 1]


# --------------------------------------------------------------------------- #
# Grouped, deterministic splits
# --------------------------------------------------------------------------- #


@dataclass
class GroupedSplit:
    assignments: dict[str, str] = field(default_factory=dict)
    groups: int = 0
    counts: dict[str, int] = field(default_factory=dict)
    conflicts: list[dict] = field(default_factory=list)
    starved_labels: list[str] = field(default_factory=list)


def group_key(digest: str, near_duplicate_hash: int | None) -> str:
    """Near twins share a key, so they can never be split across train and test."""
    if near_duplicate_hash is None:
        return f"sha:{digest}"
    return f"dhash:{near_duplicate_hash}"


def assign_grouped_splits(
    entries: list[dict],
    val_fraction: float = 0.15,
    test_fraction: float = 0.15,
    seed: int = 20261125,
) -> GroupedSplit:
    """Split by duplicate group, not by file, so re-encoded copies stay together.

    Grouping is **global**: the same photo listed under two class names is one
    group, so it can never be trained on and tested on. Such a group is a
    labelling conflict — the majority label wins and the group is reported in
    ``conflicts`` for a human to fix, rather than being silently duplicated.
    """
    if not 0 < val_fraction < 1 or not 0 <= test_fraction < 1 or val_fraction + test_fraction >= 1:
        raise ValueError("val/test fractions must leave a non-empty training split")

    rng = Random(seed)
    members: dict[str, list[dict]] = {}
    for entry in entries:
        key = entry.get("group") or group_key(entry["sha256"], entry.get("dhash"))
        members.setdefault(key, []).append(entry)

    result = GroupedSplit()
    by_label: dict[str, list[str]] = {}
    for key, rows in sorted(members.items()):
        counts: dict[str, int] = {}
        for row in rows:
            counts[row["label"]] = counts.get(row["label"], 0) + 1
        # majority label; ties broken by the alphabetically first label so the
        # outcome never depends on dict ordering
        winner = sorted(counts.items(), key=lambda item: (-item[1], item[0]))[0][0]
        if len(counts) > 1:
            result.conflicts.append(
                {
                    "group": key,
                    "labels": dict(sorted(counts.items())),
                    "keptLabel": winner,
                    "paths": sorted(row["path"] for row in rows),
                }
            )
        by_label.setdefault(winner, []).append(key)

    for label, keys in sorted(by_label.items()):
        shuffled = sorted(keys)
        rng.shuffle(shuffled)
        n_val = max(1, round(len(shuffled) * val_fraction)) if len(shuffled) > 2 else 1
        n_test = round(len(shuffled) * test_fraction)
        if n_val + n_test >= len(shuffled):
            n_val, n_test = max(1, len(shuffled) // 5), 0
        for index, key in enumerate(shuffled):
            if index < n_val:
                split = "val"
            elif index < n_val + n_test:
                split = "test"
            else:
                split = "train"
            for row in members[key]:
                result.assignments[row["path"]] = split

    declared = {entry["label"] for entry in entries}
    result.starved_labels = sorted(label for label in declared if label not in by_label)
    for split in ("train", "val", "test"):
        result.counts[split] = sum(1 for value in result.assignments.values() if value == split)
    result.groups = len(members)
    return result


def find_split_leakage(entries: list[dict]) -> list[str]:
    """Same group (exact or near-duplicate) present in more than one split."""
    seen: dict[str, str] = {}
    leaks: list[str] = []
    for entry in entries:
        key = entry.get("group") or group_key(entry["sha256"], entry.get("dhash"))
        split = entry.get("split")
        if key in seen and seen[key] != split:
            leaks.append(f"{key} appears in {seen[key]} and {split}")
        seen.setdefault(key, split)
    return sorted(set(leaks))
