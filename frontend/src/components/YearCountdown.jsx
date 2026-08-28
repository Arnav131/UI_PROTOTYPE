import { useEffect, useState } from "react";
import { pad } from "../utils.js";

function getRemaining() {
  const now = new Date();
  const year = now.getFullYear();
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  let diff = Math.max(0, end - now);
  const days = Math.floor(diff / 86400000);
  diff -= days * 86400000;
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000);
  diff -= minutes * 60000;
  const seconds = Math.floor(diff / 1000);
  return { days, hours, minutes, seconds };
}

export default function YearCountdown() {
  const [r, setR] = useState(getRemaining());

  useEffect(() => {
    const id = setInterval(() => setR(getRemaining()), 1000);
    return () => clearInterval(id);
  }, []);

  const units = [
    { label: "Days", value: r.days },
    { label: "Hours", value: pad(r.hours) },
    { label: "Min", value: pad(r.minutes) },
    { label: "Sec", value: pad(r.seconds) },
  ];

  return (
    <div className="year-countdown">
      <h2>Time left in {new Date().getFullYear()}</h2>
      <div className="year-grid">
        {units.map((u) => (
          <div className="year-cell" key={u.label}>
            <div className="year-value">{u.value}</div>
            <div className="year-label">{u.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
