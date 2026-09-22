/**
 * NotificationToast — in-app notification display for reminder events.
 *
 * Shows a stack of toast notifications anchored to the top-right.
 * Each toast auto-dismisses and can be manually closed.
 *
 * Uses the existing glassmorphism design system.
 */

import { useReminders } from "../context/ReminderContext.jsx";

/** Icon mapping for event types */
const EVENT_ICONS = {
  TASK_STARTING_NOW: "🔔",
  TASK_STARTING_SOON: "⏰",
  TASK_MISSED: "⚠️",
};

function formatScheduledTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export default function NotificationToast() {
  const { notifications, dismissNotification } = useReminders();

  if (notifications.length === 0) return null;

  return (
    <div className="notification-toast-container" role="alert" aria-live="polite">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`notification-toast glass ${n.eventType === "TASK_MISSED" ? "toast-missed" : "toast-due"}`}
        >
          <div className="toast-icon">
            {EVENT_ICONS[n.eventType] || "📋"}
          </div>
          <div className="toast-content">
            <div className="toast-title">{n.title}</div>
            <div className="toast-body">{n.body}</div>
            {n.scheduledTime && (
              <div className="toast-time">
                {formatScheduledTime(n.scheduledTime)}
              </div>
            )}
          </div>
          <button
            className="toast-close"
            onClick={() => dismissNotification(n.id)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
