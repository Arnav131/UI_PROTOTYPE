export const COMMON_ZONES = [
  { label: "India (IST)", value: "Asia/Kolkata" },
  { label: "UTC", value: "UTC" },
  { label: "New York (EST)", value: "America/New_York" },
  { label: "Los Angeles (PST)", value: "America/Los_Angeles" },
  { label: "London (GMT)", value: "Europe/London" },
  { label: "Berlin (CET)", value: "Europe/Berlin" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST)", value: "Australia/Sydney" },
  { label: "Dubai (GST)", value: "Asia/Dubai" },
];

export function formatInZone(date, timeZone, opts) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    ...opts,
  }).format(date);
}

export const pad = (n) => String(n).padStart(2, "0");
