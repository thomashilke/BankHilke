const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateOnlyFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function formatCurrency(value: string | number): string {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateTime(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateOnlyFormatter.format(new Date(iso));
}

export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function formatHour(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

/** Renders a duration between `now` and `target` as "3d 4h 12m" (or "due now"). */
export function formatCountdown(target: Date, now: Date): string {
  const totalMs = target.getTime() - now.getTime();
  if (totalMs <= 0) return "due now";

  const totalMinutes = Math.floor(totalMs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}
