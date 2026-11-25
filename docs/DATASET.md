# Indian food dataset: source research, licence decisions and acquisition pipeline

Status: **research complete, pipeline implemented and tested, no corpus acquired.**
There is no training data in this repository and no model has been trained.
`ml/data/raw/` is git-ignored; only manifests, hashes and provenance logs are
committed.

The machine this was written on has no outbound HTTPS (see §8), so no photograph
has actually been downloaded here. Everything below distinguishes clearly
between *researched*, *implemented and unit-tested*, and *run against real
images*.

---

## 1. Bottom line

| Question | Answer |
| --- | --- |
| Can the 50 recognition classes be trained from public Indian-food datasets alone? | No legally clean corpus of that size is reachable. |
| Which public sources may be **trained on and shipped**? | Wikimedia Commons (per-file licence is machine-readable), Open Images V7 (per-image licence, thin Indian coverage), and our own capture. |
| Which sources may only be used to **measure** a model? | The Kaggle/Hugging Face Indian-food sets (Google-Images provenance, no per-image licence) and Food-101. |
| Which sources are **rejected outright**? | `kaggle/ashishpadala/indian-food-images` (Apache-2.0 declared on scraped Google Images — licence laundering) and IndianFoodNet (no published endpoint or licence). |
| Is training blocked? | Yes. It is blocked by *data*, not by code: the only shippable bulk source needs network access this sandbox does not have, and regional dish coverage on Commons is a handful of photos per class. |

Machine-readable version of this table: **`ml/dataset/sources.json`**
(validated by `python3 -m bharatbite_ml.cli sources-audit`).

---

## 2. Source register

| # | Source | Licence basis | Verdict | Training? | Expected images | Labels available | Redistribution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Wikimedia Commons — Indian cuisine** (`commons.wikimedia.org/w/api.php`) | per file, `extmetadata.LicenseShortName` (CC0, CC BY 4.0, CC BY-SA 4.0, public domain) with a named author | clear | **yes** | a handful → a few hundred per dish | free-text `File:` descriptions; we supply our own search terms | keep original licence; manifest stores licence + source URL + author; CC BY-SA flagged as share-alike |
| 2 | **Open Images V7** (Google) | annotations CC BY 4.0; each image its own licence (large share CC BY 2.0) | mixed | **yes**, per-image verified | a few hundred across *all* Indian dishes | 600 boxable classes, very few Indian | per-image licence + attribution |
| 3 | **BharatBite owned capture** | owned copyright (`bharatbite_captured`) | clear | **yes** | target ≈2,000 | we label it | ours; consent needed for people in frame |
| 4 | **Kaggle `iamsouravbanerjee/indian-food-images-dataset`** | labelled "Other" on Kaggle; images scraped from Google Images | ambiguous | **no** (eval only) | 4,000 / 80 classes | 80 dish names | cannot redistribute: no per-image licence or author |
| 5 | **Hugging Face `rajistics/indian_food_images`** | derivative of #4 | ambiguous | **no** (eval only) | ≈7,300 / 20 classes | 20 dish names | same problem as #4 |
| 6 | **Kaggle `ashishpadala/indian-food-images`** | claims Apache-2.0; images come from Google Images | contradictory | **no — rejected** | 2,000 / 20 classes | 20 dish names | a dataset-level Apache claim cannot relicense scraped photographs |
| 7 | **Food-101** | research-only, ambiguous for commercial use | ambiguous | **no** (eval only) | 101,000 / 101 classes | 101 world cuisines | effectively no Indian coverage |
| 8 | **IndianFoodNet** (IIETA paper, CC BY 4.0 *paper*) | no dataset endpoint, no dataset licence | unavailable | **no — rejected** | — | — | needs author permission before anything |

Priority dishes requested — Gujarati, North Indian, South Indian, street food,
homemade — are covered by the *class list*, not by any one source: the 50 labels
in `ml/labels.json` already span Gujarati (`thepla`, `dhokla`, `khandvi`,
`undhiyu`, `fafda-jalebi`), North Indian (`chole-bhature`, `butter-chicken`,
`paneer-tikka`), South Indian (`idli`, `dosa`, `vada`, `sambar`, `upma`),
street food (`pav-bhaji`, `pani-puri`, `bhel`) and home-style everyday plates
(`dal-tadka`, `curd-rice`, `poha-dish`, `khichdi`).

### Why the Kaggle/HF sets are not used for training

They are the obvious shortcut — thousands of images, dish-level labels — and
they are exactly the ones that cannot be shipped:

