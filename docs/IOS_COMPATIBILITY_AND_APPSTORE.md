# INKVAULT — iOS & iPadOS Compatibility Report, Native Architecture & App Store Package

---

## 1. Phase 1 — Complete Repository & iOS Compatibility Audit

| Subsystem | Existing Implementation | iOS / iPadOS Reusability | Native Requirement / Action Taken |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React 18.3 + TypeScript 5.7 + Vite 6 | **100% Reusable** | Bundled via `LocalBundleSchemeHandler` (`inkvault://app/`) inside native SwiftUI `WKWebView` with dynamic `100dvh`, `env(safe-area-inset-*)`, Split View, Slide Over, and Stage Manager layouts. |
| **Backend & Auth** | 100% local-first (no mandatory cloud backend; optional user-configured JSON sync endpoint) | **100% Reusable** | Zero server dependency; works completely offline in Airplane Mode. Optional Keychain helper ready for vault passphrases. |
| **Database & Local Storage** | IndexedDB (`idb` v8) with 9 stores (`documents`, `folders`, `assets`, `versions`, `studySets`, `customTemplates`, `customStickers`, `settings`, `crashRecovery`) | **Reusable + Native Mirror Needed** | `WKWebView` IndexedDB can be suspended on backgrounding; implemented synchronous staging (`flushPendingSaves`) + `registerIOSLifecyclePersistenceGuards` + native atomic mirror in `Application Support/InkVaultVault` (`FileProtectionType.completeUntilFirstUserAuthentication`). |
| **Encryption** | WebCrypto AES-256-GCM + PBKDF2-SHA256 (100,000 iterations) | **100% Reusable** | Supported natively in iOS 16+ `WKWebView` secure context (`inkvault://`). Qualifies for `ITSAppUsesNonExemptEncryption = false` (local password file protection). |
| **PDF Rendering & Export** | `pdfjs-dist` v4.8 + `pdf-lib` v1.17 | **100% Reusable** | Bundled worker served locally via `LocalBundleSchemeHandler`; lossless vector ink + embedded `.inkvault` metadata attachment preserved. |
| **Drawing & Canvas Engine** | Dual HTML5 `<canvas>` (`dryCanvas` + `{ desynchronized: true }` `wetCanvas`), Catmull-Rom smoothing, pressure/tilt | **Hybrid Upgrade Required** | Upgraded web stage with `getCoalescedEvents()`, `getPredictedEvents()`, Apple Pencil Hover ring, and palm-rejected gestures **PLUS** native 120Hz `PKCanvasView` (`PencilKitBridgeEngine.swift`) + lossless `pencilKitBridge.ts` round-trip converter. |
| **Apple Pencil Hardware** | W3C `PointerEvent` (`pointerType === 'pen'`) | **Native Required for Hardware Actions** | Implemented `UIPencilInteractionDelegate` in Swift for Apple Pencil 2 **Double-Tap** & Apple Pencil Pro **Squeeze**, plus `UIHoverGestureRecognizer` (`zOffset`, `altitude`, `azimuth`). |
| **Import / Export / Files** | `<input type="file">`, `JSZip`, anchor download | **Native Required for Deep Files/AirDrop** | Added `UIDocumentPickerViewController` (Files + Folder batch import), `UIActivityViewController` (Share Sheet + AirDrop with iPad `popoverPresentationController`), `.onOpenURL`, custom UTTypes (`app.inkvault.notebook`, `app.inkvault.backup`), and Safari Web Share Level 2 fallback. |
| **Backup & Crash Recovery** | `.inkvault-backup.zip` + `crashRecovery` IDB store | **Reusable + Integrity Check Added** | Added `verifyBackupArchiveIntegrity()` (ZIP + JSON schema + SHA-256 verification before restore) and `UIApplication.beginBackgroundTask` lifecycle flush. |
| **OCR & Audio Notes** | `tesseract.js` v5 + `MediaRecorder` / WebAudio | **Reusable with Deferred Mic Permission** | `NSMicrophoneUsageDescription` declared in `Info.plist`; permission is **never** requested until the user explicitly taps Record Audio Note. |

