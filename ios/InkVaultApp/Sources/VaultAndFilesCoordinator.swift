import Foundation
import UIKit
import WebKit
import UniformTypeIdentifiers
import CryptoKit
import Security
import Vision

/// Coordinates WKScriptMessageHandler commands, atomic local file-system vault checkpoints,
/// Files App `UIDocumentPickerViewController` (including folder batch import),
/// and iPadOS-safe `UIActivityViewController` Share Sheet / AirDrop presentation.
final class InkVaultBridgeCoordinator: NSObject, ObservableObject, WKScriptMessageHandler, UIDocumentPickerDelegate {
    weak var hostViewController: HybridHostViewController?
    private let vaultQueue = DispatchQueue(label: "app.inkvault.vaultQueue", qos: .userInitiated)

    private lazy var vaultDirectoryURL: URL = {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = appSupport.appendingPathComponent("InkVaultVault", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(
                at: dir,
                withIntermediateDirectories: true,
                attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
            )
        }
        return dir
    }()

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "inkvaultNative",
              let body = message.body as? [String: Any],
              let command = body["command"] as? String else {
            return
        }

        switch command {
        case "configureCanvasOverlay":
            hostViewController?.pencilKitEngine.configure(from: body)

        case "syncPageStrokesToNative":
            if let payload = body["payload"] as? [String: Any] {
                hostViewController?.pencilKitEngine.syncStrokesFromWeb(payload: payload)
            }

        case "mirrorVaultCheckpoint":
            if let docId = body["documentId"] as? String,
               let docJson = body["documentJson"] as? String {
                persistDocumentCheckpointAtomically(documentId: docId, jsonString: docJson)
            }

        case "shareFile":
            if let fileName = body["fileName"] as? String,
               let base64Data = body["base64Data"] as? String,
               let data = Data(base64Encoded: base64Data) {
                presentShareSheet(fileName: fileName, data: data)
            }

        case "openDocumentPicker":
            let allowMultiple = body["allowMultiple"] as? Bool ?? true
            let allowFolders = body["allowFolders"] as? Bool ?? false
            presentDocumentPicker(allowMultiple: allowMultiple, allowFolders: allowFolders)

        case "recognizeTextVision":
            if let requestId = body["requestId"] as? String,
               let imageBase64 = body["imageBase64"] as? String {
                recognizeTextWithAppleVision(requestId: requestId, imageBase64: imageBase64)
            }

        case "hapticFeedback":
            let style = body["style"] as? String ?? "selection"
            triggerHaptic(style: style)

        default:
            break
        }
    }

    // MARK: - Atomic Local Vault Persistence & Background Task Safety

    func persistDocumentCheckpointAtomically(documentId: String, jsonString: String) {
        let safeId = documentId.replacingOccurrences(of: "/", with: "_")
        vaultQueue.async { [vaultDirectoryURL] in
            let fileURL = vaultDirectoryURL.appendingPathComponent("\(safeId).inkvault.json")
            guard let data = jsonString.data(using: .utf8) else { return }
            try? data.write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])

            let digest = SHA256.hash(data: data).compactMap { String(format: "%02x", $0) }.joined()
            let shaURL = vaultDirectoryURL.appendingPathComponent("\(safeId).sha256")
            try? digest.data(using: .utf8)?.write(to: shaURL, options: .atomic)
        }
    }

    func performBackgroundFlush() {
        var bgTask: UIBackgroundTaskIdentifier = .invalid
        bgTask = UIApplication.shared.beginBackgroundTask(withName: "InkVaultLifecycleFlush") {
            if bgTask != .invalid {
                UIApplication.shared.endBackgroundTask(bgTask)
                bgTask = .invalid
            }
        }

        notifyWebLifecycle(state: "didEnterBackground")

        vaultQueue.asyncAfter(deadline: .now() + 0.6) {
            if bgTask != .invalid {
                UIApplication.shared.endBackgroundTask(bgTask)
                bgTask = .invalid
            }
        }
    }

    func notifyWebLifecycle(state: String) {
        dispatchEventToWeb([
            "type": "appLifecycleState",
            "state": state
        ])
    }

    func sendKeyboardShortcutToWeb(key: String, altKey: Bool, metaKey: Bool) {
        let js = """
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '\(key)',
          altKey: \(altKey ? "true" : "false"),
          metaKey: \(metaKey ? "true" : "false"),
          bubbles: true
        }));
        """
        DispatchQueue.main.async { [weak self] in
            self?.hostViewController?.webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    func dispatchEventToWeb(_ eventDict: [String: Any]) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: eventDict, options: []),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return
        }
        let js = "window.__INKVAULT_NATIVE_DISPATCH__ && window.__INKVAULT_NATIVE_DISPATCH__(\(jsonString));"
        DispatchQueue.main.async { [weak self] in
            self?.hostViewController?.webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    // MARK: - Files App, Document Picker, Folder Batch Import & Share Sheet / AirDrop

    private func presentShareSheet(fileName: String, data: Data) {
        DispatchQueue.main.async { [weak self] in
            guard let presenter = self?.hostViewController else { return }
            let tempDir = FileManager.default.temporaryDirectory
            let exportURL = tempDir.appendingPathComponent(fileName)
            try? data.write(to: exportURL, options: .atomic)

            let activityVC = UIActivityViewController(activityItems: [exportURL], applicationActivities: nil)
            // Crucial on iPadOS: anchor popoverPresentationController so UIActivityViewController never throws!
            if let popover = activityVC.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(
                    x: presenter.view.bounds.maxX - 60,
                    y: 56,
                    width: 32,
                    height: 32
                )
            }
            presenter.present(activityVC, animated: true)
        }
    }

    private func presentDocumentPicker(allowMultiple: Bool, allowFolders: Bool) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let presenter = self.hostViewController else { return }
            var types: [UTType] = [.pdf, .zip, .plainText, .commaSeparatedText, .image]
            if let inkvaultType = UTType("app.inkvault.notebook") { types.append(inkvaultType) }
            if allowFolders { types.insert(.folder, at: 0) }

            let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: !allowFolders)
            picker.allowsMultipleSelection = allowMultiple
            picker.delegate = self
            presenter.present(picker, animated: true)
        }
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        for url in urls {
            importIncomingURLFromSystem(url)
        }
    }

    func importIncomingURLFromSystem(_ url: URL) {
        let accessed = url.startAccessingSecurityScopedResource()
        defer {
            if accessed { url.stopAccessingSecurityScopedResource() }
        }

        var isDir: ObjCBool = false
        if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue {
            if let enumerator = FileManager.default.enumerator(at: url, includingPropertiesForKeys: nil) {
                for case let childURL as URL in enumerator {
                    let ext = childURL.pathExtension.lowercased()
                    if ["pdf", "goodnotes", "zip", "inkvault", "csv"].contains(ext) {
                        forwardSingleFileToWeb(childURL)
                    }
                }
            }
            return
        }

        forwardSingleFileToWeb(url)
    }

    private func forwardSingleFileToWeb(_ fileURL: URL) {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        let ext = fileURL.pathExtension.lowercased()
        let mime: String
        switch ext {
        case "pdf": mime = "application/pdf"
        case "csv": mime = "text/csv"
        default: mime = "application/zip"
        }

        dispatchEventToWeb([
            "type": "nativeDocumentImported",
            "fileName": fileURL.lastPathComponent,
            "mimeType": mime,
            "base64Data": data.base64EncodedString()
        ])
    }

    private func triggerHaptic(style: String) {
        DispatchQueue.main.async {
            if style == "selection" {
                UISelectionFeedbackGenerator().selectionChanged()
            } else {
                UIImpactFeedbackGenerator(style: style == "medium" ? .medium : .light).impactOccurred()
            }
        }
    }

    // MARK: - On-Device Offline Apple Vision Handwriting & Image OCR

    private func recognizeTextWithAppleVision(requestId: String, imageBase64: String) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard
                let imageData = Data(base64Encoded: imageBase64),
                let uiImage = UIImage(data: imageData),
                let cgImage = uiImage.cgImage
            else {
                self?.dispatchEventToWeb([
                    "type": "visionOcrResult",
                    "requestId": requestId,
                    "text": ""
                ])
                return
            }

            let request = VNRecognizeTextRequest { [weak self] req, _ in
                let observations = (req.results as? [VNRecognizedTextObservation]) ?? []
                let lines = observations.compactMap { $0.topCandidates(1).first?.string }
                self?.dispatchEventToWeb([
                    "type": "visionOcrResult",
                    "requestId": requestId,
                    "text": lines.joined(separator: "\n")
                ])
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([request])
            } catch {
                self?.dispatchEventToWeb([
                    "type": "visionOcrResult",
                    "requestId": requestId,
                    "text": ""
                ])
            }
        }
    }
}
