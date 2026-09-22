/**
 * ReminderContext — provides a single, global polling loop for reminder checks.
 *
 * Architecture:
 *   AuthProvider (user state)
 *       ↓
 *   ReminderProvider (polling loop)
 *       ↓ polls GET /api/tasks/reminders/due/
 *       ↓ processes results via NotificationService
 *       ↓ exposes notifications[] state for in-app display
 *
 * CRITICAL: Only ONE polling loop exists across the entire app.
 * Mounting/unmounting pages does NOT create additional loops.
 * The provider lives inside the authenticated route wrapper.
 *
 * Polling lifecycle:
 * - Starts when user is authenticated and provider mounts
 * - Stops on unmount (logout / navigate to public route)
 * - Exactly one interval at any time
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { getDueReminders } from "../api/reminders.js";
import { processReminder } from "../services/notificationService.js";

const ReminderContext = createContext(null);

/** Default polling interval in ms — configurable */
const POLL_INTERVAL_MS = 15_000; // 15 seconds

/** How long a toast stays visible (ms) */
export const TOAST_DURATION_MS = 8_000;

export function ReminderProvider({ children }) {
  // Active in-app notifications (visible toasts)
  const [notifications, setNotifications] = useState([]);

  // Debug state for development
  const [debugInfo, setDebugInfo] = useState({
    active: false,
    lastCheck: null,
    dueCount: 0,
    error: null,
  });

  // Ref to track the polling interval — ensures exactly one loop
  const intervalRef = useRef(null);

  // Ref to prevent React StrictMode double-mount issues
  const mountedRef = useRef(false);

  /**
   * Dismiss a notification by its id.
   */
  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  /**
   * Dismiss all notifications.
   */
  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  /**
   * Core polling function — called on interval.
   * Fetches due reminders from backend and processes them.
   */
  const checkReminders = useCallback(async () => {
    try {
      const data = await getDueReminders();
      const reminders = data.reminders || [];

      setDebugInfo((prev) => ({
        ...prev,
        lastCheck: new Date().toLocaleTimeString(),
        dueCount: reminders.length,
        error: null,
      }));

      if (reminders.length === 0) return;

      // Process each reminder through NotificationService
      const newNotifications = reminders.map(processReminder);

      // Add to state — backend idempotency prevents duplicates across polls,
      // but we also deduplicate by task_id in case of UI lifecycle issues
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const unique = newNotifications.filter((n) => !existingIds.has(n.id));
        return [...prev, ...unique];
      });
    } catch (err) {
      // API failure must NOT crash the app
      setDebugInfo((prev) => ({
        ...prev,
        lastCheck: new Date().toLocaleTimeString(),
        error: err.message || "API error",
      }));
      // Don't spam console — log once
      if (import.meta.env.DEV) {
        console.warn("[ReminderService] API check failed:", err.message);
      }
    }
  }, []);

  /**
   * Start/stop polling based on mount lifecycle.
   * Ensures EXACTLY ONE interval exists.
   */
  useEffect(() => {
    // Prevent double-mount in StrictMode
    if (mountedRef.current) return;
    mountedRef.current = true;

    // Run first check immediately
    checkReminders();

    // Start interval
    intervalRef.current = setInterval(checkReminders, POLL_INTERVAL_MS);

    setDebugInfo((prev) => ({ ...prev, active: true }));

    // Cleanup — stop polling on unmount
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDebugInfo((prev) => ({ ...prev, active: false }));
    };
  }, [checkReminders]);

  /**
   * Auto-dismiss notifications after TOAST_DURATION_MS.
   */
  useEffect(() => {
    if (notifications.length === 0) return;

    const timers = notifications.map((n) => {
      const age = Date.now() - n.timestamp;
      const remaining = Math.max(0, TOAST_DURATION_MS - age);
      return setTimeout(() => dismissNotification(n.id), remaining);
    });

    return () => timers.forEach(clearTimeout);
  }, [notifications, dismissNotification]);

  return (
    <ReminderContext.Provider
      value={{
        notifications,
        dismissNotification,
        dismissAll,
        debugInfo,
      }}
    >
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const ctx = useContext(ReminderContext);
  if (!ctx)
    throw new Error("useReminders must be used within ReminderProvider");
  return ctx;
}