### Third-Party Dependency Privacy Audit (App Store Privacy Manifest Compliance)
- **`react`, `react-dom`, `lucide-react`, `idb`, `jszip`, `pdf-lib`, `pdfjs-dist`, `tesseract.js`:** Zero analytics SDKs, zero advertising identifiers (`IDFA`), zero cross-app tracking, zero telemetry calls.
- **`PrivacyInfo.xcprivacy`:** Included in `ios/InkVaultApp/PrivacyInfo.xcprivacy` with `NSPrivacyTracking = false`, empty `NSPrivacyCollectedDataTypes`, and required-reason API declarations (`C617.1`, `E174.1`, `CA92.1`).

---

## 2. Phase 2 — Architecture Decision Record (ADR)

**Selected Architecture: Option C — Hybrid Native-Accelerated iOS/iPadOS Application**  
*(SwiftUI App Lifecycle + Bundled Local `WKWebView` Library/PDF/Study UI + Native `PKCanvasView` / `UIPencilInteraction` Apple Pencil Bridge + Native Atomic File-System Vault)*

### Why Option C Was Chosen Over Option A & Option B
1. **Why Not Option A (Pure Capacitor Wrapper):** A generic `WKWebView` wrapper alone cannot receive hardware `UIPencilInteraction` double-tap/squeeze events, lacks native `PKCanvasView` 120Hz ProMotion stroke prediction, risks iPadOS `UIActivityViewController` popover crashes if unanchored, and relies solely on WebKit storage without atomic `Application Support` file-protection mirroring.
2. **Why Not Option B (Full SwiftUI Rewrite from Scratch):** Rewriting from scratch violates the project preservation mandate and would discard INKVAULT's battle-tested Goodnotes `.goodnotes`/`.zip` migration parser, lossless PDF attachment serializer, SM-2 spaced-repetition study engine, synced audio-ink timeline, and cross-platform `.inkvault` document compatibility.
3. **How Option C Preserves Everything While Feeling Native on iPadOS:**
   - Reuses 100% of INKVAULT's existing document schema, business logic, and redesigned iPad-native UI.
   - Bridges native `PKDrawing` strokes **losslessly** (`serializeInkStrokesToPencilKit` ↔ `deserializePencilKitToInkStrokes`) preserving every control point's `(x, y, force, altitude, azimuth, timeOffset)` plus INKVAULT's `layerId`, `zIndex`, and `audioOffsetMs`.

---

## 3. Phase 8 & Phase 9 — App Store Preparation & Metadata Package

> **Status Note:** App Store approval is **not** claimed. Below is the complete, honest App Store Connect preparation package ready for submission after signing on macOS with an Apple Developer Team ID.

### App Identity & Versioning
- **App Display Name:** `INKVAULT`
- **Subtitle (30 chars max):** `Notebooks, PDF & Pencil Studio`
- **Bundle Identifier:** `app.inkvault.studio`
- **Version / Build:** `1.0.0 (1)`
- **Minimum Deployment Target:** `iOS / iPadOS 16.0`
- **Supported Device Families:** Universal (`iPad` primary + `iPhone`), `UIRequiresFullScreen = false` (supports iPad Split View, Slide Over, and Stage Manager).
- **Primary Category:** `Productivity`
- **Secondary Category:** `Education`

### Promotional Text (170 chars max)
Write naturally with Apple Pencil, annotate 500-page PDFs, migrate Goodnotes archives with full fidelity reports, and keep 100% of your notes private and offline-first.

### App Store Description
INKVAULT is a precision, local-first digital notebook and PDF annotation studio designed for iPad, Apple Pencil, and iPhone.

**CRAFTED FOR APPLE PENCIL**
- Pressure- and tilt-sensitive Fountain Pen, Ballpoint, Brush, Fineliner, Graphite Pencil, and Underlay Highlighter.
- Native Apple Pencil Double-Tap, Apple Pencil Pro Squeeze, and Hover nib preview support.
- Draw-and-hold geometric shape snapping, graduated snap ruler, and non-destructive vector/pixel erasing.
- Conflict-free iPadOS gestures: two-finger pinch-to-zoom, two-finger pan, two-finger tap Undo, and three-finger tap Redo.