* The images were collected from Google Images; the dataset author holds no
  rights to relicense them, and no per-image licence or author survives the
  scrape, so attribution is impossible.
* A dataset-level `Apache-2.0` or `MIT` tag on scraped photographs does not
  transfer any rights. Training on them and shipping the weights would embed
  unknown-rights photographs into a commercial product.
* They are still useful: measuring a model on them is a *distribution* check,
  provided the result is never described as validation on licensed data and the
  images are never redistributed. That is why the register marks them
  `evalOnly` rather than deleting them.

---

## 3. Class mapping

`ml/labels.json` is the single source of truth: 50 recognition classes, each with
`displayName`, `catalogSlug`, `variant`, `confusables`, `aliases`. The other 176
catalog foods stay search-only.

Mapping a *dataset* onto those 50 classes:

* **Commons / Open Images**: no dish taxonomy at all, so each class is queried by
  `sources.search_terms(label, displayName, aliases)` — the display name, the
  de-hyphenated label, then at most two aliases, de-duplicated. Deterministic, so
  two runs search the same way. Example:
  `search_terms("thepla", …)` → `["Methi thepla", "thepla"]`.
* **Kaggle/HF sets (eval only)**: mapped by exact dish name against
  `labels.json` display names and aliases; unmatched classes stay empty rather
  than being back-filled with a look-alike dish.
* Every mapping decision is recorded per image (`label`, `sourceUrl`,
  `attribution`, `license`, `capturedRegion`) in the manifest — see
  `ml/dataset/README.md`.
* `sources.mapping_coverage()` reports which sources may train and which are
  excluded, so the coverage question is answered by data, not prose.

Deliberate non-mapping: `aloo-gobi-dry` vs `aloo-gobi-gravy`, and `idli` vs
`dhokla` (listed as confusables in `labels.json`) are never merged. Merging them
would inflate accuracy and destroy the review prompt's usefulness.

---

## 4. Acquisition pipeline

```bash
cd ml
# 1. audit the register against the policy (offline, no network)
python3 -m bharatbite_ml.cli sources-audit

# 2. plan a Commons acquisition without downloading anything
python3 -m bharatbite_ml.cli sources-fetch --per-class 6 --labels thepla,idli,dhokla --dry-run

# 3. real acquisition into the git-ignored tree, with a provenance log
python3 -m bharatbite_ml.cli sources-fetch --per-class 40 --out data/raw \
    --provenance dataset/acquisition.json
```

What `fetch_wikimedia` does, in order, per class and per search term:

1. MediaWiki API query, namespace 6 (`File:`), `prop=imageinfo&iiprop=extmetadata|url`,
   `iiurlwidth=512` — a 512 px thumbnail, not the original.
2. Read the licence **per file** from `extmetadata.LicenseShortName`. Anything not
   on the allow-list is skipped and counted (`skippedLicence`), never guessed.
3. CC BY / CC BY-SA files without a non-empty author string are skipped: we cannot
   satisfy attribution, so we do not take the image.
4. Download with a timeout, reject anything under 2 KB (`skippedError`), compute
   SHA-256 and skip byte-identical re-downloads (`skippedDuplicate`) so a re-run is
   resumable and idempotent.
5. Write `data/raw/<label>/<pageid>.jpg` plus a provenance record: title, page URL,
   licence, author (HTML stripped), SHA-256, bytes, search term.

Policy is enforced in code, not documentation: fetching a source whose
`trainingAllowed` is false raises `SourcePolicyError` and the CLI exits 1.

Network failures never masquerade as success — each class records
`skippedError` and the run reports zero downloads.

---

## 5. Quality audit

```bash
python3 -m bharatbite_ml.cli quality-audit --root data/raw
python3 -m bharatbite_ml.cli quality-audit --root data/raw --no-near-duplicates   # no Pillow needed
```

`bharatbite_ml/quality.py` checks, and reports as JSON (`ok` + `issues`):

| Check | Rule | Why |
| --- | --- | --- |
| corrupt / truncated files | header-only parse: JPEG SOF + EOI, PNG IEND, WebP | a truncated file trains as noise and crashes the loader |
| non-images / empty files | signature + structure | scrape artefacts, HTML error pages saved as `.jpg` |
| too small | short side < `MIN_SIDE` (200 px) | thumbnails do not survive 224 px training resolution |
| duplicate bytes | SHA-256 grouping | the same photo counted twice inflates a class |
| near duplicates | dHash (9×8 grayscale, 64-bit) + Hamming ≤ 4, union-find clustering | re-encoded, resized and cropped reposts of one photo |
| unknown labels | folder name not in `labels.json` | typo'd class silently becomes a 51st class |
| empty classes | declared class with zero images | a class with no images cannot be evaluated |
| class imbalance | max/min ratio > 8× | a dominated class collapses to "always predict the big one" |

