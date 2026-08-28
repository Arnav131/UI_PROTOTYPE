const API_BASE = "/api";

export async function getSessions() {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) throw new Error("Failed to load sessions");
  return res.json();
}

export async function addSession(session) {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  if (!res.ok) throw new Error("Failed to save session");
  return res.json();
}

export async function deleteSession(id) {
  const res = await fetch(`${API_BASE}/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete session");
  return res.json();
}
