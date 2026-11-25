"""Reproducible fine-tuning run over a validated dataset manifest.

Guarantees this module tries to enforce:

  * a run cannot start unless `dataset.validate_manifest` passes — no silent
    training on a broken or unlicensed corpus;
  * the split is fixed by the manifest (no re-splitting at train time, which is
    how people accidentally leak test images into training);
  * every random source is seeded and the seed is written into the run record;
  * the run record contains the dataset digest, so a model artifact can be tied
    back to exact input bytes.

It has not been executed in this repository yet: TensorFlow is not installed in
the dev sandbox and there is no real image corpus. `--smoke-test` runs the whole
plumbing path on deterministic random tensors and explicitly does NOT write a
benchmark result.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from .dataset import DatasetReport, load_manifest, validate_manifest
from .models import ARCHITECTURES, build_model, compile_model, require_tensorflow
from .labels import load_labels

SEED = 20261125


@dataclass
class RunRecord:
    schemaVersion: int
    architecture: str
    seed: int
    startedAt: str
    finishedAt: str | None
    epochs: int
    batchSize: int
    learningRate: float
    imageSize: int
    dataset: dict
    classes: int
    checkpoint: str | None
    smokeTest: bool
    notes: str

    def as_dict(self) -> dict:
        return asdict(self)


class DatasetNotTrainable(RuntimeError):
    def __init__(self, report: DatasetReport):
        self.report = report
        super().__init__(
            "dataset failed validation: " + "; ".join(f"[{i.code}] {i.message}" for i in report.errors[:8])
        )


def _augmentation(tf):
    layers = tf.keras.layers
    return tf.keras.Sequential(
        [
            layers.RandomFlip("horizontal"),
            layers.RandomRotation(0.08),
            layers.RandomZoom(0.12),
            layers.RandomBrightness(0.15),
            layers.RandomContrast(0.15),
        ],
        name="augment",
    )


def build_datasets(tf, root: Path, manifest: dict, classes: list[str], batch_size: int, seed: int, smoke: bool):
    """Yield (train, val) datasets. Images are decoded on the fly, never cached to disk."""
    index = {label: i for i, label in enumerate(classes)}
    by_split: dict[str, list[tuple[str, int]]] = {"train": [], "val": [], "test": []}
    for image in manifest["images"]:
        by_split[image["split"]].append((str(Path(root) / image["path"]), index[image["label"]]))

    if smoke:
        # Deterministic random tensors: proves shapes, loss wiring and export
        # work. Never treated as data and never written to results.json.
        def make(split: str, count: int = 64):
            import numpy as np

            rng = np.random.default_rng(seed + len(split))
            images = rng.random((count, 224, 224, 3), dtype="float32")
            labels = rng.integers(0, len(classes), size=count)
            one_hot = tf.one_hot(labels, len(classes))
            ds = tf.data.Dataset.from_tensor_slices((images, one_hot))
            return ds.batch(batch_size)

        return make("train"), make("val"), {"train": 64, "val": 64, "test": 0}

    def loader(split: str, training: bool):
        paths = [p for p, _ in by_split[split]]
        labels = [y for _, y in by_split[split]]
        ds = tf.data.Dataset.from_tensor_slices((paths, labels))
        if training:
            ds = ds.shuffle(len(paths), seed=seed, reshuffle_each_iteration=True)
        augment = _augmentation(tf)

        def decode(path, label):
            raw = tf.io.read_file(path)
            image = tf.io.decode_image(raw, channels=3, expand_animations=False)
            image = tf.image.resize(image, (224, 224), method="bilinear")
            image = tf.cast(image, tf.float32)
            if training:
                image = augment(image, training=True)
            image = tf.clip_by_value(image, 0.0, 255.0) / 255.0
            return image, tf.one_hot(label, len(classes))

        return (
            ds.map(decode, num_parallel_calls=tf.data.AUTOTUNE)
            .batch(batch_size)
            .prefetch(tf.data.AUTOTUNE)
        )

    return loader("train", True), loader("val", False), {k: len(v) for k, v in by_split.items()}


def class_weights(counts: dict[str, int], classes: list[str]) -> dict[int, float]:
    total = sum(counts.values())
    present = max(1, len([c for c in classes if counts.get(c, 0) > 0]))
    weights = {}
    for index, label in enumerate(classes):
        count = counts.get(label, 0)
        if count:
            weights[index] = total / (present * count)
    return weights


def run(
    manifest_path: Path,
    dataset_root: Path,
    out_dir: Path,
    architecture: str = "efficientnet_lite0_int8",
    epochs: int = 20,
    batch_size: int = 32,
    learning_rate: float = 1e-3,
    seed: int = SEED,
    smoke_test: bool = False,
    verify_hashes: bool = True,
) -> RunRecord:
    if architecture not in ARCHITECTURES:
        raise ValueError(f"architecture must be one of {ARCHITECTURES}")

    label_classes = load_labels()
    classes = [cls.label for cls in label_classes]
    manifest = load_manifest(manifest_path)

    if not smoke_test:
        report = validate_manifest(manifest, dataset_root, classes, verify_hashes=verify_hashes)
        if not report.ok:
            raise DatasetNotTrainable(report)
        if len(set(manifest.get("classes", [])) - set(classes)) > 0:
            raise DatasetNotTrainable(report)
    else:
        report = DatasetReport()

    tf = require_tensorflow()
    tf.keras.utils.set_random_seed(seed)
    tf.config.experimental.enable_op_determinism()

    train_ds, val_ds, split_counts = build_datasets(tf, dataset_root, manifest, classes, batch_size, seed, smoke_test)
    model = compile_model(build_model(architecture, len(classes)), learning_rate)

    out_dir.mkdir(parents=True, exist_ok=True)
    checkpoint = out_dir / f"{architecture}-epoch{{epoch:02d}}-val{{val_accuracy:.4f}}.keras"
    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(str(checkpoint), save_best_only=True, monitor="val_accuracy", mode="max"),
        tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=4, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-6),
        tf.keras.callbacks.CSVLogger(str(out_dir / "training-log.csv")),
    ]

    record = RunRecord(
        schemaVersion=1,
        architecture=architecture,
        seed=seed,
        startedAt=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        finishedAt=None,
        epochs=epochs,
        batchSize=batch_size,
        learningRate=learning_rate,
        imageSize=224,
        dataset={
            "corpus": manifest.get("corpus"),
            "splitCounts": split_counts,
            "images": report.total_images,
            "manifest": str(manifest_path),
            "licenses": sorted({image.get("license") for image in manifest.get("images", [])}),
        },
        classes=len(classes),
        checkpoint=None,
        smokeTest=smoke_test,
        notes="smoke-test run on random tensors — NOT a trained model" if smoke_test else "",
    )

    weights = None if smoke_test else class_weights(report.per_class, classes)
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=1 if smoke_test else epochs,
        callbacks=callbacks,
        class_weight=weights,
        verbose=2,
    )

    final_path = out_dir / f"{architecture}-final.keras"
    model.save(final_path)
    record.checkpoint = str(final_path)
    record.finishedAt = datetime.now(timezone.utc).isoformat(timespec="seconds")
    (out_dir / "run-record.json").write_text(json.dumps(record.as_dict(), indent=2) + "\n", encoding="utf-8")
    (out_dir / "history.json").write_text(
        json.dumps({k: [float(v) for v in vals] for k, vals in history.history.items()}, indent=2) + "\n",
        encoding="utf-8",
    )
    if smoke_test:
        (out_dir / "SMOKE-TEST-ONLY.txt").write_text(
            "This run used random tensors. It is a plumbing check, not a trained model.\n"
            "Its weights must never be exported, published or benchmarked.\n",
            encoding="utf-8",
        )
    return record
