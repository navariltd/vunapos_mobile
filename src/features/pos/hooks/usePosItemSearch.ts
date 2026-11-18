import { useCallback, useEffect, useState } from "react";

import { useAppSession } from "@/features/auth/AppSessionProvider";
import { usePosCachedResource } from "@/hooks/usePosCachedResource";
import { PosCatalogueItem } from "@/features/pos/types";
import { FrappeClientError, getVunaMethod } from "@/services/frappeClient";
import { useNetworkStatus } from "@/services/NetworkStatusProvider";

type UsePosItemSearchArgs = {
  customer?: string;
  enabled?: boolean;
  initialItems?: PosCatalogueItem[];
  loadAll?: boolean;
  posProfile: string | undefined;
  priceList?: string;
  query: string;
};

type PosItemSearchResult = {
  cachedItems: PosCatalogueItem[];
  error: string | null;
  hasLoaded: boolean;
  isLoading: boolean;
  isRefreshing?: boolean;
  isStale?: boolean;
  items: PosCatalogueItem[];
  lastUpdated?: number | null;
  reload: () => void | Promise<void>;
};

function mergeCatalogueRows(
  cached: PosCatalogueItem[],
  incoming: PosCatalogueItem[],
) {
  const rows = new Map(cached.map((item) => [item.item_code, item]));
  for (const item of incoming) rows.set(item.item_code, item);
  return [...rows.values()];
}

export function matchesCatalogueQuery(item: PosCatalogueItem, query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searchable = `${item.item_name} ${item.item_code} ${item.barcode || ""}`.toLowerCase();
  return words.every((word) => searchable.includes(word));
}

function serverSearchTerm(query: string) {
  const words = query.trim().split(/\s+/).filter(Boolean);
  return words.reduce((longest, word) => word.length > longest.length ? word : longest, "");
}

/**
 * Searches the live, profile-scoped catalogue after a short typing pause.
 *
 * An empty `loadAll` request deliberately asks Frappe for the full catalogue.
 * Bootstrap is capped for a fast first paint, whereas this request becomes the
 * authoritative catalogue once it arrives and must not silently truncate it.
 */
export function usePosItemSearch({
  customer,
  enabled = true,
  initialItems,
  loadAll = false,
  posProfile,
  priceList,
  query,
}: UsePosItemSearchArgs): PosItemSearchResult {
  const { companyUrl, invalidateSession, sessionId } = useAppSession();
  const { connectionStatus } = useNetworkStatus();
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());
  const normalizedQuery = query.trim();

  // Show bootstrap rows immediately, but always check the server for a typed
  // query: the bootstrap contains only the first 500 items and a local match
  // must not hide additional matching rows outside that snapshot.
  const canUseInitialItems = !customer && !priceList;
  const initialMatches = canUseInitialItems
    ? (initialItems ?? []).filter((item) => matchesCatalogueQuery(item, normalizedQuery))
    : [];

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(normalizedQuery), 300);
    return () => clearTimeout(timeout);
  }, [normalizedQuery]);

  const needsServerRequest = Boolean(debouncedQuery || loadAll ||
    (!canUseInitialItems && initialItems !== undefined));
  const cacheKey =
    companyUrl && sessionId && posProfile && needsServerRequest
      ? {
          query: {
            customer: customer || null,
            limit: loadAll && !debouncedQuery ? 0 : 60,
            priceList: priceList || null,
            query: debouncedQuery,
          },
          resource: "catalogue",
          scope: { companyUrl, posProfile, userId: sessionId },
        }
      : null;
  const load = useCallback(async (signal: AbortSignal) => {
    if (!companyUrl || !sessionId || !posProfile) {
      throw new Error("Your POS workspace is still loading.");
    }
    try {
      return await getVunaMethod<PosCatalogueItem[]>(
        companyUrl,
        sessionId,
        "vunapos.api.item.search_items",
        {
          limit: loadAll && !debouncedQuery ? 0 : 60,
          customer,
          pos_profile: posProfile,
          price_list: priceList,
          query: serverSearchTerm(debouncedQuery),
        },
        signal,
      );
    } catch (error) {
      if (error instanceof FrappeClientError && error.code === "session") {
        void invalidateSession();
      }
      throw error;
    }
  }, [
    companyUrl,
    customer,
    debouncedQuery,
    invalidateSession,
    loadAll,
    posProfile,
    priceList,
    sessionId,
  ]);
  const resource = usePosCachedResource({
    cacheKey,
    connectionStatus,
    enabled,
    load,
  });
  const serverItems = debouncedQuery === normalizedQuery
    ? (resource.data ?? []).filter((item) => matchesCatalogueQuery(item, normalizedQuery))
    : [];
  const localRows = normalizedQuery
    ? initialMatches
    : initialItems ?? [];
  const mergedItems = canUseInitialItems
    ? mergeCatalogueRows(localRows, serverItems)
    : serverItems;

  return {
    cachedItems:
      !debouncedQuery && canUseInitialItems && initialItems !== undefined
        ? initialItems ?? []
        : !debouncedQuery && loadAll
          ? resource.data ?? []
          : [],
    error: resource.error,
    hasLoaded:
      resource.data !== null ||
      (canUseInitialItems && initialItems !== undefined),
    isLoading:
      Boolean(cacheKey) &&
      (normalizedQuery !== debouncedQuery || resource.isLoading),
    isRefreshing: resource.isRefreshing,
    isStale: resource.isStale,
    items: resource.data && debouncedQuery === normalizedQuery ? mergedItems : initialMatches,
    lastUpdated: resource.lastUpdated,
    reload: resource.refresh,
  };
}
