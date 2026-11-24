import { useEffect } from "react";
import { AppState } from "react-native";

import { restaurantRead, type RestaurantConnection } from "@/features/restaurant/api/restaurantClient";
import { recordServerTime } from "@/features/restaurant/state/serverClock";

/** Re-measure now and then: phone clocks drift and people change time zones. */
const RESYNC_MS = 10 * 60_000;

/** Learns the site clock from the ping endpoint on start, on resume, and every 10 minutes. */
export function useServerClockSync(connection: RestaurantConnection | null) {
  useEffect(() => {
    if (!connection) return;
    let active = true;
    const sync = () => {
      const sentAt = Date.now();
      void restaurantRead<{ server_time?: string }>(connection, "vunapos.api.pos.ping")
        .then((data) => {
          if (active) recordServerTime(data?.server_time, sentAt, Date.now());
        })
        .catch(() => undefined);
    };
    sync();
    const timer = setInterval(sync, RESYNC_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [connection]);
}
