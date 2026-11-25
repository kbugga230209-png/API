# The Heavenly Universe

**Every repo on this account, audited and rebuilt.** This repo (`API`) is now the hub: a live index of all six realms, a static JSON API, the full audit, and the tooling to port each rebuild back home.

```
7 repos audited · 6 sites rebuilt · 3 broken live sites fixed · 0 empty files left
```

## The realms

| Site | Home repo | Was | Now |
|------|-----------|-----|-----|
| [ThatMinecraft](sites/thatminecraft/) | `Heavenly-` | ~12,000 canvas polygons redrawn every frame; 20-second day | Offscreen pre-render, **1 blit/frame (~100× less work)**, 2-minute day, mobile + keyboard |
| [Heavenly Analyzer](sites/maxxing/) | `maxxing` | Photo erased on results; random scores; fake no-face results; 600KB Three.js | Deterministic on-device scan, honest states, −600KB, score-card download |
| [AI Outfit Finder](sites/aioutfit/) | `AiOutfit` | Empty backend; height/weight/budget ignored; 4 hardcoded outfits | Real engine: 6 styles × 3 ₹ tiers, fit notes, occasion & season logic |
| [Heavenly](sites/heavenly/) | `Heaven` | HTML in an extensionless file → live 404 | Proper `index.html`, fonts loaded, share card fixed |
| [Heavenly Dossier](sites/heavenly-site/) | `Heavenly-site` | "Enter the Realm" button did nothing | It enters the actual Realm; smoother reveals; copy-Discord |
| [LegaGMe — Legacy Board](sites/legagme/) | `LegaGMe` | **Zero files** | Persistent achievement tracker seeded from the Realm leaderboard |

Full evidence, file by file: **[AUDIT.md](AUDIT.md)**.

## Run the hub locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Every site is plain HTML/CSS/JS — no build step, no install. Each `sites/<name>/` folder is self-contained and GitHub-Pages-ready.

## Port the rebuilds back to their repos

This session's work lives here; the six original repos are untouched. To sync:

```bash
bash scripts/sync-to-repos.sh --dry-run   # preview every change, push nothing
bash scripts/sync-to-repos.sh             # sync all six (asks first)
bash scripts/sync-to-repos.sh maxxing     # or just one
```

The script clones each repo, replaces its working tree with the rebuilt site (removing dead files like the extensionless `Heaven` and AiOutfit's empty backend), commits on top of existing history, and pushes. Pages rebuilds in about a minute.

To host this hub itself, enable Pages on `API`:

```bash
gh api -X POST repos/kbugga230209-png/API/pages -f 'source[branch]=main' -f 'source[path]=/'
```

## The static API

[`api/sites.json`](api/sites.json) — a manifest of every realm: repo, path, Pages URL, status, and the exact list of fixes. Once Pages is on, it's a real endpoint:

```
https://kbugga230209-png.github.io/API/api/sites.json
```

## Repo map

```
index.html              hub landing — live index + the 100× report
404.html                themed not-found page
api/sites.json          static manifest API
sites/                  the six rebuilt realms (each self-contained + README)
scripts/sync-to-repos.sh  port rebuilds back to their home repos
scripts/make_og.py      regenerate the 1200×630 share banners (needs pillow)
AUDIT.md                the full per-repo audit
```

## Principles kept

- **Your words, your crew, your brand.** Copy, gamertags, stats, palettes and the world seed are preserved. Only plumbing, performance and honesty changed.
- **No tracking, no accounts, no uploads.** Everything runs in the browser; the analyzer's photos never leave the device.
- **Accessible by default.** Keyboard paths, `aria` state, reduced-motion fallbacks, content visible without JS.
