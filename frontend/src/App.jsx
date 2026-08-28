import { useState } from "react";
import LiveClock from "./components/LiveClock.jsx";
import PomodoroClock from "./components/PomodoroClock.jsx";
import YearCountdown from "./components/YearCountdown.jsx";

export default function App(){
  return jsxs4("div",{className: "app",children: [
    jsxs4("header",{className: "topbar",children: [
      jsx4("div",{className: "brand",children: "🍅 Pomodoro Sessions"}),
      jsx4(LiveClock,{})
    ]}),
    jsx4("main",{className: "main",children: [
      jsx4(PomodoroClock,{}),
      jsx4(YearCountdown,{})
    ]})
  ]});
}
