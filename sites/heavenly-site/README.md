# HEAVENLY — Dossier

> You won't lose to mechanics. You'll lose to assumption.

The minimal dossier: Pressure, Control, Fluid Adaptation, Identity.

**Live:** https://kbugga230209-png.github.io/Heavenly-site/

## What was broken (and is now fixed)

| Before | After |
|---|---|
| **"Enter the Realm" button had no click handler** — it did nothing | It's now a real link into the ThatMinecraft lobby (the actual Realm) |
| Reveal effect ran a `getBoundingClientRect` loop on every scroll event | `IntersectionObserver` — no layout thrash, staggered fade kept |
| Discord handle was plain text | Copy button with feedback |
| No share card, favicon or description | `og.jpg`, favicon, meta description, theme color |
| Identity grid overflowed on narrow phones | Stacks to one column under 560px |

Design and copy preserved — same dark card, same red accent, same words.

## Run it

Open `index.html`, or `python3 -m http.server 8000`. Zero dependencies (system font stack).
Content is visible without JS; reveals disable under `prefers-reduced-motion`.
