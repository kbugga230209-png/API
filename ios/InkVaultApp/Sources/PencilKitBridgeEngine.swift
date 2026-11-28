import UIKit
import PencilKit

/// Bridges Apple's native 120Hz `PKCanvasView` / `PKDrawing` engine losslessly with
/// INKVAULT's portable `NativePKDrawingPayload` JSON format without flattening strokes.
final class PencilKitBridgeEngine: NSObject, PKCanvasViewDelegate {
    let canvasView = PKCanvasView()
    private var activeDocumentId: String = ""
    private var activePageId: String = ""
    private var isProgrammaticSync = false
    private var preservedMetaById: [String: [String: Any]] = [:]

    var onDrawingCommitted: (([String: Any]) -> Void)?
    var onHoverChanged: ((CGFloat, CGFloat, CGFloat, CGFloat, CGFloat) -> Void)?

    override init() {
        super.init()
        canvasView.delegate = self
        canvasView.backgroundColor = .clear
        canvasView.isOpaque = false
        canvasView.drawingPolicy = .pencilOnly
        canvasView.isHidden = true
        canvasView.isUserInteractionEnabled = false

        let hoverRecognizer = UIHoverGestureRecognizer(target: self, action: #selector(handlePencilHover(_:)))
        hoverRecognizer.cancelsTouchesInView = false
        hoverRecognizer.delaysTouchesBegan = false
        hoverRecognizer.delaysTouchesEnded = false
        canvasView.addGestureRecognizer(hoverRecognizer)
    }

    @objc func handlePencilHover(_ recognizer: UIHoverGestureRecognizer) {
        guard recognizer.state == .began || recognizer.state == .changed else { return }
        let targetView = recognizer.view ?? canvasView
        let loc = recognizer.location(in: targetView)
        var zOffset: CGFloat = 0.25
        var altitude: CGFloat = .pi / 2
        var azimuth: CGFloat = 0

        if #available(iOS 16.1, *) {
            zOffset = recognizer.zOffset
        }
        if #available(iOS 16.4, *) {
            altitude = recognizer.altitudeAngle
            azimuth = recognizer.azimuthAngle(in: targetView)
        }
        onHoverChanged?(loc.x, loc.y, zOffset, altitude, azimuth)
    }

    func configure(from dict: [String: Any]) {
        let enabled = dict["enabled"] as? Bool ?? false
        canvasView.isHidden = !enabled
        canvasView.isUserInteractionEnabled = enabled

        activeDocumentId = dict["documentId"] as? String ?? ""
        activePageId = dict["pageId"] as? String ?? ""
        let stylusOnly = dict["stylusOnly"] as? Bool ?? true
        canvasView.drawingPolicy = stylusOnly ? .pencilOnly : .anyInput

        let activeTool = dict["activeTool"] as? String ?? "pen"
        let inkTypeStr = dict["inkType"] as? String ?? "fountainPen"
        let colorHex = dict["colorHex"] as? String ?? "#18181B"
        let width = CGFloat(dict["width"] as? Double ?? 2.4)
        let opacity = CGFloat(dict["opacity"] as? Double ?? 1.0)

        let uiColor = Self.color(fromHex: colorHex, alpha: opacity)

        switch activeTool {
        case "eraser":
            if #available(iOS 16.4, *) {
                canvasView.tool = PKEraserTool(.bitmap, width: width * 3)
            } else {
                canvasView.tool = PKEraserTool(.vector)
            }
        case "lasso":
            canvasView.tool = PKLassoTool()
        default:
            let pkInkType = Self.mapInkType(inkTypeStr)
            canvasView.tool = PKInkingTool(pkInkType, color: uiColor, width: width)
        }
    }

    func syncStrokesFromWeb(payload: [String: Any]) {
        guard let strokeDicts = payload["strokes"] as? [[String: Any]] else { return }
        activeDocumentId = payload["documentId"] as? String ?? activeDocumentId
        activePageId = payload["pageId"] as? String ?? activePageId

        var builtStrokes: [PKStroke] = []
        preservedMetaById.removeAll()

        for strokeDict in strokeDicts {
            let strokeId = strokeDict["id"] as? String ?? UUID().uuidString
            if let meta = strokeDict["inkvaultMeta"] as? [String: Any] {
                preservedMetaById[strokeId] = meta
            }

            let inkTypeStr = strokeDict["inkType"] as? String ?? "pen"
            let colorHex = strokeDict["colorHex"] as? String ?? "#18181B"
            let opacity = CGFloat(strokeDict["opacity"] as? Double ?? 1.0)
            let pkInk = PKInk(Self.mapInkType(inkTypeStr), color: Self.color(fromHex: colorHex, alpha: opacity))

            guard let pointDicts = strokeDict["points"] as? [[String: Any]], !pointDicts.isEmpty else {
                continue
            }

            let controlPoints: [PKStrokePoint] = pointDicts.map { pt in
                let x = CGFloat(pt["x"] as? Double ?? 0)
                let y = CGFloat(pt["y"] as? Double ?? 0)
                let t = TimeInterval(pt["timeOffset"] as? Double ?? 0)
                let w = CGFloat(pt["sizeWidth"] as? Double ?? 2.2)
                let h = CGFloat(pt["sizeHeight"] as? Double ?? 2.2)
                let op = CGFloat(pt["opacity"] as? Double ?? 1.0)
                let force = CGFloat(pt["force"] as? Double ?? 0.5)
                let azimuth = CGFloat(pt["azimuth"] as? Double ?? 0)
                let altitude = CGFloat(pt["altitude"] as? Double ?? (.pi / 2))

                return PKStrokePoint(
                    location: CGPoint(x: x, y: y),
                    timeOffset: t,
                    size: CGSize(width: max(0.5, w), height: max(0.5, h)),
                    opacity: op,
                    force: force,
                    azimuth: azimuth,
                    altitude: altitude
                )
            }

            let path = PKStrokePath(controlPoints: controlPoints, creationDate: Date())
            let stroke = PKStroke(ink: pkInk, path: path)
            builtStrokes.append(stroke)
        }

        isProgrammaticSync = true
        canvasView.drawing = PKDrawing(strokes: builtStrokes)
        isProgrammaticSync = false
    }

    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        guard !isProgrammaticSync else { return }

        let serializedStrokes: [[String: Any]] = canvasView.drawing.strokes.enumerated().map { index, stroke in
            let points: [[String: Any]] = stroke.path.map { pt in
                [
                    "x": pt.location.x,
                    "y": pt.location.y,
                    "timeOffset": pt.timeOffset,
                    "sizeWidth": pt.size.width,
                    "sizeHeight": pt.size.height,
                    "opacity": pt.opacity,
                    "force": pt.force,
                    "azimuth": pt.azimuth,
                    "altitude": pt.altitude
                ]
            }

            let baseW = stroke.path.first?.size.width ?? 2.2
            return [
                "id": "pk_\(index)_\(Int(Date().timeIntervalSince1970 * 1000))",
                "inkType": Self.reverseMapInkType(stroke.ink.inkType),
                "colorHex": Self.hexString(from: stroke.ink.color),
                "opacity": stroke.ink.color.cgColor.alpha,
                "baseWidth": baseW,
                "points": points
            ]
        }

        let payload: [String: Any] = [
            "schema": "inkvault-pencilkit-bridge-v1",
            "documentId": activeDocumentId,
            "pageId": activePageId,
            "strokes": serializedStrokes
        ]
        onDrawingCommitted?(payload)
    }

    // MARK: - Helpers

    static func mapInkType(_ raw: String) -> PKInkingTool.InkType {
        switch raw {
        case "fountainPen":
            if #available(iOS 17.0, *) { return .fountainPen }
            return .pen
        case "monoline":
            if #available(iOS 17.0, *) { return .monoline }
            return .pen
        case "watercolor":
            if #available(iOS 17.0, *) { return .watercolor }
            return .marker
        case "pencil":
            return .pencil
        case "marker":
            return .marker
        default:
            return .pen
        }
    }

    static func reverseMapInkType(_ inkType: PKInkingTool.InkType) -> String {
        if #available(iOS 17.0, *) {
            if inkType == .fountainPen { return "fountainPen" }
            if inkType == .monoline { return "monoline" }
            if inkType == .watercolor { return "watercolor" }
        }
        if inkType == .pencil { return "pencil" }
        if inkType == .marker { return "marker" }
        return "pen"
    }

    static func color(fromHex hex: String, alpha: CGFloat) -> UIColor {
        var clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if clean.hasPrefix("#") { clean.removeFirst() }
        guard clean.count == 6, let rgb = UInt64(clean, radix: 16) else {
            return UIColor(white: 0.1, alpha: alpha)
        }
        return UIColor(
            red: CGFloat((rgb & 0xFF0000) >> 16) / 255.0,
            green: CGFloat((rgb & 0x00FF00) >> 8) / 255.0,
            blue: CGFloat(rgb & 0x0000FF) / 255.0,
            alpha: alpha
        )
    }

    static func hexString(from color: UIColor) -> String {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 1
        color.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(
            format: "#%02X%02X%02X",
            Int(round(r * 255)),
            Int(round(g * 255)),
            Int(round(b * 255))
        )
    }
}