**POWERFUL PDF & ACADEMIC WORKSPACE**
- Import, annotate, highlight, underline, bookmark, merge, and split multi-hundred-page PDFs smoothly.
- Optional Active-Recall Tape masks and SM-2 Spaced Repetition Study Sets extracted directly from your highlights.
- Optional lecture Audio Notes synchronized stroke-by-stroke with your handwriting.
- Asynchronous on-device Handwriting & Image OCR search across your entire library.

**TRANSPARENT GOODNOTES MIGRATION & ZERO LOCK-IN**
- Import `.goodnotes` notebooks and batch `.zip` folders non-destructively with itemized fidelity audit reports.
- Export standards-compliant vector PDFs, high-DPI PNGs, Markdown summaries, or open `.inkvault` / `.inkvault-backup.zip` archives via the Files app, Share Sheet, and AirDrop.
- Optional AES-256-GCM (PBKDF2-SHA256) local passphrase encryption for confidential notebooks.

### Keywords (100 chars max)
`notes,notebook,pdf,handwriting,pencil,planner,goodnotes,study,flashcards,ocr,journal,markup`

### Required Screenshot Specifications (Capture on Simulator / Physical iPad — Never Fabricate)
1. **13-inch iPad Pro (M4) Display** — `2752 × 2064 px` (Landscape) or `2064 × 2752 px` (Portrait):
   - *Shot 1:* Populated Library Shelf in Light Paper mode showing bound `3:4` notebooks, Favourites shelf, and nested folders.
   - *Shot 2:* Notebook Workspace in Landscape showing Cornell Lecture notes, Fountain Pen dynamics popover, and floating Zoom pill.
   - *Shot 3:* Annotated Research PDF with Page Thumbnails sidebar, bookmarks, and Underlay Highlighter.
   - *Shot 4:* Split View / Stage Manager Dark Obsidian mode alongside Study Set active-recall flashcards.
   - *Shot 5:* Goodnotes Migration Studio showing an itemized SHA-256 fidelity report.
2. **6.9-inch iPhone Display** — `1320 × 2868 px` (Portrait):
   - *Shot 1:* Compact 2-column Library shelf + Quick Note creation.
   - *Shot 2:* Read/Annotate mode with bottom sheet Export / Share Sheet.

### App Privacy Disclosures (App Store Nutrition Labels)
- **Data Collection:** **Data Not Collected** — INKVAULT stores all notebooks, PDFs, audio recordings, OCR indices, and settings locally on the user's device. No user accounts, analytics trackers, or third-party telemetry servers are used.
- **Support URL Template:** `https://inkvault.app/support` *(replace with live domain prior to App Store Connect submission)*
- **Privacy Policy URL Template:** `https://inkvault.app/privacy` *(must state: zero personal data collected, microphone audio stays strictly on-device inside user notebooks, optional user-configured sync endpoint transmits data only to the URL explicitly entered by the user).*

### Export Compliance Assessment
- **`ITSAppUsesNonExemptEncryption = NO` (`false`):** INKVAULT uses standard WebCrypto / Apple CryptoKit AES-256-GCM solely for local user-initiated password protection of personal notebook files and OS-provided HTTPS transport. Under US EAR `15 CFR § 740.17(b)(4)` and Apple's Export Compliance guidelines, encryption limited to local file/password protection without custom proprietary network key-exchange protocols is exempt from CCATS self-classification reporting.

### App Store Connect Submission Checklist
- [x] `ios/project.yml` & `ios/InkVaultApp/Info.plist` configured (`app.inkvault.studio`, `iOS 16.0+`, `UIRequiresFullScreen = false`).
- [x] `AppIcon-1024.png` generated as opaque 24-bit RGB PNG (`1024×1024`, zero alpha channel).
- [x] `PrivacyInfo.xcprivacy` Privacy Manifest included in target resources.
- [x] Minimum deferred permissions (`NSMicrophoneUsageDescription`, `NSPhotoLibraryAddUsageDescription` only).
- [ ] Open on macOS with Xcode 15.4+ (`brew install xcodegen && npm run build:ios && cd ios && xcodegen generate`).
- [ ] Select Apple Developer Team ID in Signing & Capabilities and archive (`Product → Archive`).
- [ ] Capture genuine screenshots from iPad Pro (13-inch) & iPhone (6.9-inch) Simulators or physical hardware.
- [ ] Host live Privacy Policy & Support URLs and upload build via Xcode Organizer / Transporter.
