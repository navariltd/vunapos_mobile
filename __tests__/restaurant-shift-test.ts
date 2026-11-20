import { openingBalances, parseOpeningAmount, shiftGateState } from "@/features/restaurant/logic/shift";

describe("restaurant shift gate", () => {
  it("asks to open a shift when there is none or one is required", () => {
    expect(shiftGateState(null)).toEqual({ kind: "open-required" });
    expect(shiftGateState({ ready: false, has_opening_entry: false, status: "OPENING_REQUIRED" })).toEqual({
      kind: "open-required",
    });
  });

  it("blocks while a closing runs or failed", () => {
    expect(shiftGateState({ ready: false, has_opening_entry: true, status: "CLOSING", closing_entry: "C-1" })).toEqual({
      kind: "closing",
      closingEntry: "C-1",
    });
    expect(
      shiftGateState({ ready: false, has_opening_entry: true, status: "CLOSING_FAILED", closing_entry: "C-2" }),
    ).toEqual({ kind: "closing-failed", closingEntry: "C-2" });
  });

  it("reports an unverifiable session as unavailable", () => {
    expect(shiftGateState({ ready: false, has_opening_entry: true })).toEqual({ kind: "unavailable" });
  });
});

describe("opening balances", () => {
  it("treats blank as zero and accepts thousands separators", () => {
    expect(parseOpeningAmount("")).toBe(0);
    expect(parseOpeningAmount(" 1,500.50 ")).toBe(1500.5);
  });

  it("rejects negative and non-numeric amounts", () => {
    expect(parseOpeningAmount("-1")).toBeNull();
    expect(parseOpeningAmount("abc")).toBeNull();
  });

  it("builds one row per payment mode or names the invalid one", () => {
    expect(openingBalances(["Cash", "M-Pesa"], { Cash: "2000" })).toEqual({
      balances: [
        { mode_of_payment: "Cash", opening_amount: 2000 },
        { mode_of_payment: "M-Pesa", opening_amount: 0 },
      ],
    });
    expect(openingBalances(["Cash", "Card"], { Card: "x" })).toEqual({ invalidMode: "Card" });
  });
});
