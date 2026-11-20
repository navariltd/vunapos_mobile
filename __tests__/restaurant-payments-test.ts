import { initialPaymentRows, manualPaymentModes, summarizePayments, todayIso } from "@/features/restaurant/logic/payments";

const modes = [
  { mode_of_payment: "Cash", type: "Cash", default: true },
  { mode_of_payment: "M-Pesa", type: "Bank", requires_reference: true },
  { mode_of_payment: "M-Pesa STK", type: "Phone", payment_gateway: "Mpesa" },
];
const rules = { total: 6094, precision: 2, allowPartial: false, isCreditSale: false };
const row = (mode: string, amount: string, reference_no = "", reference_date = "2026-11-20") => ({ mode, amount, reference_no, reference_date });

describe("restaurant payments", () => {
  it("starts with the default manual mode covering the bill and skips gateway modes", () => {
    expect(manualPaymentModes(modes as never).map((mode) => mode.mode_of_payment)).toEqual(["Cash", "M-Pesa"]);
    expect(initialPaymentRows(modes as never, 6094, "2026-11-20")).toEqual([row("Cash", "6094")]);
  });

  it("gives change on cash overpayment", () => {
    const summary = summarizePayments([row("Cash", "6500")], modes as never, rules);
    expect(summary).toMatchObject({ paid: 6500, change: 406, remaining: 0, error: null });
    expect(summary.payments).toEqual([{ mode_of_payment: "Cash", amount: 6500 }]);
  });

  it("refuses electronic overpayment and a missing bank reference", () => {
    expect(summarizePayments([row("M-Pesa", "7000", "QWE123")], modes as never, rules).error).toMatch(/cannot exceed/);
    expect(summarizePayments([row("M-Pesa", "6094")], modes as never, rules).error).toMatch(/transaction code/);
    expect(summarizePayments([row("M-Pesa", "6094", "QWE123")], modes as never, rules).payments).toEqual([
      { mode_of_payment: "M-Pesa", amount: 6094, reference_no: "QWE123", reference_date: "2026-11-20" },
    ]);
  });

  it("requires the bill to be covered unless partial or credit is allowed", () => {
    const split = [row("Cash", "3000"), row("M-Pesa", "2000", "ABC")];
    expect(summarizePayments(split, modes as never, rules)).toMatchObject({ remaining: 1094, error: "The payments must cover the bill." });
    expect(summarizePayments(split, modes as never, { ...rules, allowPartial: true }).error).toBeNull();
    expect(summarizePayments([], modes as never, { ...rules, isCreditSale: true }).error).toBeNull();
  });

  it("formats today in local time", () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
