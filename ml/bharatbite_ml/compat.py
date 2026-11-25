"""Runtime compatibility: ONNX Runtime Web (browser) vs TFLite (native Android).

The app has to run the *same* recognition model in two places: inside the Android
app (TFLite) and inside the PWA / TWA (a WebAssembly runtime, ONNX Runtime Web).
This module compares the two *runtimes* — not two models — using measurements
taken on real devices by:

* `ml/benchmark/ort-web-harness.html` (browser side), and
* the existing instrumented Android test
  (`adb shell am instrument -w com.bharatbite.bench/.ModelBenchmarkTest`).

It refuses to invent numbers. If either side is missing, incomplete, or was not
measured on a real device (fewer than `MIN_WARM_RUNS` warm inferences, no device
string, nulls anywhere in a measured field), the verdict is
`insufficient-data` and the command exits 1. That is the whole point: a runtime
choice made from a laptop benchmark or from a guessed number is not a decision.

Measurement shape (one file per runtime):

    {
      "schemaVersion": 1,
      "runtime": "onnxruntime-web",            // or "tflite"
      "runtimeVersion": "1.20.1",
      "model": {
        "architecture": "efficientnet_lite0_int8",
        "format": "onnx",                     // "onnx" | "tflite"
        "sizeBytes": 5123456,
        "sha256": "<64 hex>"
      },
      "measuredOn": {
        "device": "Pixel 6a",
        "os": "Android 14",
        "engine": "wasm",                     // "wasm" | "webgl" | "webgpu" | "xnnpack" | "gpu-delegate"
        "threads": 4
      },
      "measuredAt": "2026-11-25T10:00:00Z",
      "initMs": 850.0,
      "latencyP50Ms": 62.5,
      "latencyP95Ms": 94.1,
      "peakMemoryMb": 148.0,
      "warmRuns": 120,
      "integration": {"glueLines": 210, "newDependencies": 2, "extraBuildSteps": 1,
                      "nativeToolchain": false, "reusesManifestVerifier": true}
    }
"""
from __future__ import annotations

import json
from pathlib import Path

SCHEMA_VERSION = 1
MIN_WARM_RUNS = 100
RUNTIMES = ("onnxruntime-web", "tflite")

MEASURED_FIELDS = ("initMs", "latencyP50Ms", "latencyP95Ms", "peakMemoryMb")

# Integration complexity rubric. Weights are fixed so the score is auditable and
# the same arithmetic is used for both runtimes.
RUBRIC = {
    "glueLinesPerPoint": 50,  # 50 lines of glue code = 1 point
    "newDependencyPoints": 1,
    "extraBuildStepPoints": 2,
    "nativeToolchainPoints": 3,
    "missingVerifierReusePoints": 4,
}

# Quality floors that apply to *any* runtime choice; above these the runtime is not
# viable on a mid-range phone regardless of how easy it is to integrate.
MAX_P95_MS = 350.0
MAX_PEAK_MEMORY_MB = 400.0


class CompatError(ValueError):
    """A measurement file cannot be used to make a runtime decision."""


def load_measurement(path: Path | str) -> dict:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise CompatError(f"measurement file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise CompatError(f"measurement file is not valid JSON: {path}: {exc}") from exc


def validate_measurement(payload: dict) -> list[str]:
    """Return every reason this measurement cannot be used. Empty list = usable."""
    problems: list[str] = []
    if payload.get("schemaVersion") != SCHEMA_VERSION:
        problems.append(f"schemaVersion must be {SCHEMA_VERSION}")

    runtime = payload.get("runtime")
    if runtime not in RUNTIMES:
        problems.append(f"runtime must be one of {list(RUNTIMES)}")

    if not str(payload.get("runtimeVersion") or "").strip():
        problems.append("runtimeVersion is required (a runtime claim without a version is not reproducible)")
    if not str(payload.get("measuredAt") or "").strip():
        problems.append("measuredAt is required (ISO-8601 timestamp of the real run)")

    model = payload.get("model") or {}
    if not str(model.get("architecture") or "").strip():
        problems.append("model.architecture is required")
    if not isinstance(model.get("sizeBytes"), int) or model.get("sizeBytes", 0) <= 0:
        problems.append("model.sizeBytes must be a positive integer")
    digest = str(model.get("sha256") or "")
    if len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest.lower()):
        problems.append("model.sha256 must be 64 hex characters of the exact artifact measured")

    measured = payload.get("measuredOn") or {}
    if not str(measured.get("device") or "").strip():
        problems.append("measuredOn.device is required — host-CPU numbers are not evidence")
    if not str(measured.get("engine") or "").strip():
        problems.append("measuredOn.engine is required (wasm, webgl, webgpu, xnnpack, …)")
    if not isinstance(measured.get("threads"), int) or measured.get("threads", 0) < 1:
        problems.append("measuredOn.threads must be a positive integer")

    for field in MEASURED_FIELDS:
        value = payload.get(field)
        if value is None:
            problems.append(f"{field} is null — fill it from a real run")
        elif not isinstance(value, (int, float)) or value <= 0:
            problems.append(f"{field} must be a positive number")

    p50, p95 = payload.get("latencyP50Ms"), payload.get("latencyP95Ms")
    if isinstance(p50, (int, float)) and isinstance(p95, (int, float)) and p95 < p50:
        problems.append("latencyP95Ms cannot be lower than latencyP50Ms")

    warm = payload.get("warmRuns")
    if not isinstance(warm, int) or warm < MIN_WARM_RUNS:
        problems.append(f"warmRuns must be at least {MIN_WARM_RUNS} (p95 over fewer runs is noise)")

    integration = payload.get("integration") or {}
    for field in ("glueLines", "newDependencies", "extraBuildSteps"):
        if not isinstance(integration.get(field), int) or integration.get(field, -1) < 0:
            problems.append(f"integration.{field} must be a non-negative integer")
    for field in ("nativeToolchain", "reusesManifestVerifier"):
        if not isinstance(integration.get(field), bool):
            problems.append(f"integration.{field} must be true or false")
    return problems


