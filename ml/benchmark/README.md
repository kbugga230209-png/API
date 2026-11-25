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

---

# Runtime compatibility: ONNX Runtime Web vs TFLite (prototype)

The model has to run in two places — inside the installed Android app (TFLite)
and inside the PWA/TWA (WebAssembly) — and both must verify the same signed
manifest before they infer. This is a *prototype* for measuring that choice; it
does not modify the app, and it makes no decision without on-device numbers.

| Side | How it is measured | What comes out |
| --- | --- | --- |
| Browser / TWA | `ml/benchmark/ort-web-harness.html` — loads the INT8 `.onnx`, verifies its SHA-256 with WebCrypto, 10 warm runs then ≥100 timed runs on the target phone | init ms, p50/p95 ms, peak JS heap, model bytes, engine + thread count |
| Native Android | the existing instrumented test `adb shell am instrument -w com.bharatbite.bench/.ModelBenchmarkTest` | init ms, p50/p95 ms, native heap, delegate (XNNPACK/GPU) |

Both write the same JSON shape (documented at the top of
`ml/bharatbite_ml/compat.py`). Compare them:

```bash
cd ml
python3 -m bharatbite_ml.cli compat --browser browser.json --native native.json --markdown
```

Exit 0 only when both sides are usable measurements and at least one meets the
floors; exit 1 with `recommendation: insufficient-data` otherwise. The command
refuses:

* a `null` in any measured field (e.g. a browser that hides heap usage),
* fewer than 100 warm runs,
* a missing device string — a laptop CPU is not evidence,
* an artifact whose SHA-256 is not the exact file that will be published,
* readings from two different devices or two different artifacts (reported as
  warnings, so the comparison is never passed off as head-to-head).

Choosing a runtime, in order:

1. **Floors** — p95 ≤ 350 ms and peak memory ≤ 400 MB. A runtime that misses
   either is not viable regardless of convenience.
2. **Integration score** — lower is easier to ship, from a fixed rubric: glue
   lines ÷ 50, +1 per new dependency, +2 per extra build step, +3 for needing a
   native toolchain, +4 if it cannot reuse the existing manifest/signature
   verifier.
3. **Tie-break** — measured p95.

The score is deliberately arithmetic, not judgement: `RUBRIC` in
`compat.py` and the table above are the same numbers, and
`ml/tests/test_compat.py` asserts the arithmetic.

## Where this prototype stops

No measurement file exists in this repository, so `compat` currently answers
`insufficient-data` and exits 1. That is the honest state: there is no trained
artifact (§ dataset blocker), no Android SDK in this sandbox, and no browser to
run the harness. Both sides are ready to be run on real hardware; neither has
been, and no runtime has been chosen.
