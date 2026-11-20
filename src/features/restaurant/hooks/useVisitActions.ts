import { useState } from "react";

import { cancelEmptySession, updateSession } from "@/features/restaurant/api/restaurantApi";
import { restaurantErrorMessage } from "@/features/restaurant/api/restaurantClient";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { draftStore } from "@/features/restaurant/state/draftStore";
import type { RestaurantSessionDTO } from "@/features/restaurant/types";

/** Changes to an open visit: guests, customer, waiter, tables, and cancelling it while empty. */
export function useVisitActions(session: RestaurantSessionDTO | null, refresh: () => Promise<void>) {
  const { connection } = useRestaurant();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(action: () => Promise<T>, fallback: string): Promise<T | null> {
    if (!session || busy) return null;
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      draftStore.markOrdersChanged();
      await refresh();
      return result;
    } catch (caught) {
      setError(restaurantErrorMessage(caught, fallback));
      return null;
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    error,
    clearError: () => setError(null),
    setGuests: (guest_count: number) =>
      run(() => updateSession(connection, { session: session!.name, guest_count: Math.max(0, Math.floor(guest_count)) }), "Could not update the guests."),
    setCustomer: (customer: string) =>
      run(() => updateSession(connection, { session: session!.name, customer }), "Could not change the customer."),
    setWaiter: (waiter: string) =>
      run(() => updateSession(connection, { session: session!.name, waiter }), "Could not assign the waiter."),
    setTables: (tables: string[]) =>
      run(() => updateSession(connection, { session: session!.name, tables }), "Could not update the tables."),
    cancelEmpty: () => run(() => cancelEmptySession(connection, session!.name), "Could not cancel this visit."),
  };
}
