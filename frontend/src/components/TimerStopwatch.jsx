import { useState, useEffect, useRef } from "react";

export default function TimerStopwatch() {
  const [mode, setMode] = useState("stopwatch"); // 'stopwatch' or 'timer'
  
  // Stopwatch state
  const [swTime, setSwTime] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const swInterval = useRef(null);

  // Timer state
  const [tmMinutes, setTmMinutes] = useState(5);
  const [tmSeconds, setTmSeconds] = useState(0);
  const [tmRunning, setTmRunning] = useState(false);
  const tmInterval = useRef(null);

  // Stopwatch Logic
  useEffect(() => {
    if (swRunning) {
      swInterval.current = setInterval(() => setSwTime((t) => t + 1), 1000);
    } else {
      clearInterval(swInterval.current);
    }
    return () => clearInterval(swInterval.current);
  }, [swRunning]);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="tools-panel">
      <div className="tools-tabs">
        <button 
          className={mode === "stopwatch" ? "active" : ""} 
          onClick={() => setMode("stopwatch")}
        >
          Stopwatch
        </button>
        <button 
          className={mode === "timer" ? "active" : ""} 
          onClick={() => setMode("timer")}
        >
          Timer
        </button>
      </div>

      {mode === "stopwatch" ? (
        <div className="tool-content">
          <div className="tool-display">{formatTime(swTime)}</div>
          <div className="controls">
            <button onClick={() => setSwRunning(!swRunning)}>
              {swRunning ? "Pause" : "Start"}
            </button>
            <button onClick={() => { setSwRunning(false); setSwTime(0); }}>Reset</button>
          </div>
        </div>
      ) : (
        <div className="tool-content">
          <div className="settings">
            <div className="stepper">
              <span>Min</span>
              <button onClick={() => setTmMinutes((m) => Math.max(0, m - 1))}>-</button>
              <input type="number" value={tmMinutes} onChange={(e) => setTmMinutes(Number(e.target.value) || 0)} />
              <button onClick={() => setTmMinutes((m) => m + 1)}>+</button>
            </div>
            <div className="stepper">
              <span>Sec</span>
              <button onClick={() => setTmSeconds((s) => Math.max(0, s - 1))}>-</button>
              <input type="number" value={tmSeconds} onChange={(e) => setTmSeconds(Number(e.target.value) || 0)} />
              <button onClick={() => setTmSeconds((s) => Math.min(59, s + 1))}>+</button>
            </div>
          </div>
          <div className="tool-display">
            {String(tmMinutes).padStart(2, "0")}:{String(tmSeconds).padStart(2, "0")}
          </div>
          <div className="controls">
            <button onClick={() => setTmRunning(!tmRunning)}>
              {tmRunning ? "Pause" : "Start"}
            </button>
            <button onClick={() => { setTmRunning(false); setTmSeconds(0); }}>Reset</button>
          </div>
        </div>
      )}
    </div>
  );
}