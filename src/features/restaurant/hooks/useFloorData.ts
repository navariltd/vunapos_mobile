import { useCallback, useMemo } from "react";

import { getFloorPlan, getTableStatus } from "@/features/restaurant/api/restaurantApi";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { usePolledResource } from "@/features/restaurant/hooks/usePolledResource";
import { deriveTableStatuses } from "@/features/restaurant/logic/tableStatus";
import type { RestaurantFloorDTO } from "@/features/restaurant/types";

/** The layout changes rarely: load it on focus, not on every poll. */
export function useFloorPlan() {
  const { connection, posProfile } = useRestaurant();
  const fetcher = useCallback(() => getFloorPlan(connection, posProfile), [connection, posProfile]);
  const result = usePolledResource(`floor-plan:${posProfile}`, fetcher, { intervalMs: 0 });
  // Managers also receive inactive floors and tables (for the editor); service hides them.
  const floors = useMemo<RestaurantFloorDTO[]>(
    () =>
      (result.data?.floors ?? [])
        .filter((floor) => floor.is_active)
        .sort((a, b) => a.display_order - b.display_order)
        .map((floor) => ({ ...floor, tables: floor.tables.filter((table) => table.is_active) })),
    [result.data],
  );
  return { ...result, plan: result.data, floors };
}

/** Live table status, polled while the screen is focused. */
export function useTableStatus() {
  const { connection, posProfile } = useRestaurant();
  const fetcher = useCallback(() => getTableStatus(connection, posProfile), [connection, posProfile]);
  const result = usePolledResource(`table-status:${posProfile}`, fetcher);
  const statuses = useMemo(() => (result.data ? deriveTableStatuses(result.data) : null), [result.data]);
  return { ...result, statuses };
}
