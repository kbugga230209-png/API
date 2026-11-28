import SwiftUI
import UIKit
import WebKit
import PencilKit
import UniformTypeIdentifiers

struct HybridWorkspaceView: UIViewControllerRepresentable {
    @ObservedObject var coordinator: InkVaultBridgeCoordinator

    func makeUIViewController(context: Context) -> HybridHostViewController {
        let controller = HybridHostViewController(coordinator: coordinator)
        coordinator.hostViewController = controller
        return controller
    }

    func updateUIViewController(_ uiViewController: HybridHostViewController, context: Context) {}
}

/// Weak wrapper preventing `WKUserContentController` from creating a strong reference cycle
/// when Stage Manager scenes open and close.
final class WeakScriptMessageProxy: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

/// Serves bundled Vite assets under `inkvault://app/...` with proper CORS headers so
/// ES modules (`crossorigin`), IndexedDB, WebCrypto, and PDF Blob workers execute offline.
final class LocalBundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let lock = NSLock()
    private var stoppedTasks = Set<ObjectIdentifier>()

    private func isStopped(_ task: WKURLSchemeTask) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return stoppedTasks.contains(ObjectIdentifier(task))
    }

    private func clearTask(_ task: WKURLSchemeTask) {
        lock.lock()
        stoppedTasks.remove(ObjectIdentifier(task))
        lock.unlock()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        defer { clearTask(urlSchemeTask) }

        guard let url = urlSchemeTask.request.url else {
            if !isStopped(urlSchemeTask) {
                urlSchemeTask.didFailWithError(URLError(.badURL))
            }
            return
        }

        var relativePath = url.path
        if relativePath.isEmpty || relativePath == "/" {
            relativePath = "/index.html"
        }
        let trimmed = String(relativePath.dropFirst())

        let standardHeaders: (String) -> [String: String] = { mime in
            [
                "Content-Type": mime,
                "Access-Control-Allow-Origin": "*",
                "Cross-Origin-Resource-Policy": "cross-origin",
                "Cache-Control": "no-cache"
            ]
        }

        guard
            let bundleDir = Bundle.main.resourceURL?.appendingPathComponent("WebBundle").standardizedFileURL,
            case let fileURL = bundleDir.appendingPathComponent(trimmed).standardizedFileURL,
            fileURL.path.hasPrefix(bundleDir.path),
            FileManager.default.fileExists(atPath: fileURL.path),
            let data = try? Data(contentsOf: fileURL)
        else {
            if let fallbackURL = Bundle.main.resourceURL?.appendingPathComponent("WebBundle/index.html"),
               let htmlData = try? Data(contentsOf: fallbackURL),
               let response = HTTPURLResponse(
                   url: url,
                   statusCode: 200,
                   httpVersion: "HTTP/1.1",
                   headerFields: standardHeaders("text/html; charset=utf-8")
               ),
               !isStopped(urlSchemeTask) {
                urlSchemeTask.didReceive(response)
                urlSchemeTask.didReceive(htmlData)
                urlSchemeTask.didFinish()
                return
            }
            if !isStopped(urlSchemeTask) {
                urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            }
            return
        }

        let ext = fileURL.pathExtension.lowercased()
        let mimeType: String
        switch ext {
        case "html": mimeType = "text/html; charset=utf-8"
        case "js", "mjs": mimeType = "application/javascript; charset=utf-8"
        case "css": mimeType = "text/css; charset=utf-8"
        case "svg": mimeType = "image/svg+xml"
        case "png": mimeType = "image/png"
        case "jpg", "jpeg": mimeType = "image/jpeg"
        case "webp": mimeType = "image/webp"
        case "json", "webmanifest": mimeType = "application/json; charset=utf-8"
        case "wasm": mimeType = "application/wasm"
        default: mimeType = "application/octet-stream"
        }

        if let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: standardHeaders(mimeType)
        ), !isStopped(urlSchemeTask) {
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        lock.lock()
        stoppedTasks.insert(ObjectIdentifier(urlSchemeTask))
        lock.unlock()
    }
}

final class HybridHostViewController: UIViewController, UIPencilInteractionDelegate {
    let coordinator: InkVaultBridgeCoordinator
    private(set) var webView: WKWebView!
    let pencilKitEngine = PencilKitBridgeEngine()

