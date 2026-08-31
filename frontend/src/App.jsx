import { useState } from "react";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
import LiveClock from "./components/LiveClock.jsx";
import PomodoroClock from "./components/PomodoroClock.jsx";
import YearCountdown from "./components/YearCountdown.jsx";
import TimerStopwatch from "./components/TimerStopwatch.jsx"; // <-- YE ADD KAROjsx";

export default function App() {
  const [activePanel, setActivePanel] = useState("pomodoro"); // 'pomodoro' or 'tools'

  return jsxs4("div", { className: "app", children: [
    // Topbar with two buttons
    jsxs4("header", { className: "topbar", children: [
      jsx4("div", { className: "brand", children: " Pomodoro Sessions" }),
      jsx4("div", { className: "topbar-buttons", children: [
        jsx4("button", { 
          className: activePanel === "pomodoro" ? "active red-btn" : "red-btn",
          onClick: () => setActivePanel("pomodoro"),
          children: "Pomodoro"
        }),
        jsx4("button", { 
          className: activePanel === "tools" ? "active blue-btn" : "blue-btn",
          onClick: () => setActivePanel("tools"),
          children: "Timer / Stopwatch"
        })
      ]}),
      jsx4(LiveClock, {})
    ]}),
    // Main Content
    jsx4("main", { className: "main", children: 
      activePanel === "pomodoro" 
        ? jsxs4("div", { className: "pomodoro-view", children: [
            jsx4(PomodoroClock, {}),
            jsx4(YearCountdown, {})
          ]})
        : jsx4(TimerStopwatch, {})
    })
  ]});
}