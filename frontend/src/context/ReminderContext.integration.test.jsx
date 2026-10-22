import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReminderProvider, useReminders, TOAST_DURATION_MS } from "./ReminderContext.jsx";
import NotificationToast from "../components/NotificationToast.jsx";

vi.mock("../api/reminders.js", () => ({
  getDueReminders: vi.fn(),
}));

// Isolate this integration test from the real browser speech API —
// voice delivery is covered separately in notificationService.test.js.
vi.mock("../services/voiceService.js", () => ({
  speakOnce: vi.fn(),
}));

import { getDueReminders } from "../api/reminders.js";

function DebugProbe() {
  const { debugInfo } = useReminders();
  return <div data-testid="debug-error">{debugInfo.error || ""}</div>;
}

function renderApp() {
  return render(
    <ReminderProvider>
      <NotificationToast />
      <DebugProbe />
    </ReminderProvider>
  );
}

const SAMPLE_REMINDER = {
  event_type: "TASK_STARTING_NOW",
  task_id: "task-1",
  task_title: "Solve LeetCode",
  scheduled_time: "2026-01-01T19:30:00+05:30",
};

describe("Reminder pipeline integration (ReminderContext + NotificationToast)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an in-app toast for a due reminder returned by the backend", async () => {
    getDueReminders.mockResolvedValue({ reminders: [SAMPLE_REMINDER] });

    renderApp();

    expect(
      await screen.findByText(/It's time for Solve LeetCode/)
    ).toBeInTheDocument();
  });

  it("dismisses a toast when the close button is clicked", async () => {
    getDueReminders.mockResolvedValue({ reminders: [SAMPLE_REMINDER] });
    const user = userEvent.setup();

    renderApp();

    await screen.findByText(/It's time for Solve LeetCode/);
    await user.click(screen.getByLabelText("Dismiss notification"));

    expect(screen.queryByText(/It's time for Solve LeetCode/)).not.toBeInTheDocument();
  });

  it("fails gracefully when the backend is unreachable — no crash, no toast", async () => {
    getDueReminders.mockRejectedValue(new Error("Network Error"));

    renderApp();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("debug-error")).toHaveTextContent("Network Error");
    expect(document.querySelector(".notification-toast")).not.toBeInTheDocument();
  });

  it("does not duplicate or resurrect a reminder across repeated polls (idempotency)", async () => {
    // Simulates the real backend: the reminder is returned exactly once,
    // then never again (Phase 2A idempotency, verified separately in the
    // Django test suite). The frontend must never fabricate a second
    // occurrence out of an empty response, no matter how many times it polls.
    getDueReminders
      .mockResolvedValueOnce({ reminders: [SAMPLE_REMINDER] })
      .mockResolvedValue({ reminders: [] });

    // Sanity check on the assumption this test relies on: a toast's
    // auto-dismiss window is shorter than the poll interval, so by the
    // time the next poll fires, any prior toast will already be gone —
    // that's expected UI behavior, not a dedupe failure.
    expect(TOAST_DURATION_MS).toBeLessThan(15000);

    vi.useFakeTimers();

    renderApp();

    // Flush the initial checkReminders() call made on mount.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getDueReminders).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/It's time for Solve LeetCode/)).toHaveLength(1);

    // One poll cycle later: the original toast has auto-dismissed, and the
    // (idempotent) empty response must not resurrect or duplicate it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(getDueReminders).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/It's time for Solve LeetCode/)).not.toBeInTheDocument();

    // A third poll cycle — still nothing fabricated, still polling cleanly.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(getDueReminders).toHaveBeenCalledTimes(3);
    expect(screen.queryByText(/It's time for Solve LeetCode/)).not.toBeInTheDocument();
  });

  it("stops polling on unmount (no interval leak)", async () => {
    getDueReminders.mockResolvedValue({ reminders: [] });
    vi.useFakeTimers();

    const { unmount } = renderApp();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getDueReminders).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    // No further calls after unmount — the interval was cleared.
    expect(getDueReminders).toHaveBeenCalledTimes(1);
  });
});
