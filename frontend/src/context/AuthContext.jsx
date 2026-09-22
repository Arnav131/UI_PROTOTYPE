/**
 * Authentication context — provides user state across the app.
 * Handles login, logout, registration, and auto-loading the user profile.
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as authApi from "../api/auth.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!authApi.isAuthenticated()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch {
      setUser(null);
      authApi.logout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const loginUser = async (credentials) => {
    await authApi.login(credentials);
    await loadUser();
  };

  const registerUser = async (data) => {
    await authApi.register(data);
    // Auto-login after registration
    await authApi.login({ username: data.username, password: data.password });
    await loadUser();
  };

  const logoutUser = () => {
    authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, registerUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