Verified on a synthetic tree (plumbing evidence only, **not** accuracy evidence):

```
36 files, 3 classes → validImages 36, invalid 0, tiny 0, exactDuplicateGroups 0,
nearDuplicateGroups 0, imbalanceRatio 1.0, ok true
corrupt file + 100 px image + unknown label injected → ok false, issues:
  "1 unreadable or corrupt file(s)", "1 image(s) narrower or shorter than 200px"
```

The audit **never** repairs, augments or duplicates an image. A short class stays
short and `dataset.validate_manifest` keeps failing until real photographs exist.

---

## 6. Splits

```bash
python3 -m bharatbite_ml.cli split-groups --root data/raw --val-fraction 0.15 --test-fraction 0.15
```

* Grouping is by duplicate group, **globally** — `dhash:<hash>` when Pillow is
  available, else `sha:<digest>`. All copies of one photograph therefore land in
  the same split; a re-encode cannot leak across train and test.
* The same photo listed under two class names is one group: the majority label
  wins, the group is reported under `labelConflicts` for a human to fix, and the
  CLI exits 1. It is never silently kept under both labels.
* A label whose only photograph turned out to duplicate another class is reported
  in `starvedLabels` and exits 1 — the class needs real images.
* Seeded (`--seed`, default `20261125`) and order-independent: rerunning produces
  identical splits, so a test image never migrates.
* `leakage` must be empty; the command returns `ok:false` and exit 1 otherwise.
  `find_split_leakage` also checks splits already recorded in a manifest.

---

## 7. Verified in this repository

| Piece | Evidence |
| --- | --- |
| Register + policy | `ml/tests/test_sources.py` (registry validation, licence→SPDX mapping, `Fair use` unmapped) |
| Fetcher | `ml/tests/test_sources.py`: dry run writes nothing, provenance written, HTML stripped from author, fair-use skipped, no-author CC BY skipped, byte dedupe, tiny download rejected, network failure reported not raised |
| Quality audit | `ml/tests/test_quality.py`: truncated JPEG/PNG, empty and non-image files, tiny threshold at 200 px, exact duplicates across classes, near-duplicate clustering (a resized copy groups, an unrelated photo does not) |
| Splits | `ml/tests/test_quality.py`: determinism, no group straddling splits, cross-label duplicate conflict, starved labels, impossible fractions rejected |
| Not verified | licence compliance of any *actual* Commons file, per-class image counts, label correctness — all of that needs images, which §8 explains why we do not have |

Full suite: `PYTHONPATH=ml python3 -m unittest discover -s ml/tests -t ml` →
**166 cases, 0 failures, 1 skipped**.

---

## 8. What is blocked, and what would unblock it

**Blocker:** this environment has no outbound HTTPS. The MediaWiki API call fails
with `URLError: TLS/SSL connection has been closed (EOF)`, so
`sources-fetch` reports per-class `skippedError` and downloads nothing. Open
Images needs the same network access. No scraping workaround, proxy or
"just this once" bypass was attempted — bypassing an access restriction is
explicitly out of scope.

To unblock, any one of:

1. Run the acquisition on a machine with network access:
   `sources-fetch --per-class 40` → `quality-audit` → `split-groups` → then
   human review of label correctness. This yields the Commons subset only.
2. **Owned capture** of the 50 dishes in a canteen/home setting — the only route
   to the "homemade plate" distribution the app actually sees, and the only one
   that reaches 40+ images for regional dishes Commons does not have.
3. Written permission from the authors of a scraped Kaggle/HF set (or a new set)
   that grants redistribution rights — only then does it move from `evalOnly` to
   `trainingAllowed` in `sources.json`.

Until one of those happens: **no training run, no benchmark numbers, no model
manifest, no `model_versions` row.** `train.py` refuses without a validated
manifest, and a validated manifest cannot be built from 12-image classes
(`MIN_IMAGES_PER_CLASS = 40`).

---

## 9. What this project will not do

* No scraping of private or login-walled content; no bypassing rate limits or
  access controls.
* No dataset uploaded to GitHub — `ml/data/raw/` is ignored; corpora live outside
  the repository.
* No synthetic, mirrored or duplicated images to reach a class minimum.
* No reporting of random-tensor smoke tests as recognition accuracy.
* No publishing a model whose numbers came from a corpus that cannot be licensed.
