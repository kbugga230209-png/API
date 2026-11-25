"""TensorFlow model builders for the two candidate architectures.

Both candidates are mobile-first and INT8-quantizable:

  * `mobilenetv3_small_int8`  — tf.keras.applications.MobileNetV3Small, 224².
  * `efficientnet_lite0_int8` — EfficientNet-Lite0: the B0 backbone with all
    squeeze-excite blocks removed and Swish replaced by ReLU6, which is what
    makes it behave well under post-training INT8 quantization.

TensorFlow is imported lazily: importing this module on a machine without TF is
fine, calling `build_model` there raises `TrainingUnavailable` with a pointer to
`ml/requirements-train.txt`. Nothing here has ever been executed in this
repository's sandbox — it is unverified until the `ml-pipeline` CI job or an
owner machine runs it.
"""
from __future__ import annotations

ARCHITECTURES = ("efficientnet_lite0_int8", "mobilenetv3_small_int8")
INPUT_SIZE = 224
INPUT_SHAPE = (INPUT_SIZE, INPUT_SIZE, 3)


class TrainingUnavailable(RuntimeError):
    """TensorFlow is not installed in this environment."""


def require_tensorflow():
    try:
        import tensorflow as tf  # noqa: F401  (presence check)
    except Exception as exc:  # pragma: no cover - depends on environment
        raise TrainingUnavailable(
            "TensorFlow is required for training/quantization. Install with "
            "`pip install -r ml/requirements-train.txt` on a machine with a GPU, "
            "or run the `ml-pipeline` GitHub Actions workflow. "
            f"(import error: {exc})"
        ) from exc
    import tensorflow as tf

    return tf


def _conv_bn_act(tf, x, filters, kernel, strides, name, activation="relu6"):
    layers = tf.keras.layers
    x = layers.Conv2D(
        filters,
        kernel,
        strides,
        padding="same",
        use_bias=False,
        name=f"{name}_conv",
    )(x)
    x = layers.BatchNormalization(momentum=0.99, epsilon=1e-3, name=f"{name}_bn")(x)
    if activation:
        x = layers.Activation(activation, name=f"{name}_act")(x)
    return x


def _mbconv(tf, x, expand, out_channels, kernel, strides, block_id):
    """Inverted residual block without squeeze-excite (Lite variant)."""
    layers = tf.keras.layers
    in_channels = x.shape[-1]
    prefix = f"block{block_id}"
    y = x
    if expand != in_channels:
        y = _conv_bn_act(tf, y, expand, 1, 1, f"{prefix}_expand")
    y = layers.DepthwiseConv2D(
        kernel,
        strides=strides,
        padding="same",
        use_bias=False,
        name=f"{prefix}_dw",
    )(y)
    y = layers.BatchNormalization(momentum=0.99, epsilon=1e-3, name=f"{prefix}_dw_bn")(y)
    y = layers.Activation("relu6", name=f"{prefix}_dw_act")(y)
    y = layers.Conv2D(
        out_channels,
        1,
        padding="same",
        use_bias=False,
        name=f"{prefix}_project",
    )(y)
    y = layers.BatchNormalization(momentum=0.99, epsilon=1e-3, name=f"{prefix}_project_bn")(y)
    if strides == 1 and in_channels == out_channels:
        return layers.Add(name=f"{prefix}_add")([x, y])
    return y


# (expand_ratio, out_channels, kernel, strides, repeats) for B0/Lite0 at width 1.0
LITE0_STAGES = (
    (1, 16, 3, 1, 1),
    (6, 24, 3, 2, 2),
    (6, 40, 5, 2, 2),
    (6, 80, 3, 2, 3),
    (6, 112, 5, 1, 3),
    (6, 192, 5, 2, 4),
    (6, 320, 3, 1, 1),
)


def build_efficientnet_lite0(tf, num_classes: int, dropout: float = 0.2, name: str = "efficientnet_lite0"):
    layers = tf.keras.layers
    inputs = layers.Input(shape=INPUT_SHAPE, name="image")
    x = layers.Rescaling(1.0 / 255.0, name="normalize")(inputs)
    x = _conv_bn_act(tf, x, 32, 3, 2, "stem")
    block_id = 0
    for expand_ratio, out_channels, kernel, strides, repeats in LITE0_STAGES:
        in_channels = x.shape[-1]
        expand = in_channels * expand_ratio
        for repeat in range(repeats):
            x = _mbconv(
                tf,
                x,
                expand,
                out_channels,
                kernel,
                strides if repeat == 0 else 1,
                block_id,
            )
            block_id += 1
    x = _conv_bn_act(tf, x, 1280, 1, 1, "head_conv")
    x = layers.GlobalAveragePooling2D(name="gap")(x)
    if dropout:
        x = layers.Dropout(dropout, name="dropout")(x)
    outputs = layers.Dense(num_classes, activation="softmax", dtype="float32", name="predictions")(x)
    return tf.keras.Model(inputs, outputs, name=name)


def build_mobilenetv3_small(tf, num_classes: int, dropout: float = 0.2, name: str = "mobilenetv3_small"):
    base = tf.keras.applications.MobileNetV3Small(
        input_shape=INPUT_SHAPE,
        include_top=False,
        weights=None,
        include_preprocessing=True,
        alpha=1.0,
        minimalistic=False,
    )
    base._name = f"{name}_backbone"
    inputs = base.inputs[0]
    features = tf.keras.layers.GlobalAveragePooling2D(name="gap")(base.output)
    scaled = tf.keras.layers.Rescaling(2.0, offset=-1.0, name="logit_scale")(features)
    x = tf.keras.layers.Dropout(dropout, name="dropout")(scaled)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax", dtype="float32", name="predictions")(x)
    return tf.keras.Model(inputs, outputs, name=name)


def build_model(architecture: str, num_classes: int, dropout: float = 0.2):
    if architecture not in ARCHITECTURES:
        raise ValueError(f"unknown architecture {architecture!r}; expected one of {ARCHITECTURES}")
    tf = require_tensorflow()
    if architecture == "efficientnet_lite0_int8":
        return build_efficientnet_lite0(tf, num_classes, dropout)
    return build_mobilenetv3_small(tf, num_classes, dropout)


def compile_model(model, learning_rate: float = 1e-3, label_smoothing: float = 0.05):
    tf = require_tensorflow()
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=label_smoothing),
        metrics=[
            tf.keras.metrics.CategoricalAccuracy(name="accuracy"),
            tf.keras.metrics.TopKCategoricalAccuracy(k=5, name="top5"),
        ],
    )
    return model
