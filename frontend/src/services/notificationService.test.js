import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./voiceService.js", () => ({
  speakOnce: vi.fn(),
}));

import { speakOnce } from "./voiceService.js";
import {
  processReminder,
  requestNotificationPermission,
  getNotificationPermission,
} from "./notificationService.js";

function mockNotificationAPI(permission = "granted") {
  const NotificationMock = vi.fn();
  NotificationMock.permission = permission;
  NotificationMock.requestPermission = vi.fn().mockResolvedValue(permission);
  window.Notification = NotificationMock;
  return NotificationMock;
}

describe("notificationService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete window.Notification;
  });

  describe("getNotificationPermission / requestNotificationPermission", () => {
    it("reports unsupported when there is no Notification API", () => {
      expect(getNotificationPermission()).toBe("unsupported");
    });

    it("reports the current permission when supported", () => {
      mockNotificationAPI("granted");
      expect(getNotificationPermission()).toBe("granted");
    });

    it("requests permission only when not already decided", async () => {
      const NotificationMock = mockNotificationAPI("default");
      const result = await requestNotificationPermission();
      expect(NotificationMock.requestPermission).toHaveBeenCalledTimes(1);
      expect(result).toBe("default");
    });

    it("does not re-prompt once already granted", async () => {
      const NotificationMock = mockNotificationAPI("granted");
      const result = await requestNotificationPermission();
      expect(NotificationMock.requestPermission).not.toHaveBeenCalled();
      expect(result).toBe("granted");
    });

    it("does not re-prompt once already denied", async () => {
      const NotificationMock = mockNotificationAPI("denied");
      const result = await requestNotificationPermission();
      expect(NotificationMock.requestPermission).not.toHaveBeenCalled();
      expect(result).toBe("denied");
    });
  });

  describe("processReminder", () => {
    const reminder = {
      event_type: "TASK_STARTING_NOW",
      task_id: "task-1",
      task_title: "Solve LeetCode",
      scheduled_time: "2026-01-01T19:30:00+05:30",
    };

    it("returns a correctly formatted in-app toast", () => {
      const toast = processReminder(reminder);
      expect(toast).toMatchObject({
        id: "task-1",
        eventType: "TASK_STARTING_NOW",
        title: "🔔 Task Starting",
        body: "It's time for Solve LeetCode.",
        scheduledTime: reminder.scheduled_time,
      });
      expect(typeof toast.timestamp).toBe("number");
    });

    it("sends a browser notification when permission is granted", () => {
      const NotificationMock = mockNotificationAPI("granted");
      processReminder(reminder);
      expect(NotificationMock).toHaveBeenCalledTimes(1);
      const [title, options] = NotificationMock.mock.calls[0];
      expect(title).toBe("🔔 Task Starting");
      expect(options.body).toBe("It's time for Solve LeetCode.");
      expect(options.tag).toBe("reminder-task-1");
    });

    it("does not send a browser notification when permission is not granted, but still returns a toast", () => {
      const NotificationMock = mockNotificationAPI("denied");
      const toast = processReminder(reminder);
      expect(NotificationMock).not.toHaveBeenCalled();
      expect(toast.title).toBe("🔔 Task Starting");
    });

    it("still returns a toast when the browser has no Notification API at all", () => {
      const toast = processReminder(reminder);
      expect(toast.body).toBe("It's time for Solve LeetCode.");
    });

    it("calls VoiceService.speakOnce with the correct dedupe key and deterministic sentence", () => {
      processReminder(reminder);
      expect(speakOnce).toHaveBeenCalledWith(
        "task-1:TASK_STARTING_NOW",
        "Boss, it's time for Solve LeetCode."
      );
    });

    it("builds the correct voice sentence for a TASK_MISSED event", () => {
      processReminder({ ...reminder, event_type: "TASK_MISSED" });
      expect(speakOnce).toHaveBeenCalledWith(
        "task-1:TASK_MISSED",
        "Boss, you missed Solve LeetCode."
      );
    });

    it("does not call speakOnce for an event type with no voice message", () => {
      processReminder({ ...reminder, event_type: "TASK_STARTING_SOON" });
      expect(speakOnce).not.toHaveBeenCalled();
    });

    it("still returns a valid toast if voice delivery throws", () => {
      speakOnce.mockImplementation(() => {
        throw new Error("voice boom");
      });
      const toast = processReminder(reminder);
      expect(toast.title).toBe("🔔 Task Starting");
      expect(toast.body).toBe("It's time for Solve LeetCode.");
    });
  });
});
