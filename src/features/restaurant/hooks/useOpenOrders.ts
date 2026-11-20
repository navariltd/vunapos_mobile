import { useCallback, useEffect } from "react";

import { listOrders, listSessions } from "@/features/restaurant/api/restaurantApi";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { usePolledResource } from "@/features/restaurant/hooks/usePolledResource";
import { useDraftState } from "@/features/restaurant/state/draftStore";
import type { RestaurantOrderSummaryDTO, RestaurantSessionSummaryDTO } from "@/features/restaurant/types";

/** Open visits as order rows, plus any older open orders that have no visit. */
export function mergeOpenOrders(
  orders: RestaurantOrderSummaryDTO[],
  sessions: RestaurantSessionSummaryDTO[],
): RestaurantOrderSummaryDTO[] {
  return [
    ...orders.filter((order) => !order.restaurant_session),
    ...sessions.map((session) => ({
      name: session.name,
      restaurant_session: session.name,
      preparation_status: session.preparation_status,
      billing_pending: session.status === "Settling",
      kiosk_status: session.kiosk_status,
      order_number: session.order_number,
      sales_orders: session.sales_orders,
      status: "Open" as const,
      service_type: session.service_type,
      table: session.tables[0]?.table ?? null,
      table_label: session.tables.map((table) => table.table_label).join(" + ") || null,
      customer: session.customer,
      pax: session.guest_count,
      waiter: session.waiter,
      waiter_name: session.waiter_name,
      opened_at: session.opened_at,
      invoice_doctype: null,
      invoice: null,
      modified: session.modified,
    })),
  ];
}

/** Open orders for the profile, polled while the screen is focused and refreshed after order actions. */
export function useOpenOrders() {
  const { connection, posProfile } = useRestaurant();
  const ordersVersion = useDraftState((state) => state.ordersVersion);
  const fetcher = useCallback(async () => {
    const [orders, sessions] = await Promise.all([
      listOrders(connection, { pos_profile: posProfile, status: "Open" }),
      listSessions(connection, posProfile),
    ]);
    return mergeOpenOrders(orders, sessions);
  }, [connection, posProfile]);
  const result = usePolledResource(`open-orders:${posProfile}`, fetcher);
  const refresh = result.refresh;
  useEffect(() => {
    if (ordersVersion) void refresh();
  }, [ordersVersion, refresh]);
  return result;
}
