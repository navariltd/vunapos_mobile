import { parseServerDatetime } from "@/features/restaurant/logic/timeLabels";

/**
 * The site's clock, as seen from this device.
 *
 * The server sends naive datetimes in the site's time zone ("2026-11-24 08:05:12"),
 * and the app reads them as device-local time. When the phone's time zone (or
 * clock) differs from the site's, every "12 min ago" is off by that gap: a
 * ticket sent a second ago could read "59 min ago". Measuring "now" on the
 * site's clock makes both sides of the subtraction use the same frame.
 *
 * `offsetMs` is how far the site clock, read the same way, is ahead of
 * `Date.now()`. It starts at 0 (trust the device) until a sample arrives.
 */
let offsetMs = 0;
const listeners = new Set<() => void>();

/** Ignore samples from slow round trips: their midpoint is too uncertain. */
const MAX_ROUND_TRIP_MS = 10_000;
/** Don't re-render every screen for network jitter. */
const MIN_CHANGE_MS = 1_000;

/** Record the server's `now` returned by a request sent at `sentAt` and answered at `receivedAt`. */
export function recordServerTime(serverTime: string | null | undefined, sentAt: number, receivedAt: number) {
  if (!serverTime) return;
  const server = parseServerDatetime(serverTime).getTime();
  if (Number.isNaN(server) || receivedAt < sentAt || receivedAt - sentAt > MAX_ROUND_TRIP_MS) return;
  const next = Math.round(server - (sentAt + receivedAt) / 2);
  if (Math.abs(next - offsetMs) < MIN_CHANGE_MS) return;
  offsetMs = next;
  listeners.forEach((listener) => listener());
}

/** The current time on the site's clock, in the frame server datetimes are parsed into. */
export function serverNow(): Date {
  return new Date(Date.now() + offsetMs);
}

export function serverClockOffset() {
  return offsetMs;
}

export function subscribeServerClock(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests only. */
export function resetServerClock() {
  offsetMs = 0;
  listeners.clear();
}
