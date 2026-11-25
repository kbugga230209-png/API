# HEAVENLY

> You're already inside it.

The persona page — **IGN: LigmaFire** · Discord: `itz_crime_9`. Status, render distance, loadout, log.

**Live:** https://kbugga230209-png.github.io/Heaven/

## What was broken (and is now fixed)

| Before | After |
|---|---|
| The whole site lived in a file named `Heaven` — no `.html` extension, so GitHub Pages served a 404 at the root | Proper `index.html`; the live site actually renders |
| `font-family: 'Cormorant Garamond'` / `'Inter'` declared but never loaded — everyone saw fallback fonts | Both fonts loaded via Google Fonts with graceful fallbacks |
| `og:image` pointed at `kbugga230209/Heaven` — an account/repo that doesn't exist | Real `og.jpg` share banner shipped in this repo |
| No meta description, favicon or theme color | All present |
| IGN / Discord were plain text | One-tap copy buttons |
| No way to reach the other sites | Cross-links to the Realm, the Dossier, the Analyzer and the hub |

The words are unchanged — they're the voice of the page. Only the plumbing is new.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

No build step, no dependencies beyond the two font files (which fall back cleanly offline).
Respects `prefers-reduced-motion`; content is fully visible with JavaScript disabled.
