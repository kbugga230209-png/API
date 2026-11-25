"""Turn raw detector/classifier output into what the app is allowed to show.

The app never displays a raw softmax score. Every recognized item goes through
here: it must clear a confidence floor, survive a margin check against its known
confusable sibling, and resolve to a real nutrition-catalog entry. When those
conditions are not met the correct answer is `abstained` — the user is offered
search instead of a wrong nutrition estimate.

This module is pure Python (no TensorFlow, no camera, no I/O) so the decision
logic is unit-testable on a laptop and identical on device.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .labels import LabelClass, load_labels

HIGH_CONFIDENCE = 0.75
MEDIUM_CONFIDENCE = 0.55
LOW_CONFIDENCE = 0.40
MARGIN_REQUIRED = 0.10
MAX_ITEMS = 5
MIN_DETECTION_BOX_AREA = 0.01


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float
    box: tuple[float, float, float, float] | None = None  # x0, y0, x1, y1 in 0..1

    @property
    def area(self) -> float:
        if not self.box:
            return 1.0
        x0, y0, x1, y1 = self.box
        return max(0.0, x1 - x0) * max(0.0, y1 - y0)


@dataclass
class RecognizedItem:
    label: str
    display_name: str
    confidence: float
    tier: str  # high | medium | low
    catalog_slug: str
    variant: str | None
    detections: int = 1
    needs_review: bool = False
    reason: str | None = None

    def as_dict(self) -> dict:
        return {
            "label": self.label,
            "displayName": self.display_name,
            "confidence": round(self.confidence, 4),
            "tier": self.tier,
            "catalogSlug": self.catalog_slug,
            "variant": self.variant,
            "detections": self.detections,
            "needsReview": self.needs_review,
            "reason": self.reason,
        }


@dataclass
class RecognitionResult:
    items: list[RecognizedItem] = field(default_factory=list)
    abstained: bool = False
    reason: str | None = None
    rejected: list[dict] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "items": [item.as_dict() for item in self.items],
            "abstained": self.abstained,
            "reason": self.reason,
            "rejected": self.rejected,
            "suggestSearchFallback": self.abstained or not self.items,
        }


def tier_for(confidence: float) -> str:
    if confidence >= HIGH_CONFIDENCE:
        return "high"
    if confidence >= MEDIUM_CONFIDENCE:
        return "medium"
    return "low"


def _load_label_index(path: Path | None = None) -> dict[str, LabelClass]:
    classes = load_labels(path) if path else load_labels()
    return {cls.label: cls for cls in classes}


def aggregate(
    detections: list[Detection],
    label_index: dict[str, LabelClass] | None = None,
    max_items: int = MAX_ITEMS,
) -> RecognitionResult:
    """Collapse detections into at most `max_items` catalog-backed foods."""
    index = label_index or _load_label_index()
    result = RecognitionResult()

    usable: list[Detection] = []
    for det in detections:
        if det.label not in index:
            result.rejected.append({"label": det.label, "reason": "unknown_label", "confidence": det.confidence})
            continue
        if det.confidence < LOW_CONFIDENCE:
            result.rejected.append({"label": det.label, "reason": "below_floor", "confidence": det.confidence})
            continue
        if det.box is not None and det.area < MIN_DETECTION_BOX_AREA:
            result.rejected.append({"label": det.label, "reason": "box_too_small", "confidence": det.confidence})
            continue
        usable.append(det)

    if not usable:
        result.abstained = True
        result.reason = "no_confident_detection"
        return result

    # Merge repeated detections of the same class: confidence grows with the
    # number of independent hits but never beyond the best single score plus a
    # small corroboration bonus.
    merged: dict[str, tuple[float, int]] = {}
    for det in usable:
        best, count = merged.get(det.label, (0.0, 0))
        merged[det.label] = (max(best, det.confidence), count + 1)

    ranked = sorted(merged.items(), key=lambda kv: kv[1][0], reverse=True)

    for rank, (label, (confidence, count)) in enumerate(ranked):
        cls = index[label]
        reason = None
        needs_review = False

        if rank == 0 or label == ranked[0][0]:
            runner_up = 0.0
            for other_label, (other_conf, _) in ranked:
                if other_label == label:
                    continue
                if other_label in cls.confusables:
                    runner_up = max(runner_up, other_conf)
            if runner_up and confidence - runner_up < MARGIN_REQUIRED:
                needs_review = True
                sibling = max(
                    (o for o in cls.confusables if o in merged), key=lambda o: merged[o][0], default=None
                )
                reason = f"ambiguous_with:{sibling}" if sibling else "ambiguous"

        if len(result.items) >= max_items:
            result.rejected.append({"label": label, "reason": "over_max_items", "confidence": confidence})
            continue

        result.items.append(
            RecognizedItem(
                label=label,
                display_name=cls.display_name,
                confidence=confidence,
                tier=tier_for(confidence),
                catalog_slug=cls.catalog_slug,
                variant=cls.variant,
                detections=count,
                needs_review=needs_review,
                reason=reason,
            )
        )

    if not result.items:
        result.abstained = True
        result.reason = "no_usable_item"
    elif result.items[0].tier == "low":
        # A low-confidence lead item means the photo probably is not a dish we
        # know. Showing its nutrition would be a guess.
        result.abstained = True
        result.reason = "top_item_low_confidence"
    return result


def recognize_from_json(payload: dict) -> RecognitionResult:
    """Entry point for the on-device bridge: {"detections": [{...}]}."""
    detections = [
        Detection(
            label=str(item["label"]),
            confidence=float(item["confidence"]),
            box=tuple(float(v) for v in item["box"]) if item.get("box") else None,  # type: ignore[arg-type]
        )
        for item in payload.get("detections", [])
    ]
    return aggregate(detections)


def main(argv: list[str] | None = None) -> int:
    import sys

    args = list(sys.argv[1:] if argv is None else argv)
    if not args:
        print("usage: python3 -m bharatbite_ml.infer <detections.json>", file=sys.stderr)
        return 2
    payload = json.loads(Path(args[0]).read_text(encoding="utf-8"))
    print(json.dumps(recognize_from_json(payload).as_dict(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
