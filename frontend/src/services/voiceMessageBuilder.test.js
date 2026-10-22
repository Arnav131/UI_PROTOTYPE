import { describe, it, expect } from "vitest";
import { buildSpeechText } from "./voiceMessageBuilder.js";

describe("buildSpeechText", () => {
  it("builds a STARTING_NOW sentence with the task title", () => {
    const text = buildSpeechText({
      event_type: "TASK_STARTING_NOW",
      task_title: "Solve LeetCode",
    });
    expect(text).toBe("Boss, it's time for Solve LeetCode.");
  });

  it("builds a MISSED sentence with the task title", () => {
    const text = buildSpeechText({
      event_type: "TASK_MISSED",
      task_title: "Gym",
    });
    expect(text).toBe("Boss, you missed Gym.");
  });

  it("falls back to a generic subject when task_title is missing", () => {
    const text = buildSpeechText({ event_type: "TASK_STARTING_NOW" });
    expect(text).toBe("Boss, it's time for your task.");
  });

  it("returns null for unknown event types instead of guessing", () => {
    const text = buildSpeechText({
      event_type: "TASK_STARTING_SOON",
      task_title: "Something",
    });
    expect(text).toBeNull();
  });

  it("returns null when given no reminder at all", () => {
    expect(buildSpeechText(undefined)).toBeNull();
    expect(buildSpeechText(null)).toBeNull();
  });
});
