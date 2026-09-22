/**
 * ToolsPage — preserved Pomodoro/Timer/Stopwatch tools from existing codebase.
 */

import { useState } from "react";
import PomodoroClock from "../components/tools/PomodoroClock.jsx";
import YearCountdown from "../components/tools/YearCountdown.jsx";
import TimerStopwatch from "../components/tools/TimerStopwatch.jsx";

export default function ToolsPage() {
  const [activePanel, setActivePanel] = useState("pomodoro");

  return (
    <div className="tools-page">
      <div className="tasks-header">
        <h1 className="page-title">
          <img src="/assets/icons/bolt.png" className="px px-lg" alt="" />
          Tools
        </h1>
      </div>

      <div className="topbar-buttons" style={{ marginBottom: 20, justifyContent: "flex-start" }}>
        <button
          className={activePanel === "pomodoro" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActivePanel("pomodoro")}
        >
          <img src="/assets/icons/tomato.png" className="px" alt="" />
          Pomodoro
        </button>
        <button
          className={activePanel === "tools" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActivePanel("tools")}
        >
          <img src="/assets/icons/bolt.png" className="px" alt="" />
          Timer / Stopwatch
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        {activePanel === "pomodoro" ? (
          <div className="pomodoro-view">
            <PomodoroClock />
            <YearCountdown />
          </div>
        ) : (
          <TimerStopwatch />
        )}
      </div>
    </div>
  );
}
