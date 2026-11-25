# AI Outfit Finder

A real client-side outfit engine. Your height, weight, style, budget, occasion and season become a complete look with rough Indian-market prices (₹).

**Live:** https://kbugga230209-png.github.io/AiOutfit/

## What was broken

- **The backend was empty.** `backend/server.py`, `backend/outfit_ai.py`, `backend/product_search.py` and `database/cache.json` were each a single newline. GitHub Pages can't run Python anyway. Removed — the engine now lives entirely in `app.js`, where it actually runs.
- **Height, weight and budget were collected and ignored.** The "AI" was four hardcoded `if` statements returning the same string for everyone.
- **`style.css` was dead code** — `index.html` had its own inline styles and never linked it.

## What it does now

- **Every input matters**:
  - *Height + weight* → kind, practical fit notes (proportions, silhouettes, fabrics).
  - *Budget* → three real price tiers (under ₹5,000 / ₹5,000–15,000 / ₹12,000+); the estimated total is checked against your tier and flagged if it drifts.
  - *Occasion* → smart overrides (Interview in Gym wear? It switches you to Formal and tells you why).
  - *Season* → auto-detects the Indian season from today's date; controls layering, fabrics and shoe advice.
- **6 styles × 3 tiers × 5 slots** — a curated catalogue (~90 items) replaces the four hardcoded strings: Streetwear, Minimal, Formal, Gym, Old Money, Party.
- Colour palette per style, styling tips, **shuffle variants**, **copy the whole outfit** as text, input validation, `aria-live` results.

## Files

```
index.html   — markup
styles.css   — the real stylesheet (glass aesthetic, kept)
app.js       — catalogue + rule engine + rendering
```

## Run it

Open `index.html`, or `python3 -m http.server 8000`. No build, no backend, no tracking.
