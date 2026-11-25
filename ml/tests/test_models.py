import unittest

from bharatbite_ml import models


def tensorflow_available() -> bool:
    try:
        models.require_tensorflow()
        return True
    except models.TrainingUnavailable:
        return False


class ModelBuilderContractTests(unittest.TestCase):
    def test_architecture_names_match_the_app_manifest(self):
        # packages/core/src/manifest.ts types exactly these two values.
        self.assertEqual(models.ARCHITECTURES, ("efficientnet_lite0_int8", "mobilenetv3_small_int8"))

    def test_input_shape_is_224_square(self):
        self.assertEqual(models.INPUT_SHAPE, (224, 224, 3))

    def test_unknown_architecture_is_rejected_without_tensorflow(self):
        with self.assertRaises(ValueError):
            models.build_model("resnet50", 50)

    @unittest.skipIf(tensorflow_available(), "TensorFlow present: skipping the unavailability path")
    def test_training_unavailable_explains_the_fix(self):
        with self.assertRaises(models.TrainingUnavailable) as ctx:
            models.build_model("mobilenetv3_small_int8", 50)
        message = str(ctx.exception)
        self.assertIn("requirements-train.txt", message)
        self.assertIn("ml-pipeline", message)

    @unittest.skipUnless(tensorflow_available(), "TensorFlow not installed in this environment")
    def test_both_architectures_build_and_end_in_a_softmax(self):
        for architecture in models.ARCHITECTURES:
            model = models.build_model(architecture, 50)
            self.assertEqual(model.output_shape, (None, 50))
            self.assertEqual(model.layers[-1].activation.__name__, "softmax")


if __name__ == "__main__":
    unittest.main()
