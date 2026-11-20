import { newOrderDraft } from "@/features/restaurant/logic/orderDraft";
import { createDraftStore, currentPricedInvoice } from "@/features/restaurant/state/draftStore";
import type { InvoiceDTO } from "@/features/restaurant/types";

const invoice = { doctype: "Sales Order", name: "", docstatus: 0, items: [], totals: { grand_total: 100 } } as InvoiceDTO;
const draft = newOrderDraft({ pos_profile: "P", service_type: "Dine In", idempotency_key: "k" });

describe("draft store", () => {
  it("keeps a price only for the exact draft it was computed for", () => {
    const store = createDraftStore();
    store.setDraft(draft);
    store.accept(draft, invoice);
    expect(currentPricedInvoice(store.getState())).toBe(invoice);
    store.updateDraft((current) => ({ ...current, unsent: [] }));
    expect(currentPricedInvoice(store.getState())).toBeNull();
  });

  it("notifies subscribers and bumps the orders version", () => {
    const store = createDraftStore();
    const listener = jest.fn();
    store.subscribe(listener);
    store.markOrdersChanged();
    store.reset();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getState()).toMatchObject({ draft: null, priced: null, ordersVersion: 2 });
  });

  it("ignores updates without a draft", () => {
    const store = createDraftStore();
    store.updateDraft(() => draft);
    expect(store.getState().draft).toBeNull();
  });
});
