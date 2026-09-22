/**
 * TasksPage — full task management with create/edit modal, filters, and CRUD.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  reopenTask,
} from "../api/tasks.js";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const PRIORITY_COLORS = {
  CRITICAL: "#ff6b6b",
  HIGH: "#ff8c42",
  MEDIUM: "#ffd166",
  LOW: "#7ac74f",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  notes: "",
  priority: "MEDIUM",
  deadline: "",
  scheduled_start: "",
  estimated_duration_minutes: 60,
  is_locked: false,
  is_flexible: true,
};

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", priority: "" });
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTasks = useCallback(async () => {
    try {
      const data = await getTasks(filter);
      setTasks(data.results || []);
    } catch {
      // handled gracefully
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const openCreate = () => {
    setEditingTask(null);
    setForm({ ...EMPTY_FORM });
    setError("");
    setShowModal(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      notes: task.notes || "",
      priority: task.priority,
      deadline: task.deadline ? task.deadline.slice(0, 16) : "",
      scheduled_start: task.scheduled_start
        ? task.scheduled_start.slice(0, 16)
        : "",
      estimated_duration_minutes: task.duration_minutes || 60,
      is_locked: task.is_locked,
      is_flexible: task.is_flexible,
    });
    setError("");
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const payload = { ...form };
    // Convert local datetime inputs to ISO with timezone
    if (payload.deadline) payload.deadline = new Date(payload.deadline).toISOString();
    if (payload.scheduled_start)
      payload.scheduled_start = new Date(payload.scheduled_start).toISOString();

    try {
      if (editingTask) {
        await updateTask(editingTask.id, payload);
      } else {
        await createTask(payload);
      }
      setShowModal(false);
      await loadTasks();
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msg =
          typeof data === "string"
            ? data
            : Object.entries(data)
                .map(([k, v]) => `${k}: ${[].concat(v).join(", ")}`)
                .join("; ");
        setError(msg);
      } else {
        setError("Failed to save task.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await deleteTask(task.id);
      await loadTasks();
    } catch {
      // handled
    }
  };

  const handleComplete = async (task) => {
    try {
      if (task.status === "COMPLETED") {
        await reopenTask(task.id);
      } else {
        await completeTask(task.id);
      }
      await loadTasks();
    } catch {
      // handled
    }
  };

  const set = (key) => (e) => {
    const val =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      // Business rule: locked implies not flexible
      if (key === "is_locked" && val) next.is_flexible = false;
      return next;
    });
  };

  const formatTime = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <h1 className="page-title">
          <img src="/assets/icons/todo.png" className="px px-lg" alt="" />
          Tasks
        </h1>
        <button className="btn-primary" onClick={openCreate}>
          <img src="/assets/icons/edit.png" className="px" alt="" />
          New Task
        </button>
      </div>

      {/* Filters */}
      <div className="task-filters">
        <select
          className="filter-select glass-inset"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          className="filter-select glass-inset"
          value={filter.priority}
          onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="tasks-loading">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="tasks-empty glass">
          <img src="/assets/icons/star.png" className="px px-lg" alt="" />
          <p>No tasks yet. Create your first task!</p>
        </div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`task-card glass${
                task.status === "COMPLETED" ? " task-done" : ""
              }`}
            >
              <button
                className="task-check-btn"
                onClick={() => handleComplete(task)}
                style={{ borderColor: PRIORITY_COLORS[task.priority] }}
                title={
                  task.status === "COMPLETED" ? "Reopen task" : "Complete task"
                }
              >
                {task.status === "COMPLETED" && (
                  <img src="/assets/icons/check.png" className="px" alt="" />
                )}
              </button>

              <div className="task-body" onClick={() => openEdit(task)}>
                <div className="task-title-row">
                  <span className="task-title">{task.title}</span>
                  {task.is_locked && <span className="locked-badge">🔒</span>}
                </div>
                <div className="task-meta">
                  <span
                    className="priority-badge"
                    style={{
                      background: PRIORITY_COLORS[task.priority] + "22",
                      color: PRIORITY_COLORS[task.priority],
                    }}
                  >
                    {task.priority}
                  </span>
                  {task.scheduled_start && (
                    <span className="task-time">
                      📅 {formatTime(task.scheduled_start)}
                    </span>
                  )}
                  {task.duration_minutes && (
                    <span className="task-duration">
                      ⏱ {task.duration_minutes}min
                    </span>
                  )}
                  {task.deadline && (
                    <span
                      className={`task-deadline${task.is_overdue ? " overdue" : ""}`}
                    >
                      ⏰ {formatTime(task.deadline)}
                    </span>
                  )}
                </div>
              </div>

              <button
                className="task-delete-btn"
                onClick={() => handleDelete(task)}
                title="Delete task"
              >
                <img src="/assets/icons/trash.png" className="px" alt="" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTask ? "Edit Task" : "New Task"}</h2>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                <img src="/assets/icons/close.png" className="px" alt="" />
              </button>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSave} className="task-form">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  className="form-input glass-inset"
                  value={form.title}
                  onChange={set("title")}
                  placeholder="What needs to be done?"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-input form-textarea glass-inset"
                  value={form.description}
                  onChange={set("description")}
                  placeholder="Add details..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    className="form-input glass-inset"
                    value={form.priority}
                    onChange={set("priority")}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Duration (min)</label>
                  <input
                    type="number"
                    className="form-input glass-inset"
                    value={form.estimated_duration_minutes}
                    onChange={set("estimated_duration_minutes")}
                    min="5"
                    max="480"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Schedule Start</label>
                  <input
                    type="datetime-local"
                    className="form-input glass-inset"
                    value={form.scheduled_start}
                    onChange={set("scheduled_start")}
                  />
                </div>
                <div className="form-group">
                  <label>Deadline</label>
                  <input
                    type="datetime-local"
                    className="form-input glass-inset"
                    value={form.deadline}
                    onChange={set("deadline")}
                  />
                </div>
              </div>

              <div className="form-row form-checks">
                <label className="form-check">
                  <input
                    type="checkbox"
                    checked={form.is_locked}
                    onChange={set("is_locked")}
                  />
                  <span>🔒 Locked</span>
                  <small>Cannot be moved by scheduler</small>
                </label>
                <label className="form-check">
                  <input
                    type="checkbox"
                    checked={form.is_flexible}
                    onChange={set("is_flexible")}
                    disabled={form.is_locked}
                  />
                  <span>🔄 Flexible</span>
                  <small>Can be rescheduled</small>
                </label>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  className="form-input form-textarea glass-inset"
                  value={form.notes}
                  onChange={set("notes")}
                  placeholder="Personal notes..."
                  rows={2}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                >
                  <img src="/assets/icons/check.png" className="px" alt="" />
                  {saving
                    ? "Saving..."
                    : editingTask
                    ? "Update Task"
                    : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
