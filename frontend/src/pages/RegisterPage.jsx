/**
 * RegisterPage — glassmorphism registration form.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RegisterPage() {
  const { registerUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    firstName: "",
    password: "",
    passwordConfirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await registerUser(form);
      navigate("/");
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msg = Object.values(data).flat().join(" ");
        setError(msg || "Registration failed.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="auth-page">
      <div className="auth-card glass">
        <div className="auth-header">
          <img src="/assets/icons/star.png" className="px px-lg" alt="" />
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Start your productivity journey</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="reg-name">First Name</label>
            <input
              id="reg-name"
              type="text"
              className="form-input glass-inset"
              value={form.firstName}
              onChange={set("firstName")}
              placeholder="What should I call you?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-username">Username</label>
            <input
              id="reg-username"
              type="text"
              className="form-input glass-inset"
              value={form.username}
              onChange={set("username")}
              placeholder="Choose a username"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              className="form-input glass-inset"
              value={form.email}
              onChange={set("email")}
              placeholder="you@example.com"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                className="form-input glass-inset"
                value={form.password}
                onChange={set("password")}
                placeholder="Min 8 characters"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-confirm">Confirm</label>
              <input
                id="reg-confirm"
                type="password"
                className="form-input glass-inset"
                value={form.passwordConfirm}
                onChange={set("passwordConfirm")}
                placeholder="Re-enter password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary auth-submit"
            disabled={loading}
          >
            <img src="/assets/icons/check.png" className="px" alt="" />
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <Link to="/login" className="auth-link">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
