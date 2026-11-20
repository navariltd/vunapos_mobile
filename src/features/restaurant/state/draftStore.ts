import { useSyncExternalStore } from "react";

import type { OrderDraft } from "@/features/restaurant/logic/orderDraft";
import type { InvoiceDTO } from "@/features/restaurant/types";

/**
 * The round being taken on this device, shared by Sell and the cart sheet and
 * kept while the user visits other tabs. `priced` is the server's bill for the
 * exact draft it was computed for (validate_cart), so a stale price is never shown.
 */
export type DraftState = {
  draft: OrderDraft | null;
  priced: { draft: OrderDraft; invoice: InvoiceDTO } | null;
  /** Bumped after an order action so lists refresh at once. */
  ordersVersion: number;
};

type Listener = () => void;

export function createDraftStore(initial: DraftState = { draft: null, priced: null, ordersVersion: 0 }) {
  let state = initial;
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    getState: () => state,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setDraft(draft: OrderDraft | null) {
      if (draft === state.draft) return;
      state = { ...state, draft, priced: state.priced?.draft === draft ? state.priced : null };
      emit();
    },
    updateDraft(update: (current: OrderDraft) => OrderDraft) {
      if (state.draft) this.setDraft(update(state.draft));
    },
    accept(draft: OrderDraft, invoice: InvoiceDTO) {
      state = { ...state, priced: { draft, invoice } };
      emit();
    },
    markOrdersChanged() {
      state = { ...state, ordersVersion: state.ordersVersion + 1 };
      emit();
    },
    reset() {
      state = { draft: null, priced: null, ordersVersion: state.ordersVersion + 1 };
      emit();
    },
  };
}

export type DraftStore = ReturnType<typeof createDraftStore>;

/** One store per app run; Sell clears it when the profile or user changes. */
export const draftStore = createDraftStore();

export function useDraftState<T>(select: (state: DraftState) => T): T {
  return useSyncExternalStore(draftStore.subscribe, () => select(draftStore.getState()));
}

/** The bill for the current draft only, or null when it has changed since. */
export function currentPricedInvoice(state: DraftState): InvoiceDTO | null {
  return state.priced && state.priced.draft === state.draft ? state.priced.invoice : null;
}
