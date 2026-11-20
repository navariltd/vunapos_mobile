import { minutesSince, timeSince } from "@/features/restaurant/logic/timeLabels";

// Thursday 20 Nov 2026, 14:30 local time.
const now = new Date(2026, 10, 20, 14, 30, 0);

describe("timeSince", () => {
  it("counts minutes while fresh", () => {
    expect(timeSince("2026-11-20 14:29:40", now)).toBe("Just now");
    expect(timeSince("2026-11-20 14:17:59.123456", now)).toBe("12 min ago");
    expect(timeSince("2026-11-20 13:31:00", now)).toBe("59 min ago");
  });

  it("shows the clock time later the same day", () => {
    expect(timeSince("2026-11-20 13:30:00", now)).toBe("Since 13:30");
    expect(timeSince("2026-11-20 09:05:00", now)).toBe("Since 09:05");
  });

  it("names yesterday, the weekday this week, then the date", () => {
    expect(timeSince("2026-11-19 18:05:00", now)).toBe("Yesterday 18:05");
    expect(timeSince("2026-11-16 08:00:00", now)).toBe("Mon 08:00");
    expect(timeSince("2026-11-12 18:05:00", now)).toBe("12 Nov, 18:05");
    expect(timeSince("2025-12-31 23:59:00", now)).toBe("31 Dec, 23:59");
  });

  it("has a compact form for tables on the floor plan", () => {
    const compact = { compact: true };
    expect(timeSince("2026-11-20 14:29:40", now, compact)).toBe("now");
    expect(timeSince("2026-11-20 14:18:00", now, compact)).toBe("12m");
    expect(timeSince("2026-11-20 09:05:00", now, compact)).toBe("09:05");
    expect(timeSince("2026-11-19 18:05:00", now, compact)).toBe("Yest.");
    expect(timeSince("2026-11-16 08:00:00", now, compact)).toBe("Mon");
    expect(timeSince("2026-11-12 18:05:00", now, compact)).toBe("12 Nov");
  });

  it("ignores missing or invalid times and never goes negative", () => {
    expect(timeSince(null, now)).toBeNull();
    expect(timeSince("not a date", now)).toBeNull();
    expect(timeSince("2026-11-20 15:00:00", now)).toBe("Just now");
    expect(minutesSince("2026-11-20 14:00:00", now)).toBe(30);
  });
});
