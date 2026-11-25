"""INT8 post-training quantization to TFLite, plus artifact measurement.

The app ships `.tflite` only. Conversion happens on the machine that produced the
checkpoint (never in the app build), and the resulting file's SHA-256 is what the
manifest signs — so the quantized bytes, not the checkpoint, are the thing the
device verifies.
"""
from __future__ import annotations

import json
from pathlib import Path

from .dataset import sha256_file
from .models import INPUT_SHAPE, TrainingUnavailable, require_tensorflow

MAX_ARTIFACT_BYTES = 25 * 1024 * 1024
REPRESENTATIVE_SAMPLES = 200


def representative_dataset(tf, manifest_path: Path, dataset_root: Path, samples: int = REPRESENTATIVE_SAMPLES):
    """Yield calibration images drawn from the *training* split only."""
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    paths = [str(Path(dataset_root) / image["path"]) for image in manifest["images"] if image["split"] == "train"]
    if not paths:
        raise ValueError("no training images available for INT8 calibration")
    if len(paths) < samples:
        raise ValueError(f"need at least {samples} calibration images, found {len(paths)}")
    selection = paths[:samples]
    import numpy as np

    def gen():
        for path in selection:
            raw = tf.io.read_file(path)
            image = tf.io.decode_image(raw, channels=3, expand_animations=False)
            image = tf.image.resize(image, INPUT_SHAPE[:2], method="bilinear")
            batch = tf.expand_dims(tf.cast(image, tf.float32) / 255.0, 0)
            yield [np.array(batch, dtype="float32")]

    return gen


def convert(checkpoint: Path, out_path: Path, manifest_path: Path | None = None, dataset_root: Path | None = None,
            representative_samples: int = REPRESENTATIVE_SAMPLES) -> dict:
    tf = require_tensorflow()
    model = tf.keras.models.load_model(str(checkpoint))
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]

    if manifest_path and dataset_root:
        converter.representative_dataset = representative_dataset(tf, manifest_path, dataset_root, representative_samples)
        converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
        # int8 input/output keeps the Kotlin pre-processing path simple; float
        # fallback is refused on purpose so we notice a model that cannot run
        # fully quantized on mid-range phones.
        converter.inference_input_type = tf.int8
        converter.inference_output_type = tf.int8
    else:
        converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]

    payload = converter.convert()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(payload)

    interpreter = tf.lite.Interpreter(model_content=payload)
    interpreter.allocate_tensors()
    details = interpreter.get_input_details()[0]
    return {
        "path": str(out_path),
        "sizeBytes": len(payload),
        "sha256": sha256_file(out_path),
        "inputDtype": str(details["dtype"].__name__),
        "inputShape": [int(v) for v in details["shape"]],
        "fullyQuantized": bool(manifest_path and dataset_root),
        "withinSizeBudget": len(payload) <= MAX_ARTIFACT_BYTES,
    }


def describe_dependencies() -> str:
    return (
        "quantization needs TensorFlow (ml/requirements-train.txt). "
        f"tensorflow import state: {_tf_state()}"
    )


def _tf_state() -> str:
    try:
        require_tensorflow()
        return "available"
    except TrainingUnavailable as exc:
        return f"unavailable ({exc})"
