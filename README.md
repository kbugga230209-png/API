# INKVAULT — Precision Digital Notebook & PDF Studio

INKVAULT is a local-first, cross-platform digital notebook, vector ink, PDF annotation, Goodnotes migration, and study workspace engineered with strict separation between document schema, rendering, local persistence, synchronisation, and UI.

## Key Capabilities
- **50-Reference Visual Research Audit:** Documented in [`docs/RESEARCH_CATALOGUE.md`](docs/RESEARCH_CATALOGUE.md) across all 9 Goodnotes workflow categories (`REF-01` through `REF-50`).
- **Cross-Platform Portable Schema (`v1.0.0`):** Documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Supports heterogeneous page sizes/orientations, custom templates & covers, persistent UUIDs, layers, object locking, grouping, and deterministic undo/redo.
- **Low-Latency Vector Digital Ink Engine:** Stylus pressure, Apple Pencil tilt (`tiltX`/`tiltY`), coalesced pointer events, palm rejection, Catmull-Rom/Chaikin spline smoothing, Fountain/Ballpoint/Brush/Fineliner/Pencil/Underlay Highlighter, Stroke Eraser with per-tool filters, **non-destructive Vector-Splitting Pixel Eraser**, Freehand & Rectangular Lasso, stroke-width-preserving resize/rotate, Draw-and-Hold shape snap, Diagram Connectors, Graduated Ruler, Tape active-recall masks, Laser pointer, and 2.6× Magnified Zoom Writing Window with Auto-Advance.
- **Full-Fidelity PDF Studio:** Import PDFs (`pdfjs-dist` + `pdf-lib`), extract embedded text & outlines, annotate non-destructively, rearrange/rotate/duplicate/delete pages, merge multiple PDFs, split pages into independent notebooks, and export standards-compliant annotated PDFs (with optional lossless INKVAULT editable schema attachment).
- **Transparent Goodnotes Migration Studio:** Import `.goodnotes` archives, Goodnotes PDFs, nested `.zip` backup archives, `.inkvault` bundles, images, and `.csv`/`.tsv` Study Sets with SHA-256 duplicate policies (`skip`, `keep-both`, `replace`) and itemized Migration Audit Reports that never falsely claim native vector reconstruction from flattened PDFs.
- **Async Local OCR, Audio Sync & Optional SM-2 Study Tools:** Non-blocking `tesseract.js` Web Worker handwriting/image OCR, universal library search with filters, multi-session `MediaRecorder` audio synced to stroke timestamps, and optional SM-2 Spaced Repetition flashcards + highlight extraction.
- **100% Local Ownership, Encryption & Full Backup:** IndexedDB persistence (`InkVaultStorageEngine`) with immediate crash-recovery journal, version history checkpoints, PBKDF2-SHA256 + AES-256-GCM notebook encryption, `.inkvault-backup.zip` full library backup/restore, and optional REST/WebDAV/Bundle sync with deterministic conflict resolution.

## Commands
```bash
npm install          # Install dependencies
npm run dev          # Start live development server (0.0.0.0:5173)
npm run typecheck    # TypeScript strict verification
npm test             # Run automated Stage 1–5 Vitest suites
npm run build        # Build production bundle
```
