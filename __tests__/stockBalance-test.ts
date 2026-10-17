import {
  formatAvailableStock,
  formatStockBalanceDetails,
} from "@/features/pos/stockBalance";

describe("stock balance formatting", () => {
  it("shows the selected sales UOM concisely and retains both units in details", () => {
    const item = {
      actual_qty: 48,
      conversion_factor: 24,
      stock_uom: "Pcs",
      uom: "Carton",
    };

    expect(formatAvailableStock(item)).toBe("2 Carton");
    expect(formatStockBalanceDetails(item)).toBe(
      "Stock balance: 48 Pcs (2 Carton)",
    );
  });

  it("keeps the stock UOM when there is no selling-unit conversion", () => {
    expect(
      formatAvailableStock({ actual_qty: 3.125, stock_uom: "Kg", uom: "Kg" }),
    ).toBe("3.125 Kg");
  });
});
