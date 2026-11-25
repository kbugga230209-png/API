# HEAVENLY — AI Aesthetic Analyzer

On-device facial proportion scan powered by MediaPipe FaceMesh. Gold-and-glass divine aesthetic, kept intact.

**Live:** https://kbugga230209-png.github.io/maxxing/

## The bugs that mattered

1. **Your photo vanished when results appeared.** The old `onFaceMeshResults` cleared the canvas, then did `img.src = previewCanvas.toDataURL()` — reading from the canvas it had *just erased* — and drew that blank image back. Fix: the original `Image` is stored and redrawn from directly.
2. **Scores were random.** `Math.random()` was mixed into symmetry, jawline and eyes, so the same photo scored differently every scan. Fix: all measurements are deterministic landmark math. Same photo → same score, every time.
3. **Symmetry was measured against the image center (`nose.x - 0.5`)** — which depends on where you stand in frame, not your face. Fix: deviation is measured against the true face midline derived from the jaw landmarks.
4. **No face detected? It silently invented scores** (`getSimulatedScores`). Fix: an honest "no face detected" state with retry guidance. Simulation still exists, but only behind an explicit, clearly-labelled **demo** button.

## Upgrades

- **−600 KB**: Three.js (used only for background dots) replaced with a ~2 KB 2D-canvas gold-dust field. Unused `camera_utils` removed.
- **Lazy model loading**: MediaPipe downloads on first upload, with a 20 s timeout and a graceful offline/CDN-blocked message.
- **Skin Quality is honest**: a real photo-based texture/evenness heuristic on the cheek regions, labelled as lighting-dependent — not a skin assessment.
- **Tips actually key to your two lowest metrics** (the old code shuffled randomly despite the comment).
- Rescan without reloading · paste-to-upload · downloadable PNG score card · privacy badge (photos never leave the browser) · `prefers-reduced-motion` support.

Scores describe proportions in one photo under one lighting setup. For fun — not a measure of worth, health or beauty.

## Run it

Open `index.html`, or `python3 -m http.server 8000`. The face model loads from the jsDelivr CDN on first scan; everything else is local.
