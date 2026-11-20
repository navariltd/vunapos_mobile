import { createKitchenCommandStore, lineActions, routineKitchenActions } from "@/features/restaurant/logic/kitchenCommands";

const ticket = {
  name: "KOT-1",
  status: "Accepted",
  modified: "2026-11-20 10:00:00",
  available_actions: ["Accept", "Start", "Ready", "Serve", "Undo Serve"],
  items: [
    { line_id: "a", item_name: "Burger", qty: 2, available_quantities: { Ready: 2, Serve: 0 } },
    { line_id: "b", item_name: "Cheese", qty: 1, parent_line_id: "a", available_quantities: { Ready: 1 } },
    { line_id: "c", item_name: "Fries", qty: 1, available_quantities: { Ready: 1, Serve: 1 } },
  ],
} as never;

describe("kitchen commands", () => {
  it("offers routine actions without corrections and finishes accepting first", () => {
    expect(routineKitchenActions(ticket)).toEqual(["Accept", "Ready", "Serve"]);
  });

  it("lists per-line Ready/Serve quantities, skipping add-ons and empty ones", () => {
    expect(lineActions(ticket).map((row) => `${row.line.line_id}:${row.action}:${row.maximum}`)).toEqual([
      "a:Ready:2",
      "c:Ready:1",
      "c:Serve:1",
    ]);
  });

  it("reuses an in-flight command (same request key) until it settles", () => {
    let counter = 0;
    const store = createKitchenCommandStore(() => `key-${++counter}`);
    const first = store.commandFor(ticket, "Ready", { quantities: { a: 1 } });
    expect(first).toMatchObject({ request_key: "key-1", expected_status: "Accepted", quantities: { a: 1 } });
    expect(store.commandFor(ticket, "Serve")).toBe(first);
    store.settle("KOT-1");
    expect(store.commandFor(ticket, "Serve").request_key).toBe("key-2");
  });
});
