import { mergeOpenOrders } from "@/features/restaurant/hooks/useOpenOrders";

describe("open orders", () => {
  it("turns visits into rows and keeps only older orders without a visit", () => {
    const rows = mergeOpenOrders(
      [
        { name: "SO-1", restaurant_session: "VRS-1" } as never,
        { name: "VRO-9", restaurant_session: null, service_type: "Takeaway", opened_at: "2026-11-20 08:00:00" } as never,
      ],
      [
        {
          name: "VRS-1",
          status: "Settling",
          preparation_status: "Ready",
          customer: "Walk-in",
          waiter: "jane@x",
          waiter_name: "Jane",
          guest_count: 3,
          opened_at: "2026-11-20 09:00:00",
          service_type: "Dine In",
          modified: "m",
          tables: [
            { table: "T5", table_label: "5" },
            { table: "T6", table_label: "6" },
          ],
        },
      ],
    );
    expect(rows.map((row) => row.name)).toEqual(["VRO-9", "VRS-1"]);
    expect(rows[1]).toMatchObject({
      restaurant_session: "VRS-1",
      table: "T5",
      table_label: "5 + 6",
      pax: 3,
      billing_pending: true,
      preparation_status: "Ready",
    });
  });
});
