import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { restaurantErrorMessage } from "@/features/restaurant/api/restaurantClient";

/** Same rhythm as the web app: table status, open orders and sessions refresh every 12 s. */
export const RESTAURANT_POLL_INTERVAL_MS = 12_000;

export type PolledResource<T> = {
  data: T | null;
  error: string | null;
  /** True while a request for the current key is in flight. */
  isLoading: boolean;
  /** `data` belongs to the previous key (keepPreviousData) while the new one loads. */
  isStale: boolean;
  /** Fetch now (e.g. right after an action), then keep the normal rhythm. */
  refresh: () => Promise<void>;
};

type State<T> = {
  /** The key the latest request was made for. */
  key: string | null;
  /** The key `data` was loaded for. */
  dataKey: string | null;
  data: T | null;
  error: string | null;
  loading: boolean;
};

/**
 * Loads `fetcher` while `key` is set, and re-runs it every `intervalMs` while the
 * screen is focused and the app is in the foreground. Never runs two at once; a
 * response for an older key is ignored. Pass `intervalMs: 0` to load once (plus
 * on refocus). With `keepPreviousData`, changing the key (a filter, a service
 * type) keeps showing the last results until the new ones arrive, instead of
 * blanking the screen.
 */
export function usePolledResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  { intervalMs = RESTAURANT_POLL_INTERVAL_MS, keepPreviousData = false }: { intervalMs?: number; keepPreviousData?: boolean } = {},
): PolledResource<T> {
  const focused = useIsFocused();
  const [state, setState] = useState<State<T>>({ key, dataKey: null, data: null, error: null, loading: Boolean(key) });
  const fetcherRef = useRef(fetcher);
  const keyRef = useRef(key);
  // Declared before the polling effect, so it runs first.
  useEffect(() => {
    fetcherRef.current = fetcher;
    keyRef.current = key;
  }, [fetcher, key]);
  const inFlight = useRef<{ key: string; task: Promise<void> } | null>(null);

  const run = useCallback(async () => {
    const requestKey = keyRef.current;
    if (!requestKey) return;
    // A request for an older key must not block (or satisfy) the new one.
    if (inFlight.current?.key === requestKey) return inFlight.current.task;
    const task = (async () => {
      setState((current) => ({ ...current, key: requestKey, error: current.key === requestKey ? current.error : null, loading: true }));
      try {
        const data = await fetcherRef.current();
        if (keyRef.current === requestKey) setState({ key: requestKey, dataKey: requestKey, data, error: null, loading: false });
      } catch (caught) {
        if (keyRef.current === requestKey) {
          setState((current) => ({
            ...current,
            key: requestKey,
            error: restaurantErrorMessage(caught, "Could not load restaurant data."),
            loading: false,
          }));
        }
      } finally {
        if (inFlight.current?.key === requestKey) inFlight.current = null;
      }
    })();
    inFlight.current = { key: requestKey, task };
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

  const fresh = state.dataKey === key;
  const data = fresh || (keepPreviousData && key) ? state.data : null;
  return {
    data,
    error: state.key === key ? state.error : null,
    isLoading: Boolean(key) && (state.key !== key || state.loading),
    isStale: Boolean(data) && !fresh,
    refresh: run,
  };
}
