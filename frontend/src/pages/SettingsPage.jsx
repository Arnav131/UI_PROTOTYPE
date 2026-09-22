/**
 * SettingsPage — user preferences including notification permissions.
 */

import { useState, useEffect } from "react";
import {
  requestNotificationPermission,
  getNotificationPermission,
} from "../services/notificationService.js";
import { VoiceService } from "../services/voiceService.js";
import { useReminders } from "../context/ReminderContext.jsx";

export default function SettingsPage() {
  const [permState, setPermState] = useState("checking");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [testStatus, setTestStatus] = useState("");
  const { debugInfo } = useReminders();

  useEffect(() => {
    setPermState(getNotificationPermission());
    setVoiceSupported(VoiceService.isSupported());
    setVoiceEnabled(VoiceService.isEnabled());
  }, []);

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermState(result);
  };

  const handleToggleVoice = () => {
    const next = !voiceEnabled;
    VoiceService.setEnabled(next);
    setVoiceEnabled(next);
  };

  const handleTestVoice = () => {
    if (!voiceSupported) {
      setTestStatus("Voice is not supported by this browser.");
      return;
    }
    const ok = VoiceService.speak("Boss, this is a voice test.");
    setTestStatus(ok ? "🔊 Playing test voice…" : "Could not start speech.");
  };

  const permLabel = {
    granted: "✅ Enabled",
    denied: "❌ Denied (change in browser settings)",
    default: "Not set",
    unsupported: "Not supported by this browser",
    checking: "Checking...",
  };

  return (
    <div className="settings-page">
      {/* Notification Settings */}
      <div className="glass card settings-card">
        <div className="card-title">
          <span>🔔</span>
          <span>Notification Settings</span>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <strong>Browser Notifications</strong>
            <small>Get notified when a task is due, even if this tab isn't focused.</small>
          </div>
          <div className="settings-action">
            <span className="settings-status">{permLabel[permState] || permState}</span>
            {permState !== "granted" && permState !== "denied" && permState !== "unsupported" && (
              <button className="btn-primary btn-sm" onClick={handleRequestPermission}>
                Enable
              </button>
            )}
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <strong>In-App Notifications</strong>
            <small>Toast notifications appear within the app automatically.</small>
          </div>
          <div className="settings-action">
            <span className="settings-status">✅ Always active</span>
          </div>
        </div>
      </div>

      {/* Voice Assistance — Phase 2C */}
      <div className="glass card settings-card">
        <div className="card-title">
          <span>🔊</span>
          <span>Voice Assistance</span>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <strong>Speak Reminders Aloud</strong>
            <small>
              {voiceSupported
                ? "\"Boss, it's time for...\" — spoken when a task starts."
                : "Not supported by this browser."}
            </small>
          </div>
          <div className="settings-action">
            <span className="settings-status">
              {voiceSupported ? (voiceEnabled ? "🟢 On" : "⚪ Off") : "⚪ Unavailable"}
            </span>
            {voiceSupported && (
              <button className="btn-primary btn-sm" onClick={handleToggleVoice}>
                {voiceEnabled ? "Turn Off" : "Turn On"}
              </button>
            )}
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <strong>Test Voice</strong>
            <small>Play a sample so your browser can start speaking.</small>
          </div>
          <div className="settings-action">
            <span className="settings-status">{testStatus}</span>
            <button className="btn-secondary btn-sm" onClick={handleTestVoice} disabled={!voiceSupported}>
              ▶ Test Voice
            </button>
          </div>
        </div>
      </div>

      {/* Debug Info — dev only */}
      {import.meta.env.DEV && (
        <div className="glass card settings-card debug-card">
          <div className="card-title">
            <span>🛠️</span>
            <span>Reminder Debug (Dev Only)</span>
          </div>
          <div className="debug-grid">
            <span>Service:</span>
            <span>{debugInfo.active ? "🟢 Active" : "🔴 Inactive"}</span>
            <span>Last check:</span>
            <span>{debugInfo.lastCheck || "—"}</span>
            <span>Due reminders:</span>
            <span>{debugInfo.dueCount}</span>
            <span>Voice supported:</span>
            <span>{voiceSupported ? "Yes" : "No"}</span>
            <span>Voice enabled:</span>
            <span>{voiceEnabled ? "Yes" : "No"}</span>
            {debugInfo.error && (
              <>
                <span>Error:</span>
                <span className="debug-error">{debugInfo.error}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Future Settings Placeholder */}
      <div className="glass card settings-card">
        <div className="card-title">
          <img src="/assets/icons/gear.png" className="px" alt="" />
          <span>More Settings</span>
        </div>
        <p style={{ color: "var(--text-dim)", margin: "0.5rem 0 0" }}>
          User preferences, working hours, and assistant configuration coming soon.
        </p>
      </div>
    </div>
  );
}

