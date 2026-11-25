# LEGAGME — The Legacy Board

> Log every win.

**This repo was completely empty** — zero files, with GitHub Pages enabled and serving a 404. It is now a persistent achievement tracker for the Heavenly crew, built to match the account's two visual families (divine gold + Minecraft pixel).

**Live:** https://kbugga230209-png.github.io/LegaGMe/

## What it does

- **Achievements with progress** — title, player, category (PvP / Builds / Chaos / Exploration), current vs. target, animated progress bars, gold glow when complete.
- **Seeded from the Realm** — the starting board is the ThatMinecraft leaderboard: KushXWhore's 412 wins, LifeIsALie_48's 187 blueprints, NOTXKUSHAL's 512 TNT, NotySmasui's 64 biomes, Pearl fr's 87 splats.
- **Persistent** — everything saves to `localStorage`; **export/import JSON** to back up or move devices; reset to seed anytime.
- **Legacy score** — completion-weighted score, totals and completed count at a glance.
- Category filters, `+1 / +10 / −1` logging, delete with confirmation, keyboard accessible, `prefers-reduced-motion` respected.

## A note on the name

"LegaGMe" read as *Legacy Me* — hence a legacy board. If the repo was meant for something else, this folder is self-contained: swap the content and keep the plumbing (persistence, export/import, a11y, share card).

## Run it

Open `index.html`, or `python3 -m http.server 8000`. No dependencies; the pixel font loads from Google Fonts with a monospace fallback.
