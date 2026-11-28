# INKVAULT — Cross-Platform Software & Document Architecture

## 1. Architectural Principles

INKVAULT is engineered as a **local-first, framework-independent digital notebook and PDF annotation platform** designed primarily for **iPadOS + Apple Pencil** while running natively across **Web, macOS, Windows, and Android** via a strict five-layer separation of concerns:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ 5. USER INTERFACE LAYER (`src/ui/`, `src/design/`)                        │
│    React + Design System Tokens, iPad Landscape/Portrait Adaptive Shell,  │
│    Library, Multi-Tab Workspace, Migration Studio, Study & Audio Drawers  │
├───────────────────────────────────────────────────────────────────────────┤
│ 4. RENDERING & INPUT LAYER (`src/core/ink/`, `src/core/pdf/`)             │
│    Dual-Canvas Wet/Dry Ink Renderer, W3C PointerEvents + Apple Pencil     │
│    Coalesced/Tilt/Pressure Pipeline, PDF.js Vector/Raster Compositor      │
├───────────────────────────────────────────────────────────────────────────┤
│ 3. DOMAIN SERVICES (`src/core/migration/`, `ocr/`, `audio/`, `study/`)    │
│    Goodnotes (.goodnotes/PDF/ZIP) Importer, Async OCR Worker Pipeline,    │
│    Timestamp-Synced Audio Engine, SM-2 Spaced Repetition Engine           │
├───────────────────────────────────────────────────────────────────────────┤
│ 2. STORAGE, ENCRYPTION & SYNC LAYER (`src/core/storage/`)                 │
│    PlatformStorageAdapter (IndexedDB / Memory / Native FS), AES-256-GCM   │
│    WebCrypto Vault, Version Snapshots, Sync Engine + Conflict Resolver    │
├───────────────────────────────────────────────────────────────────────────┤
│ 1. PORTABLE DOCUMENT MODEL (`src/core/model/`)                            │
│    Pure TypeScript Schema v1.0.0 (`InkVaultDocument`), Persistent Object  │
│    UUIDs, Vector Stroke Geometry, Deterministic Undo/Redo HistoryManager  │
└───────────────────────────────────────────────────────────────────────────┘
```

Crucially, **Layer 1 (`src/core/model/`) has zero dependency on React, DOM framework state, or platform-specific UI**. An `.inkvault` notebook created on iPadOS Safari/Capacitor can be opened identically on Windows, macOS, Android, or Linux without losing a single vector stroke, pressure sample, layer, lock state, PDF page, bookmark, outline node, or audio timestamp.

---

## 2. Portable Document Schema (`schemaVersion: "1.0.0"`)

Every editable entity in an `InkVaultDocument` carries a persistent UUID (`id`), explicit `layerId`, `zIndex`, optional `groupId`, `locked` flag, and creation/modification timestamps:

- **`InkVaultDocument`**:
  - `id`, `schemaVersion: "1.0.0"`, `title`, `folderId`, `tags[]`
  - `isFavorite`, `isShared`, `collaborators[]`, `trashedAt: number | null`
  - `cover`: `{ enabled, style, color, accentColor, subtitle, customImageAssetId? }`
  - `pages: InkVaultPage[]`
  - `outline: OutlineNode[]` (multi-level hierarchical document outline)
  - `audioSessions: AudioSessionMeta[]` (linked to binary audio blobs in asset store)
  - `encryption?: EncryptionEnvelope` (PBKDF2 salt + AES-256-GCM IV + encrypted payload when locked)
  - `migrationReport?: MigrationReport` (immutable provenance & fidelity audit for migrated files)
  - `revision: number`, `deviceId: string`, `createdAt: number`, `updatedAt: number`

- **`InkVaultPage`**:
  - `id`, `width`, `height`, `orientation`, `rotation` (`0 | 90 | 180 | 270`)
  - `background`: `{ type: 'template' | 'pdf' | 'image', templateId, paperColor, lineSpacing, pdfAssetId?, pdfPageNumber?, imageAssetId? }`
  - `layers: PageLayer[]` (`id`, `name`, `visible`, `locked`, `opacity`)
  - `strokes: InkStroke[]` (unflattened vector points `{ x, y, p, tx, ty, t }[]`, pen instrument, colour, width, opacity, blendMode, `audioSessionId?`, `audioOffsetMs?`)
  - `shapes: ShapeObject[]` (line, arrow, rectangle, ellipse, triangle, diamond)
  - `connectors: ConnectorObject[]` (diagram connectors linking shape/text anchors or coordinates)
  - `textBoxes: TextBoxObject[]` (rich typography, size, colour, fill, alignment, rotation)
  - `images: ImageObject[]` (binary asset ref, x, y, width, height, rotation, opacity)
  - `stickers: StickerObject[]` (vector/asset sticker elements)
  - `tapes: TapeObject[]` (active-recall masking strips with `revealed` runtime/study state)
  - `bookmarked: boolean`, `bookmarkLabel?: string`
  - `ocrText?: string`, `ocrIndexedAt?: number`, `pdfText?: string`

---

## 3. Digital Ink Pipeline & iPadOS Apple Pencil Integration

1. **High-Frequency Sampling**: Captures `PointerEvent` streams using `event.getCoalescedEvents()` (delivering 120Hz–240Hz Apple Pencil samples on ProMotion iPads) plus hardware `pressure` (`0.0–1.0`), `tiltX` / `tiltY` (`-90°..90°`), and `pointerType` (`'pen' | 'touch' | 'mouse'`).
2. **Palm Rejection**: When `palmRejection` is active (or when `pointerType === 'pen'` has been observed), touch contacts (`pointerType === 'touch'`) are routed exclusively to viewport pan/pinch gestures rather than stroke creation.
3. **Dual-Canvas Rendering**:
   - **Committed Dry Layer Canvas**: Renders template/PDF background + cached committed vector strokes, shapes, images, text, stickers, and tape masks.
   - **Active Wet-Ink Canvas**: Renders only the currently in-flight stylus stroke using Catmull-Rom / quadratic spline interpolation and variable-width nib geometry (`<2ms` frame budget), committing cleanly to the document model on `pointerup`.
4. **Vector-Preserving Pixel & Stroke Erasers**:
   - **Stroke Eraser**: Removes unlocked strokes intersecting the eraser circle (filtered by `EraserFilter`).
   - **Pixel (Split) Eraser**: Analytically intersects the eraser circle with each stroke segment and splits the `InkStroke` into clean before/after vector sub-strokes — preserving full vector editability without ever rasterizing handwriting into bitmaps.

---

## 4. Cross-Platform Deployment Targets

- **iPadOS / iOS**: Progressive Web App (`display: standalone`, Apple Pencil PointerEvents) AND drop-in Capacitor / WKWebView native wrapper (`PlatformBridge` abstraction in `src/core/platform/platformBridge.ts` with hook points for native PencilKit Metal overlay where hardware-specific latency reduction is desired).
- **Web / macOS / Windows / Android**: Standard Chromium / WebKit / Gecko runtime with full IndexedDB offline storage, File System export/import, S-Pen / Surface Slim Pen `PointerEvent` tilt & pressure support, and responsive portrait/landscape layout.
