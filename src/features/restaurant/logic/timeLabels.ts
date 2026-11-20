// Server datetimes are naive "YYYY-MM-DD HH:MM:SS[.ffffff]" in site time. The
// JavaScript date format allows at most milliseconds, so the microseconds go.
export function parseServerDatetime(value: string): Date {
  return new Date(value.replace(" ", "T").replace(/(\.\d{3})\d+$/, "$1"));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (value: number) => String(value).padStart(2, "0");
const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function minutesSince(value: string | null | undefined, now: Date): number | null {
  if (!value) return null;
  const opened = parseServerDatetime(value);
  if (Number.isNaN(opened.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - opened.getTime()) / 60000));
}

/**
 * When something started, as a person would say it: minutes while it is fresh,
 * then the clock time, then the day. "12 min ago" · "Since 09:42" ·
 * "Yesterday 18:05" · "Mon 18:05" · "12 Nov, 18:05". `compact` is for tight
 * spaces such as a table on the floor plan: "12m" · "09:42" · "Yest." · "Mon" · "12 Nov".
 */
export function timeSince(value: string | null | undefined, now: Date, { compact = false } = {}): string | null {
  const minutes = minutesSince(value, now);
  if (minutes === null || !value) return null;
  if (minutes < 1) return compact ? "now" : "Just now";
  if (minutes < 60) return compact ? `${minutes}m` : `${minutes} min ago`;

  const opened = parseServerDatetime(value);
  const days = Math.round((startOfDay(now) - startOfDay(opened)) / 86_400_000);
  if (days <= 0) return compact ? clock(opened) : `Since ${clock(opened)}`;
  if (days === 1) return compact ? "Yest." : `Yesterday ${clock(opened)}`;
  if (days < 7) return compact ? WEEKDAYS[opened.getDay()] : `${WEEKDAYS[opened.getDay()]} ${clock(opened)}`;
  const date = `${opened.getDate()} ${MONTHS[opened.getMonth()]}`;
  return compact ? date : `${date}, ${clock(opened)}`;
}