def integration_score(integration: dict) -> float:
    """Lower is easier to ship. Deterministic, documented in RUBRIC."""
    score = integration["glueLines"] / RUBRIC["glueLinesPerPoint"]
    score += integration["newDependencies"] * RUBRIC["newDependencyPoints"]
    score += integration["extraBuildSteps"] * RUBRIC["extraBuildStepPoints"]
    if integration["nativeToolchain"]:
        score += RUBRIC["nativeToolchainPoints"]
    if not integration["reusesManifestVerifier"]:
        score += RUBRIC["missingVerifierReusePoints"]
    return round(score, 2)


def _side(payload: dict) -> dict:
    integration = payload["integration"]
    return {
        "runtime": payload["runtime"],
        "runtimeVersion": payload["runtimeVersion"],
        "engine": payload["measuredOn"]["engine"],
        "device": payload["measuredOn"]["device"],
        "modelBytes": payload["model"]["sizeBytes"],
        "initMs": payload["initMs"],
        "latencyP50Ms": payload["latencyP50Ms"],
        "latencyP95Ms": payload["latencyP95Ms"],
        "peakMemoryMb": payload["peakMemoryMb"],
        "warmRuns": payload["warmRuns"],
        "integrationScore": integration_score(integration),
        "meetsLatencyFloor": payload["latencyP95Ms"] <= MAX_P95_MS,
        "meetsMemoryFloor": payload["peakMemoryMb"] <= MAX_PEAK_MEMORY_MB,
    }


def compare(browser: dict | None, native: dict | None) -> dict:
    """Compare two measured runtimes. Never returns a choice without measurements."""
    problems: dict[str, list[str]] = {}
    for name, payload in (("browser", browser), ("native", native)):
        reasons = ["no measurement file supplied"] if payload is None else validate_measurement(payload)
        if reasons:
            problems[name] = reasons

    if problems:
        return {
            "ok": False,
            "recommendation": "insufficient-data",
            "problems": problems,
            "note": "both runtimes must be measured on a real device before a decision is made",
        }

    sides = {"browser": _side(browser), "native": _side(native)}  # type: ignore[arg-type]
    warnings: list[str] = []

    if browser["model"]["architecture"] != native["model"]["architecture"]:  # type: ignore[index]
        warnings.append("the two sides measured different architectures — not a runtime comparison")
    if browser["model"]["sha256"].lower() != native["model"]["sha256"].lower():  # type: ignore[index]
        warnings.append("the two sides measured different artifact bytes — re-run with the same model")
    if browser["measuredOn"]["device"] != native["measuredOn"]["device"]:  # type: ignore[index]
        warnings.append("measurements came from different devices — latency is not directly comparable")

    viable = [name for name, side in sides.items() if side["meetsLatencyFloor"] and side["meetsMemoryFloor"]]
    if not viable:
        recommendation = "neither-runtime-meets-the-floor"
    else:
        # cheaper integration wins; break ties on measured p95 latency
        recommendation = min(viable, key=lambda name: (sides[name]["integrationScore"], sides[name]["latencyP95Ms"]))

    return {
        "ok": bool(viable),
        "recommendation": recommendation,
        "runtimes": sides,
        "integrationRubric": RUBRIC,
        "floors": {"maxP95Ms": MAX_P95_MS, "maxPeakMemoryMb": MAX_PEAK_MEMORY_MB, "minWarmRuns": MIN_WARM_RUNS},
        "warnings": warnings,
        "notes": [
            "A runtime is only chosen from on-device measurements of the same signed artifact.",
            "Both runtimes must verify the model SHA-256 against the signed manifest; the app fails closed otherwise.",
        ],
    }


def render_markdown(result: dict) -> str:
    if not result.get("ok"):
        lines = ["# Runtime compatibility", "", "**No decision: insufficient measured data.**", ""]
        for name, reasons in (result.get("problems") or {}).items():
            lines.append(f"- {name}: " + "; ".join(reasons))
        return "\n".join(lines) + "\n"

    runtimes = result["runtimes"]
    header = "| Metric | " + " | ".join(f"{name} ({side['runtime']})" for name, side in runtimes.items()) + " |"
    sep = "| --- | " + " | ".join("---" for _ in runtimes) + " |"
    rows = [
        ("device", [side["device"] for side in runtimes.values()]),
        ("engine / threads", [side["engine"] for side in runtimes.values()]),
        ("runtime version", [side["runtimeVersion"] for side in runtimes.values()]),
        ("model size (MB)", [round(side["modelBytes"] / 1_000_000, 1) for side in runtimes.values()]),
        ("init (ms)", [side["initMs"] for side in runtimes.values()]),
        ("p50 (ms)", [side["latencyP50Ms"] for side in runtimes.values()]),
        ("p95 (ms)", [side["latencyP95Ms"] for side in runtimes.values()]),
        ("peak memory (MB)", [side["peakMemoryMb"] for side in runtimes.values()]),
        ("warm runs", [side["warmRuns"] for side in runtimes.values()]),
        ("integration score", [side["integrationScore"] for side in runtimes.values()]),
    ]
    lines = [header, sep] + [f"| {label} | " + " | ".join(str(values) for values in row) + " |" for label, row in rows]
    lines += ["", f"**Recommendation:** {result['recommendation']}", ""]
    for warning in result.get("warnings", []):
        lines.append(f"- warning: {warning}")
    return "\n".join(lines) + "\n"
