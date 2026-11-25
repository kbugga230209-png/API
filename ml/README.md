# Indian food recognition (workstream 1)

Recognition of Indian dishes, evaluated as **EfficientNet-Lite0 INT8 vs
MobileNetV3-Small INT8**, mapped onto the existing nutrition catalog in
`packages/foods/generated/catalog.compact.json`.

## Status — read this first

**No dataset and no model is shipped in this repository.** There is no
`ml/benchmark/results.json`, and the `model-manifest` Edge Function keeps
answering `404 no_published_model`. That is deliberate: an untrained or
unverified model must never reach the app.

What is verified now, in this repository, on this machine:

| Piece | Verified how | Result |
| --- | --- | --- |
| 50 recognition classes ↔ catalog | `python3 -m bharatbite_ml.cli validate-labels` | 50/50 classes map to a catalog food, 0 missing slugs/variants, 0 duplicate mappings, 0 dangling confusable links (176 catalog foods stay search-only) |
| Dataset manifest gate | `ml/tests/test_dataset.py` | provenance, licence allow-list, SHA-256 match, cross-split leakage, per-class minimums, imbalance all enforced |
| Manifest builder from an image tree | `ml/tests/test_cli.py` end-to-end | hashes computed from bytes, splits stable per hash, refuses an incomplete class set |
| Metrics (top-1/5, macro-F1, ECE, per-class floor) | `ml/tests/test_metrics.py` | 15 tests |
| Confidence + abstain + confusable logic | `ml/tests/test_infer.py` | 13 tests |
| Benchmark promotion gate | `ml/tests/test_benchmark.py` | untrained/missing/shape-invalid results are rejected, not rendered |
| Ed25519 signing | `ml/tests/test_ed25519.py` | matches RFC 8032 vectors 1–3 |
| Signed manifest ↔ shipped TypeScript | `ml/tests/test_export_manifest.py` | Python canonical payload is byte-identical to `canonicalManifestPayload` in `packages/core/src/manifest.ts`, re-checked against `packages/core/dist/manifest.js` under Node |

What is **not** verified, because this sandbox has no GPU, no TensorFlow and no
image corpus: the training loop, INT8 quantization and on-device latency of
either architecture. Those modules (`train.py`, `quantize.py`, `evaluate.py`,
`models.py`) are written to run on a GPU machine or the `ml-pipeline` GitHub
Actions workflow; they raise `TrainingUnavailable` with instructions rather than
pretending to work. The `--smoke-test` path in `train.py` exercises the plumbing
on random tensors and writes `SMOKE-TEST-ONLY.txt`; it is never a model.

## Why these two architectures

Both are mobile-first, and both post-train to INT8 cleanly — which matters
because the app downloads ~5 MB over Indian mobile networks and runs inference
without a network round trip. `ModelManifest.architecture` in
`packages/core/src/manifest.ts` already types exactly these two values, so the
app side needed no change.

EfficientNet-Lite0 removes squeeze-excite and swaps Swish for ReLU6, which is
what makes it behave under INT8 quantization. MobileNetV3-Small is smaller and
faster but gives up accuracy on fine-grained look-alike dishes (idli vs dhokla).
The benchmark decides with numbers, not preference.

## Layout

```
ml/
  labels.json                 50 classes: label, displayName, catalogSlug, variant, confusables, aliases
  bharatbite_ml/
    catalog.py                read the generated nutrition catalog
    labels.py                 label set + validation against the catalog
    dataset.py                manifest validation, leakage detection, split construction
    manifest_tool.py          build a manifest from an image tree (hashes + stable splits)
    metrics.py                top-1/5, macro-F1, ECE, per-class floors, confusion
    benchmark.py              promotion gates + comparison table
    infer.py                  confidence tiers, abstain, confusable review, catalog mapping
    models.py                 EfficientNet-Lite0 / MobileNetV3-Small builders (lazy TF)
    train.py                  reproducible fine-tune over a validated manifest
    quantize.py               INT8 TFLite conversion with training-split calibration
    evaluate.py               evaluate an artifact on the test split -> results entry
    export_manifest.py        sign a manifest with Ed25519, refuse below the gate
    ed25519.py                RFC 8032 sign/verify, standard library
    cli.py                    python3 -m bharatbite_ml.cli <command>
  dataset/                    sourcing plan + manifest schema (no images)
  benchmark/                  results schema + gate documentation (no results)
  tests/                      103 unittest cases
```

## Commands

Everything below runs with the standard library only:

```bash
cd ml
python3 -m bharatbite_ml.cli selftest
python3 -m bharatbite_ml.cli validate-labels
python3 -m bharatbite_ml.cli manifest-from-dir --root data/raw --out dataset/manifest.json \
    --license CC-BY-4.0 --source-url https://… --attribution "…"
python3 -m bharatbite_ml.cli validate-dataset --manifest dataset/manifest.json --root data/raw
python3 -m bharatbite_ml.cli split-plan --manifest dataset/manifest.json
python3 -m bharatbite_ml.cli benchmark --results benchmark/results.json --markdown

# tests (from the repo root)
PYTHONPATH=ml python3 -m unittest discover -s ml/tests -t ml
```

Training and publishing (GPU machine, or the `ml-pipeline` workflow):

```bash
pip install -r ml/requirements-train.txt
python3 -m bharatbite_ml.train --manifest ml/dataset/manifest.json --root ml/data/raw \
    --out runs/lite0 --architecture efficientnet_lite0_int8 --epochs 30
python3 -m bharatbite_ml.quantize  # via python -c or a driver script; see quantize.convert
python3 -m bharatbite_ml.evaluate  # writes one entry into benchmark/results.json
python3 -m bharatbite_ml.cli benchmark --results ml/benchmark/results.json --markdown
BHARATBITE_MODEL_SIGNING_KEY=$KEY python3 -m bharatbite_ml.cli manifest \
    --artifact out/model.tflite --results ml/benchmark/results.json --out out/signed \
    --model-id bharatbite-indian-food --version 0.1.0 \
    --architecture efficientnet_lite0_int8 --channel dev \
    --file-url https://…/model.tflite --released-at 2026-12-01T00:00:00Z
```

The signing key is read from the environment only. `new-key` prints a fresh
keypair; the private half goes to a GitHub Actions secret / owner vault, the
public half is committed to the app.

## Promotion gates

`benchmark.GATES`: top-1 ≥ 0.75, top-5 ≥ 0.90, p95 latency ≤ 350 ms, artifact
≤ 25 MB. A model must additionally beat the per-class floor on the test split
and come from a benchmark record whose `artifactSha256` matches the exact file
being signed. Failing any of these leaves the app on search-only behaviour,
which always works.

## Data policy

- Only allow-listed licences (`dataset.LICENSE_ALLOW`); CC-BY variants require
  a non-empty attribution.
- Every image carries a SHA-256 computed from its bytes, and validation re-hashes
  the file on disk.
- Identical bytes in two splits is a hard error (that is how test sets get
  contaminated).
- Splits are assigned from the image hash in `manifest_tool.py`, so adding data
  later cannot move an existing test image.
- `ml/data/raw/` and `ml/artifacts/*.tflite` are git-ignored: the corpus and the
  weights stay out of the repository.
