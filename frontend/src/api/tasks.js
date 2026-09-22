/**
 * Task API calls — all CRUD operations plus complete/reopen.
 */

import client from "./client.js";

export async function getTasks(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.date) params.set("date", filters.date);
  const res = await client.get(`/tasks/?${params.toString()}`);
  return res.data;
}

export async function getTask(id) {
  const res = await client.get(`/tasks/${id}/`);
  return res.data;
}

export async function createTask(data) {
  const res = await client.post("/tasks/", data);
  return res.data;
}

export async function updateTask(id, data) {
  const res = await client.patch(`/tasks/${id}/`, data);
  return res.data;
}

export async function deleteTask(id) {
  await client.delete(`/tasks/${id}/`);
}

export async function completeTask(id) {
  const res = await client.post(`/tasks/${id}/complete/`);
  return res.data;
}

export async function reopenTask(id) {
  const res = await client.post(`/tasks/${id}/reopen/`);
  return res.data;
}
