import { useState, useEffect, useRef } from "react";

const pad = (n) => String(n).padStart(2, "0");

export default function TimerStopwatch() {
  const [mode, setMode] = useState("stopwatch");
  const [isFloating, setIsFloating] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [tmMinutes, setTmMinutes] = useState(15);
  const [tmSeconds, setTmSeconds] = useState(0);

  const modeRef = useRef(mode);
  const runningRef = useRef(false);
  const startRef = useRef(null);
  const accumRef = useRef(0);
  const endRef = useRef(null);
  const remainingRef = useRef(0);
  const pipWindowRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => { modeRef.current = mode; }, [mode]);

  const formatTime = (total) => {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  useEffect(() => {
    const compute = () => {
      const now = Date.now();
      if (modeRef.current === "stopwatch") {
        const ms = accumRef.current + (startRef.current ? now - startRef.current : 0);
        setDisplaySeconds(Math.floor(ms / 1000));
      } else {
        let ms = endRef.current ? endRef.current - now : remainingRef.current;
        if (ms <= 0) {
          ms = 0;
          if (runningRef.current) {
            runningRef.current = false;
            setIsRunning(false);
            endRef.current = null;
            remainingRef.current = 0;
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("⏰ Timer Complete!", { body: "Time up! Badhiya kaam kiya!" });
            }
          }
        }
        setDisplaySeconds(Math.ceil(ms / 1000));
      }
    };
    compute();
    if (isRunning) {
      const host = pipWindowRef.current || window;
      const id = host.setInterval(compute, 250);
      return () => host.clearInterval(id);
    }
  }, [isRunning, mode, pipOpen]);

  const toggleRunning = () => {
    const now = Date.now();
    if (modeRef.current === "stopwatch") {
      if (runningRef.current) {
        accumRef.current += now - startRef.current;
        startRef.current = null;
        runningRef.current = false;
        setIsRunning(false);
      } else {
        startRef.current = now;
        runningRef.current = true;
        setIsRunning(true);
      }
    } else {
      if (runningRef.current) {
        remainingRef.current = Math.max(0, endRef.current - now);
        endRef.current = null;
        runningRef.current = false;
        setIsRunning(false);
      } else {
        const base = remainingRef.current > 0 ? remainingRef.current : (tmMinutes * 60 + tmSeconds) * 1000;
        if (base <= 0) return;
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
        endRef.current = now + base;
        runningRef.current = true;
        setIsRunning(true);
      }
    }
  };

  const resetAll = () => {
    startRef.current = null;
    accumRef.current = 0;
    endRef.current = null;
    remainingRef.current = 0;
    runningRef.current = false;
    setIsRunning(false);
    setDisplaySeconds(0);
  };

  const switchMode = (m) => { resetAll(); setMode(m); };

  const actionsRef = useRef({ toggleRunning, resetAll });
  useEffect(() => { actionsRef.current = { toggleRunning, resetAll }; });

  // ---------- DOCUMENT PICTURE-IN-PICTURE ----------
  const openPiP = async () => {
    if (pipWindowRef.current) { pipWindowRef.current.close(); return; }
    if (!("documentPictureInPicture" in window)) {
      alert("Document PiP support nahi hai! Latest Chrome/Edge/Brave use karo.");
      return;
    }
    try {
      const pip = await window.documentPictureInPicture.requestWindow({ width: 300, height: 240 });
      pipWindowRef.current = pip;
      setPipOpen(true);

      pip.document.body.innerHTML = `
        <div class="pip-wrap">
          <div id="pip-mode">STOPWATCH</div>
          <div id="pip-time">00:00</div>
          <div id="pip-status">PAUSED</div>
          <div class="pip-btns">
            <button id="pip-play">▶</button>
            <button id="pip-reset">↺</button>
          </div>
        </div>`;

      const style = pip.document.createElement("style");
      style.textContent = `
        body{margin:0;background:#14172a;color:#f5ead6;font-family:'VT323',monospace;}
        .pip-wrap{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;}
        #pip-mode{font-size:14px;letter-spacing:3px;color:#888;font-weight:700;}
        #pip-time{font-size:64px;font-weight:800;color:#ff8c42;}
        #pip-status{font-size:14px;font-weight:700;}
        .pip-btns{display:flex;gap:10px;margin-top:8px;}
        .pip-btns button{width:52px;height:40px;border:none;border-radius:10px;background:#2a2f45;color:#f5ead6;font-size:18px;cursor:pointer;}
        .pip-btns button:hover{background:#3a4060;}
      `;
      pip.document.head.appendChild(style);

      pip.document.getElementById("pip-play").addEventListener("click", () => actionsRef.current.toggleRunning());
      pip.document.getElementById("pip-reset").addEventListener("click", () => actionsRef.current.resetAll());

      pip.addEventListener("pagehide", () => {
        pipWindowRef.current = null;
        setPipOpen(false);
      });
    } catch (e) {
      console.error(e);
      alert("PiP open nahi hua: " + e.message);
    }
  };

  useEffect(() => {
    const doc = pipWindowRef.current?.document;
    if (!doc) return;
    const t = doc.getElementById("pip-time");
    const s = doc.getElementById("pip-status");
    const p = doc.getElementById("pip-play");
    const m = doc.getElementById("pip-mode");
    if (t) t.textContent = formatTime(displaySeconds);
    if (s) {
      s.textContent = isRunning ? "● RUNNING" : "❚❚ PAUSED";
      s.style.color = isRunning ? "#7ac74f" : "#ff6b6b";
    }
    if (p) p.textContent = isRunning ? "❚" : "▶";
    if (m) m.textContent = mode === "stopwatch" ? "STOPWATCH" : "TIMER";
  }, [displaySeconds, isRunning, mode]);

  // ---------- Drag ----------
  const handleMouseDown = (e) => {
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    const move = (ev) => setPosition({ x: ev.clientX - dragStart.current.x, y: ev.clientY - dragStart.current.y });
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const icon = (name) => <img src={`/assets/icons/${name}.png`} className="px" alt="" />;

  // ---------- FLOATING MINI ----------
  if (isFloating) {
    return (
      <div className="floating-timer" style={{ left: position.x, top: position.y }} onMouseDown={handleMouseDown}>
        <div className="float-header">
          {icon(mode === "stopwatch" ? "bolt" : "coffee")}
          <span className="float-mode">{mode === "stopwatch" ? "SW" : "TM"}</span>
        </div>
        <div className="float-time">{formatTime(displaySeconds)}</div>
        <div className="float-controls">
          <button onClick={(e) => { e.stopPropagation(); toggleRunning(); }}>{icon(isRunning ? "pause" : "play")}</button>
          <button onClick={(e) => { e.stopPropagation(); openPiP(); }}>{icon("image")}</button>
          <button onClick={(e) => { e.stopPropagation(); setIsFloating(false); }}>{icon("folder")}</button>
          <button onClick={(e) => { e.stopPropagation(); resetAll(); }}>{icon("close")}</button>
        </div>
      </div>
    );
  }

  // ---------- FULL MODE ----------
  return (
    <div className="tools-panel">
      <div className="tools-header">
        <div className="tools-tabs">
          <button className={mode === "stopwatch" ? "tab-btn active" : "tab-btn"} onClick={() => switchMode("stopwatch")}>
            {icon("bolt")} Stopwatch
          </button>
          <button className={mode === "timer" ? "tab-btn active" : "tab-btn"} onClick={() => switchMode("timer")}>
            {icon("coffee")} Timer
          </button>
        </div>
        <div className="tools-actions">
          <button className="pip-btn" onClick={openPiP}>{icon("image")} {pipOpen ? "Close PiP" : "PiP Mode"}</button>
          <button className="float-btn" onClick={() => setIsFloating(true)}>{icon("download")} Float</button>
        </div>
      </div>

      <div className="glass card tool-content">
        {mode === "timer" && !isRunning && (
          <div className="settings">
            <div className="stepper glass-inset">
              <span>Min</span>
              <button onClick={() => setTmMinutes((m) => Math.max(0, m - 1))}>-</button>
              <input type="number" value={tmMinutes} min="0" max="999" onChange={(e) => setTmMinutes(Number(e.target.value) || 0)} />
              <button onClick={() => setTmMinutes((m) => m + 1)}>+</button>
            </div>
            <div className="stepper glass-inset">
              <span>Sec</span>
              <button onClick={() => setTmSeconds((s) => Math.max(0, s - 1))}>-</button>
              <input type="number" value={tmSeconds} min="0" max="59" onChange={(e) => setTmSeconds(Number(e.target.value) || 0)} />
              <button onClick={() => setTmSeconds((s) => Math.min(59, s + 1))}>+</button>
            </div>
          </div>
        )}

        <div className="tool-display">{formatTime(displaySeconds)}</div>

        <div className="controls">
          <button className="btn-primary" onClick={toggleRunning}>
            {icon(isRunning ? "pause" : "play")} {isRunning ? "Pause" : "Start"}
          </button>
          <button className="btn-secondary" onClick={resetAll}>{icon("reset")} Reset</button>
        </div>
      </div>
    </div>
  );
}