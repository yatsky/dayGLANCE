import SwiftUI
import EventKit

struct ContentView: View {
    var body: some View {
        WebView()
            .ignoresSafeArea()
            .task {
                // Check before requesting so we know if a dialog is about to appear.
                // If any permission was undetermined, the OS will show a dialog and we
                // need to reload the webview after it closes so the page gets real data.
                let calendarWasUndetermined = EKEventStore.authorizationStatus(for: .event) == .notDetermined

                HealthBridge.shared.requestAuthorization()

                await withCheckedContinuation { continuation in
                    CalendarBridge.shared.requestAuthorization { continuation.resume() }
                }

                if calendarWasUndetermined {
                    NotificationCenter.default.post(name: .dayGlanceReloadWebView, object: nil)
                }
            }
    }
}

extension Notification.Name {
    static let dayGlanceReloadWebView = Notification.Name("dayGlanceReloadWebView")
}
