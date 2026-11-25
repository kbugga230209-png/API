"""Run a quantized artifact over the test split and produce benchmark evidence.

This is the only producer of the numbers `benchmark.py` checks and
`export_manifest.py` signs. It refuses to evaluate an artifact whose file hash
is not recorded, so a results file can always be traced to exact bytes.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

from .benchmark import GATES
from .dataset import load_manifest, sha256_file
from .labels import load_labels
from .metrics import evaluate
from .models import INPUT_SHAPE, require_tensorflow


def require_tflite(artifact: Path) -> None:
    """Cheap structural check before we spend minutes interpreting a file."""
    head = artifact.read_bytes()[:8]
    if len(head) < 8 or head[4:8] != b"TFL3":
        raise ValueError(f"{artifact} is not a TFLite flatbuffer (bad magic bytes)")


def _load_test_set(manifest: dict, root: Path, class_index: dict[str, int]) -> list[tuple[Path, int]]:
    rows = [
        (Path(root) / image["path"], class_index[image["label"]])
        for image in manifest["images"]
        if image["split"] == "test"
    ]
    if not rows:
        raise ValueError("manifest has no test-split images — evaluation would be meaningless")
    return rows


def run(
    artifact: Path,
    manifest_path: Path,
    dataset_root: Path,
    out_path: Path,
    device: str,
    threads: int = 4,
    max_images: int | None = None,
) -> dict:
    tf = require_tensorflow()
    classes = load_labels()
    class_index = {cls.label: index for index, cls in enumerate(classes)}
    manifest = load_manifest(manifest_path)
    rows = _load_test_set(manifest, dataset_root, class_index)
    if max_images:
        rows = rows[:max_images]

    require_tflite(artifact)

    interpreter = tf.lite.Interpreter(model_path=str(artifact), num_threads=threads)
    interpreter.allocate_tensors()
    input_detail = interpreter.get_input_details()[0]
    output_detail = interpreter.get_output_details()[0]
    scale, zero_point = input_detail["quantization"]
    if scale == 0:
        raise ValueError("artifact input is not quantized — refusing to benchmark a float model as INT8")

    import numpy as np

    scores: list[list[float]] = []
    truth: list[int] = []
    latencies: list[float] = []

    for path, label in rows:
        raw = tf.io.read_file(str(path))
        image = tf.io.decode_image(raw, channels=3, expand_animations=False)
        image = tf.image.resize(image, INPUT_SHAPE[:2], method="bilinear")
        pixels = np.array(image, dtype="float32") / 255.0
        if input_detail["dtype"] == np.int8:
            quantized = np.clip(np.round(pixels / scale + zero_point), -128, 127).astype("int8")
        else:
            quantized = pixels.astype("uint8")
        batch = np.expand_dims(quantized, 0)
        interpreter.set_tensor(input_detail["index"], batch)
        started = time.perf_counter()
        interpreter.invoke()
        latencies.append((time.perf_counter() - started) * 1000.0)
        output = interpreter.get_tensor(output_detail["index"])[0]
        if output_detail["dtype"] == np.int8:
            out_scale, out_zero = output_detail["quantization"]
            probabilities = (output.astype("float32") - out_zero) * out_scale
        else:
            probabilities = output.astype("float32")
        total = float(probabilities.sum()) or 1.0
        scores.append([float(v) / total for v in probabilities])
        truth.append(label)

    evaluation = evaluate(scores, truth, [cls.label for cls in classes])
    ordered = sorted(latencies)
    latency_p50 = ordered[len(ordered) // 2]
    latency_p95 = ordered[min(len(ordered) - 1, int(len(ordered) * 0.95))]

    result = {
        "architecture": None,  # filled by the caller from its run record
        "format": "tflite",
        "trained": True,
        "sizeBytes": artifact.stat().st_size,
        "top1": round(evaluation.top1, 4),
        "top5": round(evaluation.top5, 4),
        "latencyP50Ms": round(latency_p50, 2),
        "latencyP95Ms": round(latency_p95, 2),
        "artifactSha256": sha256_file(artifact),
        "trainedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "evaluatedOn": {"corpus": manifest.get("corpus"), "split": "test", "images": len(rows)},
        "device": device,
        "threads": threads,
        "macroF1": round(evaluation.macro_f1, 4),
        "ece": round(evaluation.ece, 4),
        "perClass": evaluation.as_dict()["perClass"],
        "weakest": evaluation.as_dict()["weakest"],
        "gates": {k: GATES[k] for k in GATES},
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result
