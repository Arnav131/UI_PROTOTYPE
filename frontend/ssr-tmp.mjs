// src/App.jsx
import { useState as useState4 } from "react";

// src/components/LiveClock.jsx
import { useEffect, useState } from "react";

// src/utils.js
var COMMON_ZONES = [
  { label: "India (IST)", value: "Asia/Kolkata" },
  { label: "UTC", value: "UTC" },
  { label: "New York (EST)", value: "America/New_York" },
  { label: "Los Angeles (PST)", value: "America/Los_Angeles" },
  { label: "London (GMT)", value: "Europe/London" },
  { label: "Berlin (CET)", value: "Europe/Berlin" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST)", value: "Australia/Sydney" },
  { label: "Dubai (GST)", value: "Asia/Dubai" }
];
function formatInZone(date, timeZone, opts) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    ...opts
  }).format(date);
}
var pad = (n) => String(n).padStart(2, "0");

// src/components/LiveClock.jsx
import { jsx, jsxs } from "react/jsx-runtime";
function LiveClock() {
  const [now, setNow] = useState(/* @__PURE__ */ new Date());
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  const [zone, setZone] = useState(
    COMMON_ZONES.some((z) => z.value === detected) ? detected : "Asia/Kolkata"
  );
  useEffect(() => {
    const id = setInterval(() => setNow(/* @__PURE__ */ new Date()), 1e3);
    return () => clearInterval(id);
  }, []);
  const time = formatInZone(now, zone, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  const date = formatInZone(now, zone, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  return /* @__PURE__ */ jsxs("div", { className: "live-clock", children: [
    /* @__PURE__ */ jsx("div", { className: "live-clock-time", children: time }),
    /* @__PURE__ */ jsx("div", { className: "live-clock-date", children: date }),
    /* @__PURE__ */ jsxs(
      "select",
      {
        className: "live-clock-select",
        value: zone,
        onChange: (e) => setZone(e.target.value),
        children: [
          COMMON_ZONES.map((z) => /* @__PURE__ */ jsx("option", { value: z.value, children: z.label }, z.value)),
          !COMMON_ZONES.some((z) => z.value === zone) && /* @__PURE__ */ jsxs("option", { value: zone, children: [
            zone,
            " (your zone)"
          ] })
        ]
      }
    )
  ] });
}

// src/components/PomodoroClock.jsx
import { useEffect as useEffect2, useRef, useState as useState2 } from "react";

// src/api.js
var API_BASE = "/api";
async function addSession(session) {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session)
  });
  if (!res.ok) throw new Error("Failed to save session");
  return res.json();
}

