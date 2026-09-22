/**
 * Authentication API calls.
 */

import client from "./client.js";

export async function register({ username, email, password, passwordConfirm, firstName }) {
  const res = await client.post("/auth/register/", {
    username,
    email,
    password,
    password_confirm: passwordConfirm,
    first_name: firstName,
  });
  return res.data;
}

export async function login({ username, password }) {
  const res = await client.post("/auth/login/", { username, password });
  const { access, refresh } = res.data;
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
  return res.data;
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export async function getProfile() {
  const res = await client.get("/auth/me/");
  return res.data;
}

export function isAuthenticated() {
  return !!localStorage.getItem("access_token");
}
