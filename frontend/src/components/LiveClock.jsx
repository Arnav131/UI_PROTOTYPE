import { useEffect, useState } from "react";
import { COMMON_ZONES, formatInZone } from "../utils.js";

export default function LiveClock() {
  const [now, setNow] = useState(new Date());
  const detected =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  const [zone, setZone] = useState(
    COMMON_ZONES.some((z) => z.value === detected) ? detected : "Asia/Kolkata"
  );

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = formatInZone(now, zone, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const date = formatInZone(now, zone, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="live-clock">
      <div className="live-clock-time">{time}</div>
      <div className="live-clock-date">{date}</div>
      <select
        className="live-clock-select"
        value={zone}
        onChange={(e) => setZone(e.target.value)}
      >
        {COMMON_ZONES.map((z) => (
          <option key={z.value} value={z.value}>
            {z.label}
          </option>
        ))}
        {!COMMON_ZONES.some((z) => z.value === zone) && (
          <option value={zone}>{zone} (your zone)</option>
        )}
      </select>
    </div>
  );
}
