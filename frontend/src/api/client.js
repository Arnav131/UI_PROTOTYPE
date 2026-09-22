/**
 * API client with JWT authentication.
 * All requests go through this client which handles:
 * - Base URL configuration
 * - JWT token injection
 * - Token refresh on 401
 * - Error handling
 */

import axios from "axios";

const API_BASE = "/api";

const client = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Inject JWT access token into every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — attempt token refresh
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refresh = localStorage.getItem("refresh_token");

      if (refresh) {
        try {
          const res = await axios.post(`${API_BASE}/auth/refresh/`, {
            refresh,
          });
          const newAccess = res.data.access;
          localStorage.setItem("access_token", newAccess);
          if (res.data.refresh) {
            localStorage.setItem("refresh_token", res.data.refresh);
          }
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return client(originalRequest);
        } catch {
          // Refresh failed — clear tokens and redirect to login
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default client;
