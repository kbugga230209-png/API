# Food database audit report

Generated: 2026-11-25T09:49:18.090Z

| Metric | Value |
| --- | --- |
| Foods | 226 |
| IFCT-derived ingredients | 100 |
| Composite dishes (standardized recipes) | 104 |
| Directly sourced foods | 22 |
| Variants (homemade / restaurant / low-oil) | 352 |
| Language aliases | 471 |
| source_verified rows | 109 |
| calculated_from_recipe rows | 103 |
| needs_audit rows | 14 |

## Provenance model

- `source_verified` — value taken from IFCT 2017 / USDA, or an IFCT row applied directly.
- `calculated_from_recipe` — per-100 g values computed by `computeRecipePer100g()` from a
  standardized recipe (raw ingredient grams + cooked yield), so the methodology is reproducible.
- `needs_audit` — provisional (packaged label medians, proxy ingredients). Must not be shown
  with a "verified" badge until a source page is attached.

## Real data problems (must fix)

_None._

## Advisory cross-checks (authored cooked weight vs formula)

- dish ven-pongal: authored cookedYield 470 g differs from standardized 224 g
- dish chole-bhature: authored cookedYield 470 g differs from standardized 265 g

## Known gaps

- 226 foods is the launch foundation, not the 500–1,000 target. The expansion path is
  `packages/foods/data/*.json` plus the IFCT 2017 raw tables import (`ml/` scripts), which
  needs the IFCT dataset file — not reachable from the build sandbox network allow-list.
- `needs_audit` rows (14) need their source pages captured before they carry a verified badge.
- Mustard greens use spinach as an IFCT proxy in `sarson-da-saag` (documented in the row).
