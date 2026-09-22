/**
 * App — root component with routing.
 * 
 * Public routes: /login, /register
 * Protected routes: everything else (requires authentication)
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import MainLayout from "./components/layout/MainLayout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import TasksPage from "./pages/TasksPage.jsx";
import SchedulePage from "./pages/SchedulePage.jsx";
import AssistantPage from "./pages/AssistantPage.jsx";
import ToolsPage from "./pages/ToolsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

const SCENES = ["ramen_shop", "cozy_study_room", "moonlit_garden", "rainy_rooftop"];

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-screen">
        <img src="/assets/icons/tomato.png" className="px px-lg loading-spin" alt="" />
        <p>Loading...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppContent() {
  // Scene background — persisted in localStorage
  const scene = localStorage.getItem("scene") || "ramen_shop";

  return (
    <>
      <div
        className="scene-bg"
        style={{
          backgroundImage: `url(/assets/backgrounds/${scene}.png)`,
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="tools" element={<ToolsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}