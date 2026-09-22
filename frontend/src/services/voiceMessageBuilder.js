/**
 * VoiceMessageBuilder — deterministic, LLM-free conversion of a
 * ReminderEvent into a short spoken sentence.
 *
 * Kept separate from VoiceService so the "personality"/conversational
 * style (e.g. addressing the user as "Boss") can change later without
 * touching how speech is actually produced.
 *
 * Only handles event types the backend ReminderEngine actually emits
 * today: TASK_STARTING_NOW and TASK_MISSED (see
 * backend/tasks/reminder_engine.py — ReminderEvent.EVENT_STARTING_NOW /
 * EVENT_MISSED). Do not invent new event types here.
 */

const ADDRESS = "Boss";

export function buildSpeechText(reminder) {
  const title = reminder?.task_title || "your task";
  switch (reminder?.event_type) {
    case "TASK_STARTING_NOW":
      return `${ADDRESS}, it's time for ${title}.`;
    case "TASK_MISSED":
      return `${ADDRESS}, you missed ${title}.`;
    default:
      return null; // Unknown event type — say nothing rather than guess
  }
}
