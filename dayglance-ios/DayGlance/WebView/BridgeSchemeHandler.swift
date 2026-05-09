import WebKit

/// Handles `dgbridge://` calls from the JavaScript bridge shim.
///
/// URL format:  dgbridge://<namespace>_<method>?args=<JSON-encoded-array>
///   namespace: "native" → window.DayGlanceNative methods
///   namespace: "obsidian" → window.DayGlanceObsidian methods
///
/// Returns a JSON string (or "null") as the response body.
/// Each bridge phase adds cases to dispatch(namespace:method:args:).
final class BridgeSchemeHandler: NSObject, WKURLSchemeHandler {

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        let result = route(urlSchemeTask.request.url)
        respond(to: urlSchemeTask, with: result)
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}

    // MARK: - Routing

    private func route(_ url: URL?) -> String {
        guard let url,
              let host = url.host else { return "null" }

        // host is "<namespace>_<method>"; split on first underscore only
        guard let underscoreIndex = host.firstIndex(of: "_") else { return "null" }
        let namespace = String(host[host.startIndex..<underscoreIndex])
        let method    = String(host[host.index(after: underscoreIndex)...])

        let args = parseArgs(from: url)
        return dispatch(namespace: namespace, method: method, args: args)
    }

    /// Add cases here as bridge phases are implemented.
    /// Phase 1: all methods return null — the stubs are filled in Phases 2–11.
    private func dispatch(namespace: String, method: String, args: [Any]) -> String {
        switch namespace {
        case "native":
            return dispatchNative(method: method, args: args)
        case "obsidian":
            return dispatchObsidian(method: method, args: args)
        default:
            return "null"
        }
    }

    private func dispatchNative(method: String, args: [Any]) -> String {
        switch method {

        // Phase 2 — HealthKit
        case "getSteps":
            guard let date = args.first as? String else { return #"{"steps":0,"goal":10000}"# }
            return HealthBridge.shared.getSteps(date: date)
        case "getSleep":
            guard let date = args.first as? String else { return #"{"durationMinutes":0,"stages":[]}"# }
            return HealthBridge.shared.getSleep(date: date)

        // Phase 3 — EventKit
        case "getCalendarAuthStatus":
            return CalendarBridge.shared.getAuthStatus()
        case "getCalendars":
            return CalendarBridge.shared.getCalendars()
        case "getEvents":
            guard let date = args.first as? String else { return "[]" }
            return CalendarBridge.shared.getEvents(date: date)
        case "createEvent":
            guard let json = args.first as? String else { return #"{"success":false,"error":"missing args"}"# }
            return CalendarBridge.shared.createEvent(json: json)
        case "updateEvent":
            guard let json = args.first as? String else { return #"{"success":false,"error":"missing args"}"# }
            return CalendarBridge.shared.updateEvent(json: json)
        case "deleteEvent":
            guard let eventId = args.first as? String else { return #"{"success":false}"# }
            return CalendarBridge.shared.deleteEvent(eventId: eventId)

        // Phase 4 — Notifications
        case "scheduleReminder":
            guard args.count >= 4,
                  let id      = args[0] as? String,
                  let title   = args[1] as? String,
                  let body    = args[2] as? String,
                  let ms      = (args[3] as? NSNumber)?.doubleValue else { return "null" }
            NotificationBridge.shared.scheduleReminder(id: id, title: title, body: body, triggerAtMillis: ms)
            return "null"

        case "cancelReminder":
            guard let id = args.first as? String else { return "null" }
            NotificationBridge.shared.cancelReminder(id: id)
            return "null"

        case "showNotification":
            guard args.count >= 2,
                  let title = args[0] as? String,
                  let body  = args[1] as? String else { return "null" }
            NotificationBridge.shared.showNotification(title: title, body: body)
            return "null"

        case "showTaskNotification":
            guard args.count >= 6,
                  let reminderId      = args[0] as? String,
                  let taskId          = args[1] as? String,
                  let title           = args[2] as? String,
                  let body            = args[3] as? String,
                  let type            = args[4] as? String else { return "null" }
            let isCalendarEvent = (args[5] as? Bool) ?? false
            NotificationBridge.shared.showTaskNotification(
                reminderId: reminderId, taskId: taskId,
                title: title, body: body,
                type: type, isCalendarEvent: isCalendarEvent
            )
            return "null"

        case "syncReminders":
            guard let json = args.first as? String else { return "null" }
            NotificationBridge.shared.syncReminders(json: json)
            return "null"

        case "getPendingAction":
            return NotificationBridge.shared.getPendingAction()

        // Phase 5+
        default:
            return "null"
        }
    }

    private func dispatchObsidian(method: String, args: [Any]) -> String {
        // Phase 5+: ObsidianBridge
        return "null"
    }

    // MARK: - Helpers

    private func parseArgs(from url: URL) -> [Any] {
        guard let query = url.query,
              let encoded = query.components(separatedBy: "args=").last,
              let decoded = encoded.removingPercentEncoding,
              let data    = decoded.data(using: .utf8),
              let json    = try? JSONSerialization.jsonObject(with: data),
              let array   = json as? [Any] else { return [] }
        return array
    }

    private func respond(to task: any WKURLSchemeTask, with json: String) {
        let data = json.data(using: .utf8) ?? Data()
        let response = HTTPURLResponse(
            url: task.request.url ?? URL(string: "about:blank")!,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json; charset=utf-8"]
        )!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }
}
