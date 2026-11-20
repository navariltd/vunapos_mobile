import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { restaurantErrorMessage } from "@/features/restaurant/api/restaurantClient";

/** Same rhythm as the web app: table status, open orders and sessions refresh every 12 s. */
export const RESTAURANT_POLL_INTERVAL_MS = 12_000;

export type PolledResource<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  /** Fetch now (e.g. right after an action), then keep the normal rhythm. */
  refresh: () => Promise<void>;
};

/**
 * Loads `fetcher` while `key` is set, and re-runs it every `intervalMs` while the
 * screen is focused and the app is in the foreground. Never runs two at once; a
 * response for an older key is ignored. Pass `intervalMs: 0` to load once (plus
 * on refocus).
 */
export function usePolledResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  { intervalMs = RESTAURANT_POLL_INTERVAL_MS }: { intervalMs?: number } = {},
): PolledResource<T> {
  const focused = useIsFocused();
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null; loading: boolean }>(
    { key, data: null, error: null, loading: Boolean(key) },
  );
  const fetcherRef = useRef(fetcher);
  const keyRef = useRef(key);
  // Declared before the polling effect, so it runs first.
  useEffect(() => {
    fetcherRef.current = fetcher;
    keyRef.current = key;
  }, [fetcher, key]);
  const inFlight = useRef<Promise<void> | null>(null);

  const run = useCallback(async () => {
    const requestKey = keyRef.current;
    if (!requestKey) return;
    if (inFlight.current) return inFlight.current;
    const task = (async () => {
      setState((current) => (current.key === requestKey ? { ...current, loading: true } : { key: requestKey, data: null, error: null, loading: true }));
      try {
        const data = await fetcherRef.current();
        if (keyRef.current === requestKey) setState({ key: requestKey, data, error: null, loading: false });
      } catch (caught) {
        if (keyRef.current === requestKey) {
          setState((current) => ({
            key: requestKey,
            data: current.key === requestKey ? current.data : null,
            error: restaurantErrorMessage(caught, "Could not load restaurant data."),
            loading: false,
          }));
        }
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = task;
    return task;
  }, []);

  useEffect(() => {
    if (!key || !focused) return;
    void run();
    if (!intervalMs) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => void run(), intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === "active") start();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        // The device may have slept through several changes.
        void run();
        start();
      } else stop();
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [focused, intervalMs, key, run]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    isLoading: Boolean(key) && (!current || state.loading),
    refresh: run,
  };
}
