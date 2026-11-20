import { useCallback, useEffect, useState } from "react";

import { getMenu } from "@/features/restaurant/api/restaurantApi";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { usePolledResource } from "@/features/restaurant/hooks/usePolledResource";

/**
 * The menu for a service type and table (floor), priced for the customer and
 * price list. Prices and availability are context-specific, so it reloads when
 * any of them changes; `reload` fetches it again (e.g. after MENU_ITEM_NOT_AVAILABLE).
 */
export function useMenu(params: {
  serviceType?: string | null;
  table?: string | null;
  customer?: string | null;
  priceList?: string | null;
  enabled?: boolean;
}) {
  const { connection, posProfile } = useRestaurant();
  const { serviceType, table, customer, priceList, enabled = true } = params;
  const [revision, setRevision] = useState(0);
  const key =
    enabled && serviceType
      ? JSON.stringify([posProfile, serviceType, table ?? "", customer ?? "", priceList ?? "", revision])
      : null;
  const fetcher = useCallback(
    () =>
      getMenu(connection, {
        pos_profile: posProfile,
        service_type: serviceType,
        table,
        customer,
        price_list: priceList,
      }),
    [connection, customer, posProfile, priceList, serviceType, table],
  );
  const result = usePolledResource(key, fetcher, { intervalMs: 0, keepPreviousData: true });
  const reload = useCallback(() => setRevision((current) => current + 1), []);

  // Timed availability (e.g. breakfast until 11:00) expires on the server's schedule.
  const expiresAfter = result.data?.availability_refresh_after;
  useEffect(() => {
    if (!expiresAfter || !Number.isFinite(expiresAfter)) return;
    const timer = setTimeout(reload, Math.min(expiresAfter * 1000, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [expiresAfter, reload]);

  // While switching context the previous menu stays on screen (isStale) instead of blanking.
  return { menu: result.data, error: result.error, isLoading: result.isLoading, isStale: result.isStale, reload };
}
