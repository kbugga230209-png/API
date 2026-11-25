# The 100× Audit — every repo on `kbugga230209-png`

**Date:** 2026-11-25 · **Method:** every repository cloned, every file opened and read, GitHub Pages status checked per repo. Nothing was skipped.

**Account inventory:** `API`, `LegaGMe`, `AiOutfit`, `Heavenly-`, `maxxing`, `Heavenly-site`, `Heaven` — 7 repos, all public, none forks, none archived.

| # | Repo | Files found | Pages status | Verdict |
|---|------|------------|--------------|---------|
| 1 | API | `README.md` (6 bytes: `# API`) | not enabled | Empty shell → became the hub |
| 2 | LegaGMe | **none** | enabled, "built" — serves 404 | Empty repo with a live-but-dead site |
| 3 | AiOutfit | 7 files, 4 of them empty | built | Frontend works; everything else is a stub |
| 4 | Heavenly- | 1 file, 32 KB | built | Ambitious, but a performance fire |
| 5 | maxxing | 1 file, 39.5 KB | built | Real ML, three real bugs |
| 6 | Heavenly-site | 1 file, 6.5 KB | built | Clean, one dead button |
| 7 | Heaven | 1 file named `Heaven`, 2.5 KB | enabled, "built" — serves 404 | HTML that the web can't see |

---

## 1. `API`

**Found:** `README.md` containing exactly `# API`. One commit ("Initial commit"). No Pages.

**Done:** rebuilt as **The Heavenly Universe hub** — a live index of all six realms (`index.html`), a static JSON manifest (`api/sites.json`) that gives the repo's name a purpose, this audit, the sync script, a themed 404 page, and generated share banners. Enable Pages on it and it becomes the front door of the whole account.

## 2. `LegaGMe`

**Found:** zero files. Not even a README. GitHub Pages is enabled and reports "built", so `https://kbugga230209-png.github.io/LegaGMe/` exists and serves a 404.

**Done:** built from nothing as **LEGAGME — The Legacy Board** (`sites/legagme/`): a persistent achievement tracker seeded with the crew's ThatMinecraft leaderboard stats, with localStorage, export/import JSON, filters and a legacy score. The name read as "Legacy Me"; if the intent was different, the README says how to repurpose it.

## 3. `AiOutfit` — "Find your outfit"

**Found:**

```
backend/outfit_ai.py       1 byte  (a single newline)
backend/product_search.py  1 byte  (a single newline)
backend/server.py          1 byte  (a single newline)
database/cache.json        1 byte  (a single newline)
frontend/app.js          851 bytes
frontend/index.html     3,106 bytes
frontend/style.css        698 bytes  ← never referenced by index.html
```

**Problems, in order of severity:**

1. **The entire backend is empty.** Four files that are literally one newline each. And GitHub Pages is static hosting — a Python backend could never run there regardless.
2. **Inputs are decorative.** `app.js` reads `height`, `weight` and `budget` into variables… and never uses them. Every 150 cm person and every 195 cm person with any budget gets the identical string.
3. **The "AI" is four `if` branches** returning hardcoded outfits ("Oversized Hoodie / Black Cargo Pants / Nike Air Force Sneakers" for everyone).
4. **`frontend/style.css` is dead code** — `index.html` carries its own inline `<style>` and never links the file. Two competing designs, one shipped.
5. No README, no meta description, no share card, no validation (you can enter −5 cm), result text renders with collapsed whitespace so the "list" is one line.

**Done (`sites/aioutfit/`):** a genuine rule engine in `app.js` — ~90-item catalogue (6 styles × 3 budget tiers × 5 slots) with ₹ prices; height/weight → fit notes; budget → tier selection *and* a total-vs-tier check; occasion overrides (Interview→Formal, Gym→Gym); season auto-detection for India; palettes, tips, shuffle, copy-to-clipboard, validation, `aria-live`. Empty backend and dead CSS removed; the stylesheet is now real and linked.

## 4. `Heavenly-` — actually "ThatMinecraft"

**Found:** one 32 KB `index.html`: an isometric voxel world on `<canvas>`, day/night cycle, 7 crew profiles, inventory navigation, leaderboard. Genuinely the most ambitious thing on the account — and the most expensive to run.

**Problems:**

1. **~12,000 canvas path fills per frame, every frame.** `drawWorld()` runs inside `requestAnimationFrame` and redraws all 24×24 columns × up to 13 blocks × 3 faces, plus trees — 60 times a second, forever, even when the camera is still. This is a laptop fan and phone battery incident.
2. **The day/night cycle is 20 seconds long** (`timestamp*0.00005`): sun, moon, sky color and torches strobe through a full day every 20 s.
3. **Player DOM elements are repositioned every frame** (7 × 2 style writes), and sky CSS variables are rewritten every frame — layout work on top of the canvas work.
4. **Mobile is broken-ish**: fixed 320 px profile panel overlaps the fixed interface on narrow screens; the world doesn't scale.
5. **Accessibility**: profile panel isn't a dialog, no focus management, no Escape, slots have no pressed state, no `prefers-reduced-motion` path (the animation is unconditional).
6. Fake loading bar (random increments unrelated to actual work), forced entry gate, no meta/OG/favicon, repo name doesn't match the product.

**Done (`sites/thatminecraft/`):** world pre-rendered to an offscreen canvas once per quantized light level (32 steps) + occlusion culling of buried cubes; **each frame is now one `drawImage`** and a camera lerp; player positions update only on real camera movement; sky writes throttled to ~10 fps; day length 120 s; world scales on mobile with a bottom-sheet profile; full keyboard path (labelled player buttons, `aria-pressed` slots, dialog semantics, focus return, Escape); reduced-motion static scene; honest fast loading. **Same seed 9337, same palette, same crew, same stats — visually identical.**