    init(coordinator: InkVaultBridgeCoordinator) {
        self.coordinator = coordinator
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "inkvaultNative")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.systemBackground

        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(LocalBundleSchemeHandler(), forURLScheme: "inkvault")
        config.allowsInlineMediaPlayback = true
        config.websiteDataStore = .default()

        let userScript = WKUserScript(
            source: "window.__INKVAULT_NATIVE_SHELL__ = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(userScript)
        config.userContentController.add(WeakScriptMessageProxy(delegate: coordinator), name: "inkvaultNative")

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        view.addSubview(webView)

        // Mount transparent native PKCanvasView overlay (hidden until explicitly enabled via bridge)
        pencilKitEngine.canvasView.frame = view.bounds
        pencilKitEngine.canvasView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(pencilKitEngine.canvasView)

        // Passive Apple Pencil Hover recognizer across the full workspace (M2/M4 iPad Pro & iPad Air)
        let workspaceHover = UIHoverGestureRecognizer(
            target: pencilKitEngine,
            action: #selector(PencilKitBridgeEngine.handlePencilHover(_:))
        )
        workspaceHover.cancelsTouchesInView = false
        workspaceHover.delaysTouchesBegan = false
        workspaceHover.delaysTouchesEnded = false
        view.addGestureRecognizer(workspaceHover)

        // Register Apple Pencil 2 Double-Tap & Apple Pencil Pro Squeeze hardware interaction
        let pencilInteraction = UIPencilInteraction()
        pencilInteraction.delegate = self
        view.addInteraction(pencilInteraction)

        // Wire native PencilKit overlay engine callbacks
        pencilKitEngine.onHoverChanged = { [weak self] x, y, zOffset, altitude, azimuth in
            self?.coordinator.dispatchEventToWeb([
                "type": "pencilHover",
                "x": x,
                "y": y,
                "zOffset": zOffset,
                "altitude": altitude,
                "azimuth": azimuth
            ])
        }
        pencilKitEngine.onDrawingCommitted = { [weak self] payloadDict in
            self?.coordinator.dispatchEventToWeb([
                "type": "nativeDrawingDidCommit",
                "payload": payloadDict
            ])
        }

        // Observe iOS memory warnings to flush pending journals proactively
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.coordinator.notifyWebLifecycle(state: "memoryWarning")
        }

        if let startURL = URL(string: "inkvault://app/index.html") {
            webView.load(URLRequest(url: startURL))
        }
    }

    // MARK: - UIPencilInteractionDelegate (Apple Pencil Double-Tap & Pro Squeeze)

    func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
        let actionString: String
        switch UIPencilInteraction.preferredTapAction {
        case .switchEraser:
            actionString = "switchEraser"
        case .switchPrevious:
            actionString = "switchPrevious"
        case .showColorPalette:
            actionString = "showColorPalette"
        case .showInkAttributes:
            actionString = "showInkAttributes"
        case .ignore:
            actionString = "ignore"
        default:
            if #available(iOS 17.5, *), UIPencilInteraction.preferredTapAction == .showContextualPalette {
                actionString = "showColorPalette"
            } else {
                actionString = "switchEraser"
            }
        }

        coordinator.dispatchEventToWeb([
            "type": "pencilDoubleTap",
            "preferredAction": actionString
        ])
    }

    #if compiler(>=5.10)
    @available(iOS 17.5, *)
    func pencilInteraction(_ interaction: UIPencilInteraction, didReceiveSqueeze squeeze: UIPencilInteraction.Squeeze) {
        let phaseStr: String
        switch squeeze.phase {
        case .began: phaseStr = "began"
        case .changed: phaseStr = "changed"
        case .ended, .cancelled: phaseStr = "ended"
        @unknown default: phaseStr = "began"
        }

        var payload: [String: Any] = [
            "type": "pencilSqueeze",
            "phase": phaseStr
        ]
        if let hoverPose = squeeze.hoverPose {
            payload["hoverX"] = hoverPose.location.x
            payload["hoverY"] = hoverPose.location.y
        }
        coordinator.dispatchEventToWeb(payload)
    }
    #endif
}
