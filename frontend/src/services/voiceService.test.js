import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}

function makeFakeSynth({ voices = [{ lang: "en-US", default: true }], throwOnSpeak = false } = {}) {
  return {
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn(),
    speak: vi.fn((utterance) => {
      if (throwOnSpeak) throw new Error("boom");
      return utterance;
    }),
  };
}

async function loadVoiceServiceWithSupport(synthOverrides) {
  window.SpeechSynthesisUtterance = FakeUtterance;
  window.speechSynthesis = makeFakeSynth(synthOverrides);
  vi.resetModules();
  return import("./voiceService.js");
}

async function loadVoiceServiceWithoutSupport() {
  delete window.SpeechSynthesisUtterance;
  delete window.speechSynthesis;
  vi.resetModules();
  return import("./voiceService.js");
}

describe("VoiceService", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    delete window.SpeechSynthesisUtterance;
    delete window.speechSynthesis;
    vi.restoreAllMocks();
  });

  describe("isSupported", () => {
    it("returns true when speechSynthesis and SpeechSynthesisUtterance exist", async () => {
      const { isSupported } = await loadVoiceServiceWithSupport();
      expect(isSupported()).toBe(true);
    });

    it("returns false when the browser has no speechSynthesis", async () => {
      const { isSupported } = await loadVoiceServiceWithoutSupport();
      expect(isSupported()).toBe(false);
    });
  });

  describe("isEnabled / setEnabled", () => {
    it("defaults to disabled (conservative default)", async () => {
      const { isEnabled } = await loadVoiceServiceWithSupport();
      expect(isEnabled()).toBe(false);
    });

    it("persists the enabled preference across calls", async () => {
      const { isEnabled, setEnabled } = await loadVoiceServiceWithSupport();
      setEnabled(true);
      expect(isEnabled()).toBe(true);
      setEnabled(false);
      expect(isEnabled()).toBe(false);
    });
  });

  describe("speak", () => {
    it("hands an utterance to speechSynthesis.speak and returns true", async () => {
      const { speak } = await loadVoiceServiceWithSupport();
      const result = speak("Boss, this is a voice test.");
      expect(result).toBe(true);
      expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
      const utterance = window.speechSynthesis.speak.mock.calls[0][0];
      expect(utterance.text).toBe("Boss, this is a voice test.");
      expect(utterance.rate).toBe(1);
      expect(utterance.pitch).toBe(1);
      expect(utterance.volume).toBe(1);
    });

    it("returns false when the browser does not support speech", async () => {
      const { speak } = await loadVoiceServiceWithoutSupport();
      expect(speak("hello")).toBe(false);
    });

    it("returns false for empty text without touching speechSynthesis", async () => {
      const { speak } = await loadVoiceServiceWithSupport();
      expect(speak("")).toBe(false);
      expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    });

    it("catches internal errors and returns false instead of throwing", async () => {
      const { speak } = await loadVoiceServiceWithSupport({ throwOnSpeak: true });
      expect(() => speak("hello")).not.toThrow();
      expect(speak("hello")).toBe(false);
    });
  });

  describe("speakOnce", () => {
    it("does nothing when voice is disabled", async () => {
      const { speakOnce } = await loadVoiceServiceWithSupport();
      const result = speakOnce("task-1:TASK_STARTING_NOW", "Boss, it's time for LeetCode.");
      expect(result).toBe(false);
      expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    });

    it("speaks once when enabled, and never again for the same key", async () => {
      const { speakOnce, setEnabled } = await loadVoiceServiceWithSupport();
      setEnabled(true);

      const first = speakOnce("task-1:TASK_STARTING_NOW", "Boss, it's time for LeetCode.");
      const second = speakOnce("task-1:TASK_STARTING_NOW", "Boss, it's time for LeetCode.");

      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    });

    it("speaks distinct keys independently (multiple simultaneous reminders)", async () => {
      const { speakOnce, setEnabled } = await loadVoiceServiceWithSupport();
      setEnabled(true);

      const a = speakOnce("task-1:TASK_STARTING_NOW", "Boss, it's time for LeetCode.");
      const b = speakOnce("task-2:TASK_STARTING_NOW", "Boss, it's time for Gym.");

      expect(a).toBe(true);
      expect(b).toBe(true);
      expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2);
    });

    it("never speaks when the browser is unsupported, even if enabled", async () => {
      const { speakOnce, setEnabled } = await loadVoiceServiceWithoutSupport();
      setEnabled(true);
      expect(speakOnce("task-1:TASK_STARTING_NOW", "text")).toBe(false);
    });
  });
});
