import { useEffect, useRef, useState } from "react";
import { addSession } from "../api.js";
import { pad } from "../utils.js";

const R = 110;
const CIRC = 2 * Math.PI * R;

export default function PomodoroClock() {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(25 * 60); // seconds
  const [saved, setSaved] = useState(false);
  const endTimeRef = useRef(null);
  const totalRef = useRef(25 * 60);

  const total = hours * 3600 + minutes * 60;

  function applyDuration() {
    totalRef.current = total;
    if (!running) setRemaining(total);
    setSaved(false);
  }

  useEffect(() => {
    applyDuration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, minutes]);

  useEffect(() => {
    if (!running) return;
    endTimeRef.current = Date.now() + remaining * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        setRunning(false);
        handleComplete();
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  async function handleComplete() {
    try {
      await addSession({
        label: "Pomodoro",
        durationMinutes: Math.round(totalRef.current / 60),
        mode: "focus",
      });
      setSaved(true);
    } catch (e) {
      console.error(e);
    }
  }

  function start() {
    if (total <= 0) return;
    if (!running && remaining <= 0) setRemaining(total);
    setRunning(true);
  }
  function pause() {
    setRunning(false);
  }
  function reset() {
    setRunning(false);
    setRemaining(total);
    setSaved(false);
  }

  const progress = total > 0 ? remaining / total : 0;
  const dash = CIRC * (1 - progress);
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const hh = Math.floor(mm / 60);
  const mmOnly = mm % 60;

  return (
    <div className="pomodoro">
      <div className="settings">
        <div className="stepper">
          <span>Hours</span>
          <button onClick={() => setHours((h) => Math.max(0, h - 1))}>-</button>
          <input
            type="number"
            min="0"
            max="12"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value) || 0)}
          />
          <button onClick={() => setHours((h) => Math.min(12, h + 1))}>+</button>
        </div>
        <div className="stepper">
          <span>Minutes</span>
          <button onClick={() => setMinutes((m) => Math.max(0, m - 1))}>-</button>
          <input
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value) || 0)}
          />
          <button onClick={() => setMinutes((m) => Math.min(59, m + 1))}>+</button>
        </div>
      </div>

      <div className="clock-wrap">
        <svg width="260" height="260" viewBox="0 0 260 260">
          <circle
            cx="130"
            cy="130"
            r={R}
            fill="none"
            stroke="#2a2f45"
            strokeWidth="14"
          />
          <circle
            cx="130"
            cy="130"
            r={R}
            fill="none"
            stroke="#ff6b6b"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dash}
            transform="rotate(-90 130 130)"
          />
        </svg>
        <div className="clock-face">
          <div className="clock-time">
            {pad(hh)}:{pad(mmOnly)}:{pad(ss)}
          </div>
          <div className="clock-label">{running ? "Focusing" : "Ready"}</div>
        </div>
      </div>

      <div className="controls">
        {running ? (
          <button onClick={pause}>Pause</button>
        ) : (
          <button onClick={start}>Start</button>
        )}
        <button onClick={reset}>Reset</button>
      </div>
      {saved && <div className="saved-note">Session saved ✓</div>}
    </div>
  );
}
