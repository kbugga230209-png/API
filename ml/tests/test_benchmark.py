import copy
import unittest

from bharatbite_ml.benchmark import (
    BenchmarkIncomplete,
    ModelResult,
    compare,
    parse_results,
    render_markdown,
    template,
)

SHA = "a" * 64
GOOD = {
    "schemaVersion": 1,
    "evaluatedOn": {"corpus": "inference-corpus-v1", "split": "test", "images": 3120},
    "device": "Pixel 6a",
    "models": [
        {
            "architecture": "efficientnet_lite0_int8",
            "format": "tflite",
            "trained": True,
            "sizeBytes": 4700000,
            "top1": 0.81,
            "top5": 0.95,
            "latencyP50Ms": 40.0,
            "latencyP95Ms": 62.0,
            "artifactSha256": SHA,
        },
        {
            "architecture": "mobilenetv3_small_int8",
            "format": "tflite",
            "trained": True,
            "sizeBytes": 3100000,
            "top1": 0.78,
            "top5": 0.93,
            "latencyP50Ms": 26.0,
            "latencyP95Ms": 41.0,
            "artifactSha256": "b" * 64,
        },
    ],
}


class BenchmarkGateTests(unittest.TestCase):
    def test_template_is_not_evidence(self):
        with self.assertRaises(BenchmarkIncomplete) as ctx:
            parse_results(template())
        message = str(ctx.exception)
        self.assertTrue("missing" in message or "not marked trained" in message, message)

    def test_untrained_model_is_rejected(self):
        payload = copy.deepcopy(GOOD)
        payload["models"][0]["trained"] = False
        with self.assertRaises(BenchmarkIncomplete) as ctx:
            parse_results(payload)
        self.assertIn("never be benchmarked", str(ctx.exception))

    def test_missing_metric_is_rejected(self):
        payload = copy.deepcopy(GOOD)
        payload["models"][0]["top1"] = None
        with self.assertRaises(BenchmarkIncomplete) as ctx:
            parse_results(payload)
        self.assertIn("missing", str(ctx.exception))

    def test_bad_artifact_hash_is_rejected(self):
        payload = copy.deepcopy(GOOD)
        payload["models"][0]["artifactSha256"] = "zz"
        with self.assertRaises(BenchmarkIncomplete):
            parse_results(payload)

    def test_missing_evaluated_on_is_rejected(self):
        payload = copy.deepcopy(GOOD)
        payload["evaluatedOn"] = {"split": "test", "images": 0}
        with self.assertRaises(BenchmarkIncomplete):
            parse_results(payload)

    def test_empty_model_list_is_rejected(self):
        payload = copy.deepcopy(GOOD)
        payload["models"] = []
        with self.assertRaises(BenchmarkIncomplete):
            parse_results(payload)

    def test_compare_picks_most_accurate_passing_model(self):
        result = compare(GOOD)
        self.assertEqual(result["recommended"], "efficientnet_lite0_int8")
        self.assertEqual(result["accuracyWinner"], "efficientnet_lite0_int8")
        self.assertEqual(result["latencyWinner"], "mobilenetv3_small_int8")
        self.assertEqual(result["sizeWinner"], "mobilenetv3_small_int8")
        self.assertTrue(all(v == [] for v in result["gateFailures"].values()))

    def test_accuracy_below_gate_blocks_promotion(self):
        payload = copy.deepcopy(GOOD)
        payload["models"][0]["top1"] = 0.62
        result = compare(payload)
        self.assertEqual(result["recommended"], "mobilenetv3_small_int8")
        self.assertTrue(result["gateFailures"]["efficientnet_lite0_int8"])

    def test_nothing_recommended_when_all_fail(self):
        payload = copy.deepcopy(GOOD)
        for model in payload["models"]:
            model["top1"] = 0.4
        result = compare(payload)
        self.assertIsNone(result["recommended"])
        self.assertIn("none", render_markdown(result))

    def test_latency_gate(self):
        model = ModelResult("efficientnet_lite0_int8", "tflite", 4_000_000, 0.9, 0.99, 10.0, 900.0, SHA)
        self.assertTrue(any("p95" in failure for failure in model.gate_failures()))

    def test_size_gate(self):
        model = ModelResult("efficientnet_lite0_int8", "tflite", 40 * 1024 * 1024, 0.9, 0.99, 10.0, 20.0, SHA)
        self.assertTrue(any("size" in failure for failure in model.gate_failures()))
        self.assertFalse(model.promotable)

    def test_markdown_contains_header_and_verdict(self):
        markdown = render_markdown(compare(GOOD))
        self.assertIn("| Model | Format | Size | Top-1 |", markdown)
        self.assertIn("inference-corpus-v1", markdown)
        self.assertIn("efficientnet_lite0_int8", markdown)


if __name__ == "__main__":
    unittest.main()