// src/components/PomodoroClock.jsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var R = 110;
var CIRC = 2 * Math.PI * R;
function PomodoroClock() {
  const [hours, setHours] = useState2(0);
  const [minutes, setMinutes] = useState2(25);
  const [running, setRunning] = useState2(false);
  const [remaining, setRemaining] = useState2(25 * 60);
  const [saved, setSaved] = useState2(false);
  const endTimeRef = useRef(null);
  const totalRef = useRef(25 * 60);
  const total = hours * 3600 + minutes * 60;
  function applyDuration() {
    totalRef.current = total;
    if (!running) setRemaining(total);
    setSaved(false);
  }
  useEffect2(() => {
    applyDuration();
  }, [hours, minutes]);
  useEffect2(() => {
    if (!running) return;
    endTimeRef.current = Date.now() + remaining * 1e3;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1e3));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        setRunning(false);
        handleComplete();
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);
  async function handleComplete() {
    try {
      await addSession({
        label: "Pomodoro",
        durationMinutes: Math.round(totalRef.current / 60),
        mode: "focus"
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
  return /* @__PURE__ */ jsxs2("div", { className: "pomodoro", children: [
    /* @__PURE__ */ jsxs2("div", { className: "settings", children: [
      /* @__PURE__ */ jsxs2("div", { className: "stepper", children: [
        /* @__PURE__ */ jsx2("span", { children: "Hours" }),
        /* @__PURE__ */ jsx2("button", { onClick: () => setHours((h) => Math.max(0, h - 1)), children: "-" }),
        /* @__PURE__ */ jsx2(
          "input",
          {
            type: "number",
            min: "0",
            max: "12",
            value: hours,
            onChange: (e) => setHours(Number(e.target.value) || 0)
          }
        ),
        /* @__PURE__ */ jsx2("button", { onClick: () => setHours((h) => Math.min(12, h + 1)), children: "+" })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "stepper", children: [
        /* @__PURE__ */ jsx2("span", { children: "Minutes" }),
        /* @__PURE__ */ jsx2("button", { onClick: () => setMinutes((m) => Math.max(0, m - 1)), children: "-" }),
        /* @__PURE__ */ jsx2(
          "input",
          {
            type: "number",
            min: "0",
            max: "59",
            value: minutes,
            onChange: (e) => setMinutes(Number(e.target.value) || 0)
          }
        ),
        /* @__PURE__ */ jsx2("button", { onClick: () => setMinutes((m) => Math.min(59, m + 1)), children: "+" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "clock-wrap", children: [
      /* @__PURE__ */ jsxs2("svg", { width: "260", height: "260", viewBox: "0 0 260 260", children: [
        /* @__PURE__ */ jsx2(
          "circle",
          {
            cx: "130",
            cy: "130",
            r: R,
            fill: "none",
            stroke: "#2a2f45",
            strokeWidth: "14"
          }
        ),
        /* @__PURE__ */ jsx2(
          "circle",
          {
            cx: "130",
            cy: "130",
            r: R,
            fill: "none",
            stroke: "#ff6b6b",
            strokeWidth: "14",
            strokeLinecap: "round",
            strokeDasharray: CIRC,
            strokeDashoffset: dash,
            transform: "rotate(-90 130 130)"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "clock-face", children: [
        /* @__PURE__ */ jsxs2("div", { className: "clock-time", children: [
          pad(hh),
          ":",
          pad(mmOnly),
          ":",
          pad(ss)
        ] }),
        /* @__PURE__ */ jsx2("div", { className: "clock-label", children: running ? "Focusing" : "Ready" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "controls", children: [
      running ? /* @__PURE__ */ jsx2("button", { onClick: pause, children: "Pause" }) : /* @__PURE__ */ jsx2("button", { onClick: start, children: "Start" }),
      /* @__PURE__ */ jsx2("button", { onClick: reset, children: "Reset" })
    ] }),
    saved && /* @__PURE__ */ jsx2("div", { className: "saved-note", children: "Session saved \u2713" })
  ] });
}

// src/components/YearCountdown.jsx
import { useEffect as useEffect3, useState as useState3 } from "react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function getRemaining() {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  let diff = Math.max(0, end - now);
  const days = Math.floor(diff / 864e5);
  diff -= days * 864e5;
  const hours = Math.floor(diff / 36e5);
  diff -= hours * 36e5;
  const minutes = Math.floor(diff / 6e4);
  diff -= minutes * 6e4;
  const seconds = Math.floor(diff / 1e3);
  return { days, hours, minutes, seconds };
}
function YearCountdown() {
  const [r, setR] = useState3(getRemaining());
  useEffect3(() => {
    const id = setInterval(() => setR(getRemaining()), 1e3);
    return () => clearInterval(id);
  }, []);
  const units = [
    { label: "Days", value: r.days },
    { label: "Hours", value: pad(r.hours) },
    { label: "Min", value: pad(r.minutes) },
    { label: "Sec", value: pad(r.seconds) }
  ];
  return /* @__PURE__ */ jsxs3("div", { className: "year-countdown", children: [
    /* @__PURE__ */ jsxs3("h2", { children: [
      "Time left in ",
      (/* @__PURE__ */ new Date()).getFullYear()
    ] }),
    /* @__PURE__ */ jsx3("div", { className: "year-grid", children: units.map((u) => /* @__PURE__ */ jsxs3("div", { className: "year-cell", children: [
      /* @__PURE__ */ jsx3("div", { className: "year-value", children: u.value }),
      /* @__PURE__ */ jsx3("div", { className: "year-label", children: u.label })
    ] }, u.label)) })
  ] });
}

// src/App.jsx
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function App() {
  const [mode, setMode] = useState4("pomodoro");
  return /* @__PURE__ */ jsxs4("div", { className: "app", children: [
    /* @__PURE__ */ jsxs4("header", { className: "topbar", children: [
      /* @__PURE__ */ jsx4("div", { className: "brand", children: "\u{1F345} Pomodoro Sessions" }),
      /* @__PURE__ */ jsx4(LiveClock, {})
    ] }),
    /* @__PURE__ */ jsxs4("nav", { className: "modes", children: [
      /* @__PURE__ */ jsx4(
        "button",
        {
          className: mode === "pomodoro" ? "active" : "",
          onClick: () => setMode("pomodoro"),
          children: "Pomodoro"
        }
      ),
      /* @__PURE__ */ jsx4(
        "button",
        {
          className: mode === "year" ? "active" : "",
          onClick: () => setMode("year"),
          children: "Year Countdown"
        }
      )
    ] }),
    /* @__PURE__ */ jsx4("main", { className: "main", children: mode === "pomodoro" ? /* @__PURE__ */ jsx4(PomodoroClock, {}) : /* @__PURE__ */ jsx4(YearCountdown, {}) })
  ] });
}
export {
  App as default
};
