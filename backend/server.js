const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, "sessions.json");

app.use(cors());
app.use(express.json());

function loadSessions() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load sessions:", e);
  }
  return [];
}

function saveSessions(sessions) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(sessions, null, 2));
  } catch (e) {
    console.error("Failed to save sessions:", e);
  }
}

let sessions = loadSessions();

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/sessions", (req, res) => {
  res.json(sessions);
});

app.post("/api/sessions", (req, res) => {
  const { label, durationMinutes, mode } = req.body || {};
  if (!durationMinutes || durationMinutes <= 0) {
    return res.status(400).json({ error: "durationMinutes required" });
  }
  const session = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    label: label || "Pomodoro",
    durationMinutes,
    mode: mode || "focus",
    completedAt: new Date().toISOString(),
  };
  sessions.unshift(session);
  if (sessions.length > 100) sessions = sessions.slice(0, 100);
  saveSessions(sessions);
  res.status(201).json(session);
});

app.delete("/api/sessions/:id", (req, res) => {
  const { id } = req.params;
  sessions = sessions.filter((s) => s.id !== id);
  saveSessions(sessions);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Pomodoro backend listening on http://localhost:${PORT}`);
});
