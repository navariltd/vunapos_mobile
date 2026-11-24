import { minutesSince, parseServerDatetime } from "@/features/restaurant/logic/timeLabels";
import {
  recordServerTime,
  resetServerClock,
  serverClockOffset,
  serverNow,
  subscribeServerClock,
} from "@/features/restaurant/state/serverClock";

describe("serverClock", () => {
  const deviceNow = new Date(2026, 10, 24, 9, 5, 0).getTime();

  beforeEach(() => {
    resetServerClock();
    jest.spyOn(Date, "now").mockReturnValue(deviceNow);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("trusts the device until the server has been heard from", () => {
    expect(serverClockOffset()).toBe(0);
    expect(serverNow().getTime()).toBe(deviceNow);
  });

  it("measures a fresh ticket as just sent when the site is an hour behind the phone", () => {
    // The phone reads 09:05; the site's time zone says 08:05 (one hour behind).
    recordServerTime("2026-11-24 08:05:00.000000", deviceNow - 200, deviceNow + 200);
    const sentAt = "2026-11-24 08:04:30.123456";

    // Against the phone's clock this was the bug: about 60 minutes.
    expect(minutesSince(sentAt, new Date(deviceNow))).toBe(60);
    // Against the site's clock it is half a minute old.
    expect(minutesSince(sentAt, serverNow())).toBe(0);
    expect(serverNow().getTime()).toBe(parseServerDatetime("2026-11-24 08:05:00").getTime());
  });

  it("ignores samples from slow round trips", () => {
    recordServerTime("2026-11-24 08:05:00", deviceNow - 20_000, deviceNow);
    expect(serverClockOffset()).toBe(0);
  });

  it("ignores missing or unreadable server times", () => {
    recordServerTime(undefined, deviceNow, deviceNow);
    recordServerTime("not a date", deviceNow, deviceNow);
    expect(serverClockOffset()).toBe(0);
  });

  it("notifies listeners only for a real change, not network jitter", () => {
    const listener = jest.fn();
    subscribeServerClock(listener);
    recordServerTime("2026-11-24 08:05:00", deviceNow, deviceNow);
    recordServerTime("2026-11-24 08:05:00.400", deviceNow, deviceNow);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
