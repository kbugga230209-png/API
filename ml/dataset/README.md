# Recognition dataset — sourcing plan and manifest schema

No images live in this repository. `ml/data/raw/` is git-ignored. This directory
holds the schema and the plan, not data.

## Manifest schema

```json
{
  "schemaVersion": 1,
  "corpus": "inference-corpus-v1",
  "createdBy": "ml/bharatbite_ml/manifest_tool.py",
  "classes": ["thepla", "idli"],
  "images": [
    {
      "path": "thepla/0001.jpg",
      "label": "thepla",
      "split": "train",
      "sha256": "<64 hex chars, computed from the bytes>",
      "license": "CC-BY-4.0",
      "sourceUrl": "https://…",
      "attribution": "Photo by …",
      "capturedRegion": "gujarat"
    }
  ]
}
```

Generate it rather than writing it by hand:

```bash
cd ml && python3 -m bharatbite_ml.cli manifest-from-dir \
  --root data/raw --out dataset/manifest.json \
  --license CC-BY-4.0 --source-url https://… --attribution "…"
```

`path` is relative to the dataset root. `split` is derived from the image hash,
so a re-run never moves an image that is already in the test set.

## Validation gate (`dataset.validate_manifest`)

| Check | Level |
| --- | --- |
| missing `path`/`label`/`split`/`sha256`/`license`/`sourceUrl`/`attribution` | error |
| file not found on disk | error |
| SHA-256 mismatch against the file bytes | error |
| identical bytes in two different splits | error |
| licence outside the allow-list | error |
| CC-BY / CC-BY-SA / Apache / MIT without attribution | error |
| label not in `labels.json` | error |
| declared class with no images | error |
| class with fewer than 40 images | error |
| class with fewer than 5 validation images | error |
| duplicate bytes inside one split | warning |
| largest class > 8× smallest | warning |

## Collection plan

Target: **50 classes × 120 images = 6,000 images**, at least 40 per class to
train at all.

1. **Owned capture (first 2,000).** Photograph dishes as served: home kitchens
   in Gujarat/Maharashtra, canteens, thali restaurants. 3–5 angles per plate,
   both daylight and indoor tungsten, phone camera at 1× and 2×. Licence
   `bharatbite_captured`, attribution not required, `capturedRegion` recorded.
   This is the only source that matches the real distribution — overexposed
   canteen trays at an angle, not studio photography.
2. **Open corpora (next 2,000).** Filter for Indian dish names, keep only
   CC0/CC-BY/CC-BY-SA, store `sourceUrl` + author attribution verbatim. Check
   manually for mislabelled "curry" grabs.
3. **Annotator review (all).** One dish per image, single label. Reject images
   where two dishes dominate the frame — those belong in a detection set, not a
   classification set.
4. **Hard negatives.** Add ~500 images of things that resemble the classes but
   are not food (steel thali empty, spice powders, packaged snacks) so the
   abstain path gets exercised honestly.
5. **Held-out test integrity.** Test split is assigned by hash at collection
   time and never inspected during training. Class-level recall on the test
   split is what the promotion gate reads.

## Confusable pairs that must be measured separately

`labels.json` records these so the app can ask instead of guessing:

- idli ↔ dhokla (white, steamed, similar plate presentation)
- thepla ↔ khakhra ↔ roti (flatbread thickness and fold differ, top-down photos do not)
- poha ↔ upma (both yellow, granular)
- rasmalai ↔ gulab jamun (both in syrup, different shape)
- dal fry ↔ dal tadka (garnish differs by a spoon of tadka)

`metrics.confusable_report` reports the model's actual confusion restricted to
these pairs; if a pair is above 25% confusion the UI keeps the review prompt for
that pair even at high confidence.
