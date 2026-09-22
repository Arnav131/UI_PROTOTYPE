/**
 * MainLayout — sidebar navigation + main content area.
 * Uses the existing glassmorphism design system.
 */

import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import LiveClock from "../tools/LiveClock.jsx";

const NAV_ITEMS = [
  { to: "/", icon: "fire", label: "Dashboard" },
  { to: "/tasks", icon: "todo", label: "Tasks" },
  { to: "/schedule", icon: "coffee", label: "Schedule" },
  { to: "/assistant", icon: "star", label: "Assistant" },
  { to: "/tools", icon: "bolt", label: "Tools" },
  { to: "/settings", icon: "gear", label: "Settings" },
];

export default function MainLayout() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar glass">
        <div className="sidebar-brand">
          <img src="/assets/icons/tomato.png" className="px px-lg" alt="" />
          <span className="sidebar-title">Productivy</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
            >
              <img
                src={`/assets/icons/${item.icon}.png`}
                className="px"
                alt=""
              />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.first_name?.[0] || user?.username?.[0] || "U"}
            </div>
            <span className="sidebar-username">
              {user?.first_name || user?.username}
            </span>
          </div>
          <button className="sidebar-logout" onClick={handleLogout} title="Logout">
            <img src="/assets/icons/close.png" className="px" alt="" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        <header className="main-topbar">
          <div />
          <LiveClock />
        </header>
        <main className="main-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
