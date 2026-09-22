/**
 * NotificationService — frontend abstraction for delivering reminder events.
 *
 * Architecture:
 *   ReminderEvent
 *       ↓
 *   NotificationService.notify()
 *       ↓
 *   ┌──────────────┬──────────────┐
 *   │              │              │
 *   ▼              ▼              │
 *   In-App      Browser          │
 *   Toast       Notification     │
 *
 * This module is ONLY responsible for delivery, not detection.
 * It must NOT know about ReminderEngine, TimeProvider, or backend logic.
 */

/**
 * Map event_type to a human-readable message.
 * Deterministic — no AI/LLM involved.
 */
function formatMessage(reminder) {
  const title = reminder.task_title || "a task";
  switch (reminder.event_type) {
    case "TASK_STARTING_NOW":
      return { title: "🔔 Task Starting", body: `It's time for ${title}.` };
    case "TASK_STARTING_SOON":
      return { title: "⏰ Coming Up", body: `${title} starts soon.` };
    case "TASK_MISSED":
      return { title: "⚠️ Task Missed", body: `You missed ${title}.` };
    default:
      return { title: "📋 Reminder", body: title };
  }
}

/**
 * Send a browser notification if permission is granted.
 * Does NOT aggressively request permission — that should be done
 * via an explicit user interaction elsewhere.
 *
 * Falls back silently if browser notifications are unavailable or denied.
 */
function sendBrowserNotification(message) {
  try {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return; // Silently fall back — in-app toast is the primary
    }
    new Notification(message.title, {
      body: message.body,
      icon: "/assets/icons/tomato.png",
      tag: message.tag || "reminder", // prevents duplicate OS notifications
    });
  } catch {
    // Browser notification failed — in-app notification is the fallback
  }
}

/**
 * Request browser notification permission.
 * Should be called from an explicit user interaction (e.g., button click),
 * NOT automatically on page load.
 *
 * @returns {Promise<string>} Permission state: "granted", "denied", or "default"
 */
export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  if (Notification.permission === "denied") {
    return "denied";
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return "denied";
  }
}

/**
 * Get current browser notification permission state.
 */
export function getNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Process a single reminder event:
 * 1. Create a human-readable message
 * 2. Send browser notification (if permitted)
 * 3. Return the formatted notification for in-app display
 *
 * @param {object} reminder - A ReminderEvent from the backend
 * @returns {object} Formatted notification for in-app display
 */
export function processReminder(reminder) {
  const message = formatMessage(reminder);
  // Use task_id as tag to prevent duplicate OS-level notifications
  message.tag = `reminder-${reminder.task_id}`;

  // Attempt browser notification (fails silently if not permitted)
  sendBrowserNotification(message);

  // Return for in-app display
  return {
    id: reminder.task_id,
    eventType: reminder.event_type,
    title: message.title,
    body: message.body,
    scheduledTime: reminder.scheduled_time,
    timestamp: Date.now(),
  };
}
