# THATMINECRAFT — The Realm Lobby

A voxel overworld lobby: isometric terrain, a day/night cycle, the crew standing on the grass, inventory navigation and the realm leaderboard.

**Live:** https://kbugga230209-png.github.io/Heavenly-/

## The 100× part: the renderer

The original drew the **entire world every animation frame** — 24×24 columns, up to 13 blocks each, 3 faces per block: roughly **12,000 canvas path fills per frame**, 60 times a second, even when nothing changed.

The rebuild:

1. **Offscreen pre-render** — the world is drawn to an offscreen canvas once per *quantized light level* (32 steps). Each animation frame is a single `drawImage` blit plus a cheap camera lerp.
2. **Occlusion culling** — fully buried cubes are skipped even in the pre-render.
3. **DOM discipline** — player positions update only when the camera actually moves; sky/sun/moon style writes are throttled to ~10 fps.
4. **Calmer sky** — the day/night cycle went from 20 seconds (a strobe) to 2 minutes.

Same seed (`9337`), same palette, same terrain — visually identical, ~100× less per-frame work.

## Everything else that changed

- **Mobile**: world scales to the viewport, panels go full-width, the profile becomes a bottom sheet.
- **Keyboard & screen readers**: players are labelled buttons, slots use `aria-pressed`, the profile is a `role="dialog"` with focus management, `Escape` closes it.
- **`prefers-reduced-motion`**: static daylight scene, no camera drift, no particle animation — scroll navigation still works.
- **Honest loading**: the bar reflects the real (fast) boot instead of a fake multi-second wait.
- Meta description, Open Graph banner, favicon, cross-links to the rest of the universe.

The crew, roles, weapons, biomes and leaderboard stats are unchanged — that's your server's history.

## Run it

Open `index.html`, or `python3 -m http.server 8000`. No dependencies, no network calls.
