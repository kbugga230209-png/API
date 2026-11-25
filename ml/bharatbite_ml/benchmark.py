"""Benchmark gate for the two candidate architectures.

The comparison only exists once real measurements exist. This module refuses to
render a table from anything that is not an actual evaluation run, and it is the
only place that decides whether a model may be promoted to the app.

Results file shape (ml/benchmark/results.json):

    {
      "schemaVersion": 1,
      "evaluatedOn": {"corpus": "inference-corpus-v1", "split": "test", "images": 3120},
      "device": "Pixel 6a, arm64, 4 threads, TFLite XNNPACK",
      "models": [
        {
          "architecture": "efficientnet_lite0_int8",
          "format": "tflite",
          "trained": true,
          "sizeBytes": 4831232,
          "top1": 0.812,
          "top5": 0.944,
          "latencyP50Ms": 41.2,
          "latencyP95Ms": 63.8,
          "artifactSha256": "…64 hex…",
          "trainedAt": "2026-12-01T10:00:00Z",
          "notes": "…"
        }
      ]
    }
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

REQUIRED_MODEL_FIELDS = (
    "architecture",
    "format",
    "trained",
    "sizeBytes",
    "top1",
    "top5",
    "latencyP50Ms",
    "latencyP95Ms",
    "artifactSha256",
)

# Promotion thresholds. A model that misses any of these stays out of the app;
# the app falls back to search, which is always available.
GATES = {
    "min_top1": 0.75,
    "min_top5": 0.90,
    "max_latency_p95_ms": 350.0,
    "max_size_mb": 25.0,
}


class BenchmarkIncomplete(RuntimeError):
    """Raised when a results file cannot honestly be turned into a comparison."""


@dataclass(frozen=True)
class ModelResult:
    architecture: str
    format: str
    size_bytes: int
    top1: float
    top5: float
    latency_p50_ms: float
    latency_p95_ms: float
    artifact_sha256: str

    @property
    def size_mb(self) -> float:
        return self.size_bytes / (1024 * 1024)

    def gate_failures(self, gates: dict[str, float] | None = None) -> list[str]:
        limits = gates or GATES
        failures = []
        if self.top1 < limits["min_top1"]:
            failures.append(f"top1 {self.top1:.3f} < {limits['min_top1']}")
        if self.top5 < limits["min_top5"]:
            failures.append(f"top5 {self.top5:.3f} < {limits['min_top5']}")
        if self.latency_p95_ms > limits["max_latency_p95_ms"]:
            failures.append(f"p95 {self.latency_p95_ms:.1f} ms > {limits['max_latency_p95_ms']}")
        if self.size_mb > limits["max_size_mb"]:
            failures.append(f"size {self.size_mb:.1f} MB > {limits['max_size_mb']}")
        return failures

    @property
    def promotable(self) -> bool:
        return not self.gate_failures()


def load_results(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def parse_results(payload: dict) -> tuple[list[ModelResult], dict]:
    if payload.get("schemaVersion") != 1:
        raise BenchmarkIncomplete("results.schemaVersion must be 1")
    models = payload.get("models") or []
    if not models:
        raise BenchmarkIncomplete("results file has no models — nothing has been evaluated")

    parsed: list[ModelResult] = []
    problems: list[str] = []
    for index, model in enumerate(models):
        missing = [f for f in REQUIRED_MODEL_FIELDS if model.get(f) in (None, "")]
        if missing:
            problems.append(f"models[{index}] ({model.get('architecture', '?')}) missing {missing}")
            continue
        if model.get("trained") is not True:
            problems.append(
                f"models[{index}] ({model.get('architecture')}) is not marked trained — "
                "an untrained or unverified artifact must never be benchmarked or published"
            )
            continue
        sha = str(model.get("artifactSha256", "")).lower()
        if len(sha) != 64 or any(c not in "0123456789abcdef" for c in sha):
            problems.append(f"models[{index}] artifactSha256 is not 64 hex characters")
            continue
        parsed.append(
            ModelResult(
                architecture=str(model["architecture"]),
                format=str(model["format"]),
                size_bytes=int(model["sizeBytes"]),
                top1=float(model["top1"]),
                top5=float(model["top5"]),
                latency_p50_ms=float(model["latencyP50Ms"]),
                latency_p95_ms=float(model["latencyP95Ms"]),
                artifact_sha256=sha,
            )
        )

    if problems:
        raise BenchmarkIncomplete("; ".join(problems))
    evaluated = payload.get("evaluatedOn") or {}
    if not evaluated.get("images") or not evaluated.get("split"):
        raise BenchmarkIncomplete("results.evaluatedOn must record the split and image count")
    return parsed, evaluated


def compare(payload: dict, gates: dict[str, float] | None = None) -> dict:
    models, evaluated = parse_results(payload)
    limits = gates or GATES
    by_top1 = max(models, key=lambda m: m.top1)
    by_latency = min(models, key=lambda m: m.latency_p95_ms)
    by_size = min(models, key=lambda m: m.size_bytes)
    promotable = [m for m in models if m.gate_failures(limits) == []]
    recommended = None
    if promotable:
        # Prefer accuracy among models that pass every gate, with latency as the
        # tie-breaker — a 0.3 MB win is not worth 100 ms on a mid-range phone.
        recommended = sorted(promotable, key=lambda m: (-m.top1, m.latency_p95_ms))[0]
    return {
        "evaluatedOn": evaluated,
        "models": models,
        "accuracyWinner": by_top1.architecture,
        "latencyWinner": by_latency.architecture,
        "sizeWinner": by_size.architecture,
        "recommended": recommended.architecture if recommended else None,
        "gateFailures": {m.architecture: m.gate_failures(limits) for m in models},
        "gates": limits,
    }


def render_markdown(result: dict) -> str:
    lines = [
        "| Model | Format | Size | Top-1 | Top-5 | p50 | p95 | Gates |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for model in result["models"]:
        failures = result["gateFailures"][model.architecture]
        status = "pass" if not failures else "; ".join(failures)
        lines.append(
            f"| {model.architecture} | {model.format} | {model.size_mb:.1f} MB | "
            f"{model.top1:.3f} | {model.top5:.3f} | {model.latency_p50_ms:.1f} ms | "
            f"{model.latency_p95_ms:.1f} ms | {status} |"
        )
    evaluated = result["evaluatedOn"]
    lines.append("")
    lines.append(f"Evaluated on `{evaluated.get('corpus')}` / `{evaluated.get('split')}` ({evaluated.get('images')} images).")
    lines.append(f"Recommended for the app: **{result['recommended'] or 'none — no model passes the gates'}**.")
    return "\n".join(lines)


def template() -> dict:
    """An empty results file with every field explained. Not data."""
    return {
        "schemaVersion": 1,
        "evaluatedOn": {"corpus": "TODO", "split": "test", "images": 0},
        "device": "TODO: device + delegate + thread count",
        "models": [
            {
                "architecture": "efficientnet_lite0_int8",
                "format": "tflite",
                "trained": False,
                "sizeBytes": 0,
                "top1": None,
                "top5": None,
                "latencyP50Ms": None,
                "latencyP95Ms": None,
                "artifactSha256": "",
                "trainedAt": None,
                "notes": "Fill from a real evaluation run. `trained: false` is rejected on purpose.",
            },
            {
                "architecture": "mobilenetv3_small_int8",
                "format": "tflite",
                "trained": False,
                "sizeBytes": 0,
                "top1": None,
                "top5": None,
                "latencyP50Ms": None,
                "latencyP95Ms": None,
                "artifactSha256": "",
                "trainedAt": None,
                "notes": "Fill from a real evaluation run.",
            },
        ],
    }
