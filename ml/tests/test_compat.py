import json
import unittest
from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory

from bharatbite_ml.compat import (
    MAX_P95_MS,
    MIN_WARM_RUNS,
    RUBRIC,
    CompatError,
    compare,
    integration_score,
    load_measurement,
    render_markdown,
    validate_measurement,
)

SHA = "a" * 64


def measurement(**overrides):
    payload = {
        "schemaVersion": 1,
        "runtime": "onnxruntime-web",
        "runtimeVersion": "1.20.1",
        "model": {"architecture": "efficientnet_lite0_int8", "format": "onnx", "sizeBytes": 5_123_456, "sha256": SHA},
        "measuredOn": {"device": "Pixel 6a", "os": "Android 14", "engine": "wasm", "threads": 4},
        "measuredAt": "2026-11-25T10:00:00Z",
        "initMs": 850.0,
        "latencyP50Ms": 62.5,
        "latencyP95Ms": 94.1,
        "peakMemoryMb": 148.0,
        "warmRuns": 120,
        "integration": {
            "glueLines": 200,
            "newDependencies": 1,
            "extraBuildSteps": 0,
            "nativeToolchain": False,
            "reusesManifestVerifier": True,
        },
    }
    payload.update(overrides)
    return payload


class ValidateTests(unittest.TestCase):
    def test_a_real_measurement_is_accepted(self):
        self.assertEqual(validate_measurement(measurement()), [])

    def test_nulls_are_rejected(self):
        for field in ("initMs", "latencyP50Ms", "latencyP95Ms", "peakMemoryMb"):
            with self.subTest(field=field):
                problems = validate_measurement(measurement(**{field: None}))
                self.assertTrue(any(field in problem for problem in problems), problems)

    def test_too_few_warm_runs(self):
        problems = validate_measurement(measurement(warmRuns=MIN_WARM_RUNS - 1))
        self.assertTrue(any("warmRuns" in problem for problem in problems))

    def test_host_cpu_measurement_without_a_device_is_rejected(self):
        payload = measurement()
        payload["measuredOn"] = dict(payload["measuredOn"], device="")
        self.assertTrue(any("device" in problem for problem in validate_measurement(payload)))

    def test_artifact_hash_must_be_exact(self):
        for digest in ("", "abc", "z" * 64):
            with self.subTest(digest=digest):
                payload = measurement()
                payload["model"] = dict(payload["model"], sha256=digest)
                self.assertTrue(any("sha256" in problem for problem in validate_measurement(payload)))

    def test_p95_below_p50_is_rejected(self):
        problems = validate_measurement(measurement(latencyP50Ms=120.0, latencyP95Ms=80.0))
        self.assertTrue(any("P95" in problem for problem in problems))

    def test_unknown_runtime_and_missing_version(self):
        self.assertTrue(any("runtime" in problem for problem in validate_measurement(measurement(runtime="tensorflow-js"))))
        self.assertTrue(
            any("runtimeVersion" in problem for problem in validate_measurement(measurement(runtimeVersion=" ")))
        )

    def test_integration_fields_must_be_explicit(self):
        payload = measurement()
        payload["integration"] = {"glueLines": 10}
        problems = validate_measurement(payload)
        self.assertTrue(any("newDependencies" in problem for problem in problems))
        self.assertTrue(any("nativeToolchain" in problem for problem in problems))

    def test_missing_file_raises(self):
        with self.assertRaises(CompatError):
            load_measurement(Path("/nonexistent/compat.json"))

    def test_invalid_json_raises(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "bad.json"
            path.write_text("{not json", encoding="utf-8")
            with self.assertRaises(CompatError):
                load_measurement(path)


class ScoreTests(unittest.TestCase):
    def test_score_is_monotonic_in_every_cost(self):
        base = measurement()["integration"]
        baseline = integration_score(base)
        self.assertLess(baseline, integration_score(dict(base, glueLines=base["glueLines"] + 500)))
        self.assertLess(baseline, integration_score(dict(base, newDependencies=base["newDependencies"] + 1)))
        self.assertLess(baseline, integration_score(dict(base, extraBuildSteps=base["extraBuildSteps"] + 1)))
        self.assertLess(baseline, integration_score(dict(base, nativeToolchain=True)))
        self.assertLess(baseline, integration_score(dict(base, reusesManifestVerifier=False)))

    def test_score_arithmetic_matches_the_published_rubric(self):
        integration = {
            "glueLines": 100,
            "newDependencies": 2,
            "extraBuildSteps": 1,
            "nativeToolchain": True,
            "reusesManifestVerifier": False,
        }
        expected = (
            100 / RUBRIC["glueLinesPerPoint"]
            + 2 * RUBRIC["newDependencyPoints"]
            + 1 * RUBRIC["extraBuildStepPoints"]
            + RUBRIC["nativeToolchainPoints"]
            + RUBRIC["missingVerifierReusePoints"]
        )
        self.assertAlmostEqual(integration_score(integration), round(expected, 2))

    def test_zero_side_effects_runtime_scores_zero(self):
        self.assertEqual(
            integration_score(
                {
                    "glueLines": 0,
                    "newDependencies": 0,
                    "extraBuildSteps": 0,
                    "nativeToolchain": False,
                    "reusesManifestVerifier": True,
                }
            ),
            0.0,
        )


class CompareTests(unittest.TestCase):
    def native(self, **overrides):
        payload = measurement(
            runtime="tflite",
            runtimeVersion="2.16.1",
            model={"architecture": "efficientnet_lite0_int8", "format": "tflite", "sizeBytes": 4_831_232, "sha256": SHA},
            measuredOn={"device": "Pixel 6a", "os": "Android 14", "engine": "xnnpack", "threads": 4},
            **overrides,
        )
        return payload

    def test_no_measurements_means_no_decision(self):
        result = compare(None, None)
        self.assertFalse(result["ok"])
        self.assertEqual(result["recommendation"], "insufficient-data")
        self.assertIn("browser", result["problems"])
        self.assertIn("native", result["problems"])

    def test_one_sided_data_is_not_enough(self):
        result = compare(measurement(), None)
        self.assertFalse(result["ok"])
        self.assertEqual(result["recommendation"], "insufficient-data")
        self.assertNotIn("runtimes", result)

    def test_incomplete_native_side_blocks_the_decision(self):
        broken = deepcopy(self.native())
        broken["peakMemoryMb"] = None
        result = compare(measurement(), broken)
        self.assertFalse(result["ok"])
        self.assertEqual(result["recommendation"], "insufficient-data")

    def test_recommendation_follows_integration_then_latency(self):
        result = compare(measurement(), self.native())
        self.assertTrue(result["ok"])
        self.assertEqual(result["recommendation"], "browser", "equal latency, browser integration is cheaper here")

    def test_slower_native_but_cheaper_integration_wins(self):
        native = self.native()
        native["integration"] = dict(native["integration"], glueLines=0, newDependencies=0)
        result = compare(measurement(), native)
        self.assertEqual(result["recommendation"], "native")

    def test_a_runtime_over_the_latency_floor_is_not_viable(self):
        slow = measurement(initMs=900.0, latencyP50Ms=MAX_P95_MS, latencyP95Ms=MAX_P95_MS + 50, peakMemoryMb=120.0)
        result = compare(slow, self.native())
        self.assertEqual(result["recommendation"], "native")
        self.assertFalse(result["runtimes"]["browser"]["meetsLatencyFloor"])

    def test_both_over_the_floor_is_reported_not_hidden(self):
        slow = measurement(latencyP50Ms=MAX_P95_MS, latencyP95Ms=MAX_P95_MS + 50)
        also_slow = self.native(latencyP50Ms=MAX_P95_MS, latencyP95Ms=MAX_P95_MS + 20)
        result = compare(slow, also_slow)
        self.assertFalse(result["ok"])
        self.assertEqual(result["recommendation"], "neither-runtime-meets-the-floor")

    def test_mismatched_artifacts_produce_warnings(self):
        other = deepcopy(self.native())
        other["model"]["sha256"] = "b" * 64
        other["model"]["architecture"] = "mobilenetv3_small_int8"
        other["measuredOn"]["device"] = "Moto G54"
        result = compare(measurement(), other)
        joined = " | ".join(result["warnings"])
        self.assertIn("different architectures", joined)
        self.assertIn("different artifact bytes", joined)
        self.assertIn("different devices", joined)

    def test_markdown_never_renders_a_table_without_data(self):
        markdown = render_markdown(compare(None, measurement()))
        self.assertIn("insufficient measured data", markdown)
        self.assertNotIn("p95 (ms)", markdown)

    def test_markdown_renders_both_runtimes(self):
        markdown = render_markdown(compare(measurement(), self.native()))
        self.assertIn("p95 (ms)", markdown)
        self.assertIn("onnxruntime-web", markdown)
        self.assertIn("tflite", markdown)
        self.assertIn("**Recommendation:**", markdown)


class CliTests(unittest.TestCase):
    def run_cli(self, *argv):
        import contextlib
        import io

        from bharatbite_ml import cli

        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = cli.main(list(argv))
        return code, stdout.getvalue(), stderr.getvalue()

    def test_compat_without_files_exits_1(self):
        code, out, _ = self.run_cli("compat")
        self.assertEqual(code, 1)
        self.assertIn('"insufficient-data"', out)

    def test_compat_with_two_measurements_exits_0(self):
        with TemporaryDirectory() as tmp:
            browser = Path(tmp) / "browser.json"
            native = Path(tmp) / "native.json"
            browser.write_text(json.dumps(measurement()), encoding="utf-8")
            native.write_text(
                json.dumps(
                    measurement(
                        runtime="tflite",
                        runtimeVersion="2.16.1",
                        model={"architecture": "efficientnet_lite0_int8", "format": "tflite", "sizeBytes": 4_831_232, "sha256": SHA},
                        measuredOn={"device": "Pixel 6a", "os": "Android 14", "engine": "xnnpack", "threads": 4},
                    )
                ),
                encoding="utf-8",
            )
            code, out, _ = self.run_cli("compat", "--browser", str(browser), "--native", str(native), "--markdown")
        self.assertEqual(code, 0)
        self.assertIn("Recommendation", out)


if __name__ == "__main__":
    unittest.main()
