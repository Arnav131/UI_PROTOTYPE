import { useState } from "react";
import LiveClock from "./components/LiveClock.jsx";
import PomodoroClock from "./components/PomodoroClock.jsx";
import YearCountdown from "./components/YearCountdown.jsx";

export default function App() {
  const [mode, setMode] = useState("pomodoro"); // 'pomodoro' | 'year'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🍅 Pomodoro Sessions</div>
        <LiveClock />
      </header>

      <nav className="modes">
        <button
          className={mode === "pomodoro" ? "active" : ""}
          onClick={() => setMode("pomodoro")}
        >
          Pomodoro
        </button>
        <button
          className={mode === "year" ? "active" : ""}
          onClick={() => setMode("year")}
        >
          Year Countdown
        </button>
      </nav>

      <main className="main">
        {mode === "pomodoro" ? <PomodoroClock /> : <YearCountdown />}
      </main>
    </div>
  );
}
