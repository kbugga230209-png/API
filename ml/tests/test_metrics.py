import unittest

from bharatbite_ml.metrics import confusable_report, evaluate, expected_calibration_error


class MetricsTests(unittest.TestCase):
    def setUp(self):
        self.classes = ["thepla", "khakhra", "roti"]

    def test_perfect_predictions(self):
        scores = [[0.9, 0.05, 0.05], [0.1, 0.8, 0.1], [0.2, 0.1, 0.7]]
        result = evaluate(scores, [0, 1, 2], self.classes)
        self.assertEqual(result.top1, 1.0)
        self.assertEqual(result.macro_f1, 1.0)
        self.assertLess(result.ece, 0.35)

    def test_top5_clips_at_width(self):
        result = evaluate([[0.6, 0.4], [0.3, 0.7]], [0, 1], ["a", "b"])
        self.assertEqual(result.top1, 1.0)
        self.assertEqual(result.top5, 1.0)

    def test_wrong_prediction_lowers_top1(self):
        scores = [[0.2, 0.7, 0.1], [0.9, 0.05, 0.05]]
        result = evaluate(scores, [0, 0], self.classes)
        self.assertAlmostEqual(result.top1, 0.5)
        self.assertEqual(result.per_class["thepla"].recall, 0.5)
        self.assertEqual(result.per_class["khakhra"].precision, 0.0)

    def test_macro_f1_balances_classes(self):
        # class 0 always right, class 1 always wrong: macro-F1 must sit between
        scores = [[0.9, 0.1], [0.8, 0.2]]
        result = evaluate(scores, [0, 1], ["a", "b"])
        self.assertAlmostEqual(result.per_class["a"].f1, 2 / 3)
        self.assertEqual(result.per_class["b"].f1, 0.0)
        self.assertAlmostEqual(result.macro_f1, (2 / 3) / 2)

    def test_confusion_matrix_counts(self):
        result = evaluate([[0.9, 0.1], [0.8, 0.2]], [0, 1], ["a", "b"])
        self.assertEqual(result.confusion["b"]["a"], 1)
        self.assertEqual(result.confusion["a"]["a"], 1)

    def test_ece_zero_when_confidence_equals_accuracy(self):
        ece = expected_calibration_error([1.0, 1.0], [True, True])
        self.assertAlmostEqual(ece, 0.0)

    def test_ece_positive_when_overconfident(self):
        ece = expected_calibration_error([0.99, 0.99], [False, False])
        self.assertGreater(ece, 0.9)

    def test_ece_requires_matching_lengths(self):
        with self.assertRaises(ValueError):
            expected_calibration_error([0.5], [True, False])

    def test_floor_failures_surface_weak_classes(self):
        scores = [[0.1, 0.9], [0.9, 0.1], [0.2, 0.8], [0.3, 0.7], [0.4, 0.6], [0.45, 0.55]]
        result = evaluate(scores, [0, 0, 0, 0, 1, 1], ["a", "b"])
        failures = result.floor_failures(floor=0.9, min_support=2)
        self.assertEqual([c.label for c in failures], ["a"])

    def test_non_probability_rows_rejected(self):
        with self.assertRaises(ValueError):
            evaluate([[1.4, -0.4]], [0], ["a", "b"])
        with self.assertRaises(ValueError):
            evaluate([[0.5, 0.6]], [0], ["a", "b"])

    def test_empty_evaluation_rejected(self):
        with self.assertRaises(ValueError):
            evaluate([], [], ["a"])

    def test_ragged_rows_rejected(self):
        with self.assertRaises(ValueError):
            evaluate([[0.5, 0.5], [1.0]], [0, 0], ["a", "b"])

    def test_out_of_range_label_rejected(self):
        with self.assertRaises(ValueError):
            evaluate([[0.5, 0.5]], [3], ["a", "b"])

    def test_confusable_report_restricted_to_known_pairs(self):
        scores = [[0.4, 0.5, 0.1], [0.5, 0.4, 0.1]]
        result = evaluate(scores, [0, 0], ["thepla", "khakhra", "roti"])
        report = confusable_report(result, {"thepla": ["khakhra"]})
        self.assertEqual(report["thepla"], [("khakhra", 1)])

    def test_as_dict_rounds_and_sorts(self):
        result = evaluate([[0.9, 0.1], [0.2, 0.8]], [0, 1], ["a", "b"])
        payload = result.as_dict()
        self.assertEqual(list(payload["perClass"]), ["a", "b"])
        self.assertIn("ece", payload)
        self.assertEqual(payload["total"], 2)


if __name__ == "__main__":
    unittest.main()