## 5. `maxxing` — "Analyze your face and look max yourself"

**Found:** one 39.5 KB `index.html`: MediaPipe FaceMesh landmark scan, gold "divine" glass UI, Three.js particle background, score circle + metric bars + tips.

**Problems:**

1. **The uploaded photo is erased when results render.** In `onFaceMeshResults`:
   ```js
   ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
   const img = new Image();
   img.src = previewCanvas.toDataURL();   // ← reads the canvas AFTER clearing it: blank
   ctx.drawImage(img, 0, 0, ...);         // ← draws blank (also async-decode race)
   ```
   The mesh ends up floating on black. Two bugs in four lines (blank source + drawing before decode).
2. **Scores are partly random.** `Math.random()` is added into symmetry, jawline and eyes; skin is *purely* random (`6 + Math.random()*3.5`). The same face gets a different score every scan — an analyzer that can't analyze twice.
3. **Symmetry compares `nose.x` to `0.5`** — the image center. Stand off-center and your "symmetry" drops. It measures your framing, not your face.
4. **No face detected → fabricated scores presented as real** (`getSimulatedScores()` silently). A face analyzer that invents faces.
5. **600 KB+ of Three.js for background dots**, plus `camera_utils.js` loaded and never used. Heavy CDN dependencies with zero error handling — offline or CDN-blocked means a silent dead page.
6. Tips claim to be chosen "based on lower scores" but are `sort(() => Math.random() - 0.5)`. No rescan path (reload required), no file-size guard on the "10MB" promise, no privacy statement despite the camera-adjacent subject.

**Done (`sites/maxxing/`):** original image stored and redrawn correctly; fully deterministic landmark math (midline from jaw landmarks, framing-independent); honest no-face state with retry guidance; simulation only via an explicit labelled demo; Three.js → ~2 KB 2D-canvas gold dust; `camera_utils` dropped; MediaPipe lazy-loaded with timeout + graceful failure; skin metric is a real (labelled, lighting-dependent) photo heuristic; tips keyed to the two lowest metrics; rescan, paste-upload, size guard, PNG score-card download, privacy badge, reduced-motion support.

## 6. `Heavenly-site` — "Just For Me"

**Found:** one 6.5 KB `index.html`. The cleanest code on the account: CSS variables, `clamp()` type, a JS-gated reveal that degrades gracefully. Respect.

**Problems:**

1. **"Enter the Realm" button has no click handler.** The single call-to-action on the page is a `<button>` that does nothing.
2. Reveal runs `getBoundingClientRect` for every block on **every scroll event** — forced layout on the hot path.
3. No share card/favicon/description; identity grid can overflow on very narrow screens; Discord handle not copyable.

**Done (`sites/heavenly-site/`):** the button is now a real link into ThatMinecraft — the actual Realm; `IntersectionObserver` replaces the scroll loop (stagger kept); copy-Discord; OG banner + favicon + meta; responsive identity grid; reduced-motion path. Design and words preserved.

## 7. `Heaven` — "Myself"

**Found:** a single file named `Heaven` — **no extension**. It contains a complete HTML page (the "HEAVENLY / You're already inside it" persona page).

**Problems:**

1. **GitHub Pages can't serve it as a page.** No `index.html` exists, so `https://kbugga230209-png.github.io/Heaven/` is a 404. The site exists but is invisible to the web.
2. **Fonts declared, never loaded**: `font-family: 'Cormorant Garamond', serif` and `'Inter'` with no `@font-face`/link — every visitor sees Times New Roman.
3. **`og:image` points to `raw.githubusercontent.com/kbugga230209/Heaven/...`** — a different account (`kbugga230209`, without `-png`) that doesn't exist. Sharing the link shows a broken card.
4. No meta description, favicon, or any link to the rest of the universe.

**Done (`sites/heavenly/`):** proper `index.html`; both fonts actually loaded with fallbacks; real generated `og.jpg`; copy buttons for IGN/Discord; cross-links; gentle reduced-motion-safe reveals. **Every word of the original copy kept** — it's the voice of the page.

---

## Account-wide gaps (all now addressed in the rebuilds)

- **READMEs:** 0 of 7 repos had a real one → every site folder now ships a README, plus this audit and the hub README.
- **Share cards:** 0 working `og:image` across the account → generated 1200×630 banners for the hub + all 6 sites (`scripts/make_og.py`, deterministic, reproducible).
- **Favicons / meta descriptions / theme-color:** none → all present.
- **Mobile & accessibility:** partial at best → responsive layouts, keyboard paths, `aria` state, `prefers-reduced-motion` everywhere.
- **Dead weight:** 4 empty files, 1 dead stylesheet, 1 unused CDN library, ~600 KB of unnecessary Three.js → removed.
- **Cross-navigation:** the 7 repos didn't know about each other → every site now links the universe (hub-relative inside this repo, Pages-absolute when standalone).

## What I did *not* do

- **No pushes to the other six repos.** This session writes only to `API` (branch `arena/7a52f1c4-api`). Run `bash scripts/sync-to-repos.sh --dry-run` to preview, then without the flag to port each rebuild home. History is preserved; Pages rebuilds in ~a minute.
- **No content/identity changes.** Crew names, stats, persona copy, aesthetics: preserved. The Heavenly brand stays Heavenly.
- **No license added** — that's your legal call. Recommendation: MIT for the code, if you want reuse.
