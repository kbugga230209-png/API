# Benchmark: EfficientNet-Lite0 INT8 vs MobileNetV3-Small INT8

There is **no `results.json` in this repository**. `python3 -m bharatbite_ml.cli
benchmark` says so (`no results file … — no evaluation has been run yet`) and
exits 1. A comparison table is only ever printed from a real evaluation run.

## How a result is produced

1. Train on the validated manifest (`train.py`) — refuses if dataset validation fails.
2. Convert to fully-quantized INT8 TFLite (`quantize.py`) with calibration images
   drawn from the **training** split only.
3. Evaluate the artifact on the **test** split (`evaluate.py`) — writes the
   result record including the artifact's SHA-256 and the device/thread count.
4. Compare (`benchmark.compare`), which applies the gates and recommends one model.

## Result record

```json
{
  "schemaVersion": 1,
  "evaluatedOn": { "corpus": "inference-corpus-v1", "split": "test", "images": 3120 },
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
      "artifactSha256": "<64 hex>",
      "trainedAt": "2026-12-01T10:00:00Z",
      "macroF1": 0.79,
      "ece": 0.06,
      "perClass": { "thepla": { "support": 62, "recall": 0.89 } }
    }
  ]
}
```

## Gates

| Gate | Threshold | Why |
| --- | --- | --- |
| top-1 | ≥ 0.75 | below this the app would be wrong more often than useful |
| top-5 | ≥ 0.90 | the review prompt needs the right dish in the shortlist |
| p95 latency | ≤ 350 ms | mid-range phone, 4 threads, no GPU delegate |
| artifact size | ≤ 25 MB | download on a 3G connection, install-time budget |

Additional requirements enforced at signing time: the benchmark's
`artifactSha256` must be the hash of the exact file being published, per-class
recall must clear its floor, and `validationTop1` is copied from the measurement
(never typed by hand).

## Reproducing the device measurement

Latency must be measured on a real device, not the training host:

```bash
adb shell am instrument -w com.bharatbite.bench/.ModelBenchmarkTest
```

The benchmark harness records p50/p95 over ≥ 100 warm runs with the same
preprocessing the app uses. Committing numbers from a laptop CPU is not
evidence, so `evaluate.py` requires the device string to be supplied explicitly.
