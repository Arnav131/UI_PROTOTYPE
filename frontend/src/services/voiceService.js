/**
 * VoiceService — deterministic, browser-native text-to-speech delivery.
 *
 * Architecture:
 *   ReminderEvent → NotificationService.processReminder()
 *                       ↓
 *                  VoiceMessageBuilder (deterministic text)
 *                       ↓
 *                  VoiceService.speakOnce(key, text)
 *                       ↓
 *                  window.speechSynthesis
 *
 * This module knows NOTHING about reminders, tasks, or the backend.
 * It only knows how to safely speak a string of text.
 *
 * Design decisions (documented, do not change without discussion):
 *
 * - Overlap: we rely on the browser's NATIVE speechSynthesis queue.
 *   Calling speak() while something is already speaking does not cancel
 *   it — browsers automatically play queued utterances in order. We
 *   deliberately never call speechSynthesis.cancel() for reminders, so
 *   "Reminder A" always finishes before "Reminder B" starts. This is the
 *   simplest predictable behavior and avoids building a custom queue.
 *
 * - Duplicate protection: speakOnce(key, text) remembers every key it has
 *   already spoken (in-memory, per page load, module-scoped Set) and
 *   silently ignores repeats. Callers pass a stable key derived from the
 *   backend's task_id + event_type so the same reminder occurrence can
 *   never be spoken twice even if processed more than once on the
 *   frontend. This module-scoped Set also means remounting a React
 *   component can never cause a duplicate speech — the dedupe state
 *   lives outside React entirely.
 *
 * - Preference: voice is OFF by default (conservative — many browsers
 *   restrict/queue speech until a user gesture has happened) and stored
 *   in localStorage so it survives reloads. The Settings page's toggle
 *   and "Test Voice" button are the two user-gesture entry points.
 *
 * - Voice selection: lazily picks a browser-provided English voice via
 *   the async `voiceschanged` event. This listener is registered ONCE at
 *   module scope (not inside any component), so it can never accumulate
 *   duplicate listeners across mounts/remounts. If no English voice is
 *   found, the browser's default voice is used — never hardcoded.
 */

const STORAGE_KEY = "voice_enabled";
const RATE = 1;
const PITCH = 1;
const VOLUME = 1;

const spokenKeys = new Set();
let cachedVoice = null;

function synth() {
  return typeof window !== "undefined" ? window.speechSynthesis : null;
}

/** Whether this browser supports SpeechSynthesis at all. */
export function isSupported() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

/** Whether the user has opted into voice reminders (default: off). */
export function isEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

/** Persist the user's voice preference. */
export function setEnabled(enabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

function loadPreferredVoice() {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices();
  if (!voices || voices.length === 0) return null;
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith("en") && v.default) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
    voices[0]
  );
}

if (isSupported()) {
  cachedVoice = loadPreferredVoice();
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    cachedVoice = loadPreferredVoice();
  });
}

/**
 * Low-level speak — always attempts speech regardless of the
 * enabled/disabled preference. Used for the explicit "Test Voice"
 * action, which also serves as the user-gesture that unblocks speech
 * in restrictive browsers. Never throws.
 *
 * @returns {boolean} true if speech was handed to the browser
 */
export function speak(text) {
  const s = synth();
  if (!s || !text) return false;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = RATE;
    utterance.pitch = PITCH;
    utterance.volume = VOLUME;
    if (cachedVoice) utterance.voice = cachedVoice;
    utterance.onerror = (event) => {
      console.warn("[VoiceService] Speech error:", event.error);
    };
    s.speak(utterance);
    return true;
  } catch (err) {
    console.warn("[VoiceService] speak() failed:", err);
    return false;
  }
}

/**
 * Speak reminder text exactly once per unique key, and only if the user
 * has voice enabled and the browser supports it. This is the entry point
 * reminder delivery should use — NOT speak() directly.
 *
 * @param {string} key - stable identity for this reminder occurrence,
 *                        e.g. `${task_id}:${event_type}`
 * @param {string} text - deterministic speech text
 * @returns {boolean} true if speech was newly triggered
 */
export function speakOnce(key, text) {
  if (!isEnabled() || !isSupported()) return false;
  if (!key || !text || spokenKeys.has(key)) return false;
  spokenKeys.add(key);
  return speak(text);
}

export const VoiceService = { isSupported, isEnabled, setEnabled, speak, speakOnce };
