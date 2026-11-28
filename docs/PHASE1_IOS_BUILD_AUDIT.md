# Phase 1 — Repository & iOS Build Audit Report

Audited prior to modifying existing application or iOS configuration files.

## 1. Inspected Components
- **Node / Web Layer:** `package.json`, `package-lock.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `index.html`, `scripts/build-ios-webbundle.mjs`.
- **Core Engines:** `src/core/ios/{pencilKitBridge,ipadGestureEngine,iosFileAndLifecycleBridge}.ts`, `src/core/pdf/pdfEngine.ts`, `src/core/ocr/ocrAndSearchEngine.ts`, `src/core/storage/{storageEngine,backupAndSync,cryptoVault}.ts`.
- **iOS Native Target:** `ios/project.yml`, `ios/InkVaultApp/Info.plist`, `ios/InkVaultApp/InkVault.entitlements`, `ios/InkVaultApp/PrivacyInfo.xcprivacy`, `ios/InkVaultApp/Resources/LaunchScreen.storyboard`, `ios/InkVaultApp/Resources/Assets.xcassets/AppIcon.appiconset/{Contents.json,AppIcon-1024.png}`, and `ios/InkVaultApp/Sources/{InkVaultApp,HybridWorkspaceView,PencilKitBridgeEngine,VaultAndFilesCoordinator}.swift`.

## 2. Identified Build & Runtime Issues Requiring Fixes

1. **`WKURLSchemeHandler` CORS & Cancelled-Task Safety (`HybridWorkspaceView.swift`):**
   - Vite emits `<script type="module" crossorigin>` and `<link rel="modulepreload" crossorigin>` in `dist/index.html`. Under custom scheme `inkvault://app/`, `HTTPURLResponse` must include `Access-Control-Allow-Origin: *` or WebKit blocks ES module loading.
   - `LocalBundleSchemeHandler` must track stopped `WKURLSchemeTask` instances so stopping an in-flight task cannot trigger `NSInternalInconsistencyException`.
2. **`WKUserContentController` Strong Reference Cycle (`HybridWorkspaceView.swift`):**
   - `config.userContentController.add(coordinator, name: "inkvaultNative")` strongly retains `coordinator`. A weak proxy (`WeakScriptMessageProxy`) is needed so closing Stage Manager scenes deallocates cleanly.
3. **`pdfjs-dist` Worker Under Custom URL Scheme (`src/core/pdf/pdfEngine.ts`):**
   - WebKit restricts `new Worker('inkvault://...')` directly on custom schemes. Fetching the local worker script and wrapping it in a same-origin `Blob` URL (`URL.createObjectURL`) ensures `pdf.js` workers initialize cleanly inside the packaged iPadOS app.
4. **Offline OCR Inside Native iPadOS Shell (`src/core/ocr/ocrAndSearchEngine.ts` & `VaultAndFilesCoordinator.swift`):**
   - `tesseract.js` attempts a remote `eng.traineddata` fetch on first run if uncached. Adding Apple's built-in on-device `Vision.framework` (`VNRecognizeTextRequest`) via the native bridge provides 100% offline, hardware-accelerated OCR on iPad while preserving the `tesseract.js` fallback on Web.
5. **Xcode 15.4 / 16 Swift Compiler Cleanliness (`InkVaultApp.swift`, `HybridWorkspaceView.swift`, `ios/project.yml`):**
   - Add `Vision.framework` dependency in `ios/project.yml`.
   - Guard iOS 17.5 `UIPencilInteraction.Squeeze` against older SDK headers (`#if compiler(>=5.10)`) and update `.onChange(of: scenePhase)` to avoid iOS 17+ deprecation warnings.
   - Ensure `WebBundle` directory always exists prior to `xcodegen generate`.
6. **Missing Cloud CI & Windows Sideloading Pipeline:**
   - Repository currently has no `codemagic.yaml` and no automated `.xcarchive` -> `INKVAULT.ipa` (`Payload/InkVault.app`) packager for Free Personal Team signing on Windows (AltStore / Sideloadly) or Paid Developer Team signing (`xcodebuild -exportArchive`).
