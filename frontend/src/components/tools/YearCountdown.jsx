import { useEffect, useState } from "react";

const pad = (n) => String(n).padStart(2, "0");

function getRemaining() {
  const now = new Date();
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
    <div className="glass card">
      <div className="card-title">
        <img src="/assets/icons/star.png" className="px" alt="" />
        <span>Time left in {new Date().getFullYear()}</span>
      </div>
      <div className="year-grid">
        {units.map((u) => (
          <div className="year-cell glass-inset" key={u.label}>
            <div className="year-value">{u.value}</div>
            <div className="year-label">{u.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}