/**
 * DashboardPage — greeting, today's progress, and upcoming tasks.
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getTasks } from "../api/tasks.js";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await getTasks();
      setTasks(data.results || []);
    } catch {
      /* handled gracefully */
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const todayTasks = tasks.filter((t) => {
    if (t.scheduled_start) return t.scheduled_start.startsWith(today);
    if (t.deadline) return t.deadline.startsWith(today);
    return false;
  });
  const activeTasks = tasks.filter(
    (t) => t.status === "TODO" || t.status === "IN_PROGRESS"
  );
  const completedToday = todayTasks.filter(
    (t) => t.status === "COMPLETED"
  ).length;
  const totalToday = todayTasks.length || 1;
  const progressPercent = Math.round((completedToday / totalToday) * 100);

  const upcomingScheduled = activeTasks
    .filter((t) => t.scheduled_start)
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))
    .slice(0, 5);

  const formatTime = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const priorityColor = (p) => {
    switch (p) {
      case "CRITICAL": return "#ff6b6b";
      case "HIGH": return "#ff8c42";
      case "MEDIUM": return "#ffd166";
      case "LOW": return "#7ac74f";
      default: return "var(--text-dim)";
    }
  };

  const name = user?.first_name || user?.username || "Boss";

  return (
    <div className="dashboard">
      {/* Greeting */}
      <div className="greeting-banner glass">
        <div className="greeting-text">
          <h1 className="greeting-title">
            {getGreeting()}, {name} 👋
          </h1>
          <p className="greeting-sub">
            {activeTasks.length > 0
              ? `You have ${activeTasks.length} active task${activeTasks.length > 1 ? "s" : ""}. Let's get things done!`
              : "No active tasks. Enjoy your free time!"}
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Today's Progress */}
        <div className="glass card dash-card">
          <div className="card-title">
            <img src="/assets/icons/fire.png" className="px" alt="" />
            <span>Today's Progress</span>
          </div>
          <div className="progress-ring-wrap">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle
                cx="60" cy="60" r="50"
                fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10"
              />
              <circle
                cx="60" cy="60" r="50"
                fill="none" stroke="var(--accent)" strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={314}
                strokeDashoffset={314 * (1 - progressPercent / 100)}
                transform="rotate(-90 60 60)"
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="progress-ring-text">
              <span className="progress-pct">{progressPercent}%</span>
              <span className="progress-label">done</span>
            </div>
          </div>
          <div className="progress-stats">
            <span>{completedToday} of {todayTasks.length} tasks completed</span>
          </div>
        </div>

        {/* Upcoming */}
        <div className="glass card dash-card">
          <div className="card-title">
            <img src="/assets/icons/bolt.png" className="px" alt="" />
            <span>Upcoming</span>
          </div>
          {loading ? (
            <div className="dash-loading">Loading...</div>
          ) : upcomingScheduled.length === 0 ? (
            <div className="dash-empty">No scheduled tasks upcoming</div>
          ) : (
            <div className="upcoming-list">
              {upcomingScheduled.map((task) => (
                <div key={task.id} className="upcoming-item">
                  <div className="upcoming-time">{formatTime(task.scheduled_start)}</div>
                  <div className="upcoming-info">
                    <span className="upcoming-title">{task.title}</span>
                    <div className="upcoming-meta">
                      <span
                        className="priority-dot"
                        style={{ background: priorityColor(task.priority) }}
                      />
                      <span>{task.priority}</span>
                      {task.is_locked && (
                        <span className="locked-badge">🔒 Locked</span>
                      )}
                      {task.duration_minutes && (
                        <span>{task.duration_minutes}min</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Tasks */}
        <div className="glass card dash-card dash-card-wide">
          <div className="card-title">
            <img src="/assets/icons/todo.png" className="px" alt="" />
            <span>Active Tasks</span>
            <Link to="/tasks" className="card-link">View all →</Link>
          </div>
          {loading ? (
            <div className="dash-loading">Loading...</div>
          ) : activeTasks.length === 0 ? (
            <div className="dash-empty">
              No active tasks.{" "}
              <Link to="/tasks" className="auth-link">Create one</Link>
            </div>
          ) : (
            <div className="quick-task-list">
              {activeTasks.slice(0, 8).map((task) => (
                <div key={task.id} className="quick-task-item">
                  <div
                    className="quick-task-check"
                    style={{ borderColor: priorityColor(task.priority) }}
                  >
                    {task.status === "COMPLETED" && "✓"}
                  </div>
                  <span className="quick-task-title">{task.title}</span>
                  {task.deadline && (
                    <span className="quick-task-deadline">
                      {new Date(task.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
