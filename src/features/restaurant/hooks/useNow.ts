import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { serverClockOffset, subscribeServerClock } from "@/features/restaurant/state/serverClock";

/**
 * The current time on the site's clock, refreshed every `intervalMs`, for
 * "open 12 min" labels. It follows the server clock (see state/serverClock),
 * so labels stay right when the phone's time zone differs from the site's.
 */
export function useNow(intervalMs = 30_000) {
  const offset = useSyncExternalStore(subscribeServerClock, serverClockOffset, serverClockOffset);
  const [deviceNow, setDeviceNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setDeviceNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return useMemo(() => new Date(deviceNow + offset), [deviceNow, offset]);
}
