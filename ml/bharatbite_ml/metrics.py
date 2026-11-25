"""Evaluation metrics, pure Python so they can be tested without a GPU.

Everything the promotion gate looks at is computed here from raw scores:
top-1, top-5, macro-F1, per-class recall floor and expected calibration error.
Keeping the arithmetic separate from the training loop means a training run
cannot quietly redefine what "accurate enough" means.
"""
from __future__ import annotations

from dataclasses import dataclass, field

ECE_BINS = 15


@dataclass
class ClassScore:
    label: str
    support: int
    recall: float
    precision: float
    f1: float


@dataclass
class Evaluation:
    top1: float
    top5: float
    macro_f1: float
    per_class: dict[str, ClassScore]
    ece: float
    confusion: dict[str, dict[str, int]] = field(default_factory=dict)
    total: int = 0

    def weakest_classes(self, limit: int = 5) -> list[ClassScore]:
        return sorted(self.per_class.values(), key=lambda c: (c.recall, c.support))[:limit]

    def floor_failures(self, floor: float = 0.5, min_support: int = 5) -> list[ClassScore]:
        return [c for c in self.per_class.values() if c.support >= min_support and c.recall < floor]

    def as_dict(self) -> dict:
        return {
            "top1": round(self.top1, 4),
            "top5": round(self.top5, 4),
            "macroF1": round(self.macro_f1, 4),
            "ece": round(self.ece, 4),
            "total": self.total,
            "perClass": {
                label: {
                    "support": score.support,
                    "recall": round(score.recall, 4),
                    "precision": round(score.precision, 4),
                    "f1": round(score.f1, 4),
                }
                for label, score in sorted(self.per_class.items())
            },
            "weakest": [
                {"label": c.label, "recall": round(c.recall, 4), "support": c.support}
                for c in self.weakest_classes()
            ],
        }


def _check(scores: list[list[float]], truth: list[int]) -> None:
    if len(scores) != len(truth):
        raise ValueError(f"{len(scores)} rows of scores for {len(truth)} labels")
    if not truth:
        raise ValueError("cannot evaluate an empty set")
    width = len(scores[0])
    for index, row in enumerate(scores):
        if len(row) != width:
            raise ValueError(f"row {index} has {len(row)} scores, expected {width}")
        if any(v < 0 or v > 1 for v in row):
            raise ValueError(f"row {index} contains a value outside 0..1 — scores must be probabilities")
        if abs(sum(row) - 1) > 1e-3:
            raise ValueError(f"row {index} does not sum to 1 (sum={sum(row):.4f}) — apply softmax first")


def expected_calibration_error(
    confidences: list[float], correct: list[bool], bins: int = ECE_BINS
) -> float:
    if len(confidences) != len(correct):
        raise ValueError("confidences and correctness must be the same length")
    if not confidences:
        raise ValueError("cannot compute ECE on an empty set")
    buckets: list[list[tuple[float, bool]]] = [[] for _ in range(bins)]
    for confidence, hit in zip(confidences, correct):
        index = min(bins - 1, int(confidence * bins))
        buckets[index].append((confidence, hit))
    total = len(confidences)
    error = 0.0
    for bucket in buckets:
        if not bucket:
            continue
        avg_conf = sum(c for c, _ in bucket) / len(bucket)
        avg_acc = sum(1 for _, h in bucket if h) / len(bucket)
        error += (len(bucket) / total) * abs(avg_acc - avg_conf)
    return error


def evaluate(
    scores: list[list[float]],
    truth: list[int],
    class_names: list[str] | None = None,
) -> Evaluation:
    _check(scores, truth)
    width = len(scores[0])
    names = class_names or [f"class_{i}" for i in range(width)]
    if len(names) != width:
        raise ValueError("class_names length does not match score width")

    correct_count = 0
    top5_count = 0
    confidences: list[float] = []
    correctness: list[bool] = []
    confusion: dict[str, dict[str, int]] = {name: {} for name in names}
    true_pos = {i: 0 for i in range(width)}
    pred_pos = {i: 0 for i in range(width)}
    support = {i: 0 for i in range(width)}

    for row, actual in zip(scores, truth):
        if not 0 <= actual < width:
            raise ValueError(f"label index {actual} outside 0..{width - 1}")
        ranked = sorted(range(width), key=lambda i: row[i], reverse=True)
        predicted = ranked[0]
        confidences.append(row[predicted])
        hit = predicted == actual
        correctness.append(hit)
        correct_count += int(hit)
        top5_count += int(actual in ranked[: min(5, width)])
        support[actual] += 1
        pred_pos[predicted] += 1
        if hit:
            true_pos[actual] += 1
        bucket = confusion.setdefault(names[actual], {})
        bucket[names[predicted]] = bucket.get(names[predicted], 0) + 1

    per_class: dict[str, ClassScore] = {}
    for index, name in enumerate(names):
        tp = true_pos[index]
        recall = tp / support[index] if support[index] else 0.0
        precision = tp / pred_pos[index] if pred_pos[index] else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
        per_class[name] = ClassScore(name, support[index], recall, precision, f1)

    total = len(truth)
    return Evaluation(
        top1=correct_count / total,
        top5=top5_count / total,
        macro_f1=sum(c.f1 for c in per_class.values()) / len(per_class),
        per_class=per_class,
        ece=expected_calibration_error(confidences, correctness),
        confusion=confusion,
        total=total,
    )


def confusable_report(evaluation: Evaluation, groups: dict[str, list[str]], limit: int = 3) -> dict[str, list[tuple[str, int]]]:
    """Where the model actually gets confused, restricted to known-lookalike pairs."""
    report: dict[str, list[tuple[str, int]]] = {}
    for anchor, siblings in groups.items():
        row = evaluation.confusion.get(anchor, {})
        hits = sorted(((s, row.get(s, 0)) for s in siblings if row.get(s, 0)), key=lambda kv: -kv[1])
        if hits:
            report[anchor] = hits[:limit]
    return report
