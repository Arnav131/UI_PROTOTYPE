/**
 * Reminder API calls — fetches due reminders from Phase 2A endpoint.
 * Does NOT duplicate any backend logic.
 */

import client from "./client.js";

/**
 * Check for tasks that are due for a reminder right now.
 * Backend is authoritative — this just fetches the result.
 *
 * @returns {Promise<{reminders: Array}>}
 */
export async function getDueReminders() {
  const res = await client.get("/tasks/reminders/due/");
  return res.data;
}
