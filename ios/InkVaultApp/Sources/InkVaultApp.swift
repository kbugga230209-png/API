import SwiftUI

@main
struct InkVaultApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var coordinator = InkVaultBridgeCoordinator()

    var body: some Scene {
        WindowGroup {
            HybridWorkspaceView(coordinator: coordinator)
                .ignoresSafeArea(.keyboard, edges: .bottom)
                .onOpenURL { incomingURL in
                    coordinator.importIncomingURLFromSystem(incomingURL)
                }
        }
        .onChange(of: scenePhase) { newPhase in
            switch newPhase {
            case .inactive:
                coordinator.notifyWebLifecycle(state: "willResignActive")
            case .background:
                coordinator.performBackgroundFlush()
            case .active:
                coordinator.notifyWebLifecycle(state: "willEnterForeground")
            @unknown default:
                break
            }
        }
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Quick Note") {
                    coordinator.sendKeyboardShortcutToWeb(key: "n", altKey: true, metaKey: false)
                }
                .keyboardShortcut("n", modifiers: [.option])
            }
            CommandGroup(after: .textEditing) {
                Button("Search Library & OCR") {
                    coordinator.sendKeyboardShortcutToWeb(key: "k", altKey: false, metaKey: true)
                }
                .keyboardShortcut("k", modifiers: [.command])
            }
        }
    }
}
