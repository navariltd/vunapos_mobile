import { useSyncExternalStore } from "react";

/**
 * Whether the company site answered restaurant requests. The device's own
 * network signal is unreliable (it can stay "offline" after reconnecting), so
 * the truth is what actually happened to the last request.
 */
export type RestaurantConnectivity = "online" | "offline";

let status: RestaurantConnectivity = "online";
const listeners = new Set<() => void>();

function publish(next: RestaurantConnectivity) {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
}

export const restaurantConnectivity = {
  get: () => status,
  markOnline: () => publish("online"),
  markOffline: () => publish("offline"),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useRestaurantConnectivity() {
  return useSyncExternalStore(restaurantConnectivity.subscribe, restaurantConnectivity.get);
}
