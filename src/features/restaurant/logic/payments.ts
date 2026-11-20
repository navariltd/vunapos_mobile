import type { PaymentInput, RestaurantPaymentMode } from "@/features/restaurant/types";

export type PaymentRow = { mode: string; amount: string; reference_no: string; reference_date: string };

export type PaymentRules = {
  total: number;
  precision: number;
  allowPartial: boolean;
  isCreditSale: boolean;
};

export type PaymentSummary = {
  paid: number;
  change: number;
  remaining: number;
  error: string | null;
  payments: PaymentInput[];
};

const round = (value: number, precision: number) => Math.round(value * 10 ** precision) / 10 ** precision;

export function isCashMode(mode: RestaurantPaymentMode | undefined) {
  return mode?.type === "Cash";
}

/** Gateway modes (e.g. an M-Pesa prompt) need the prompt flow; the till takes manual modes only. */
export function manualPaymentModes(modes: RestaurantPaymentMode[]) {
  return modes.filter((mode) => !mode.payment_gateway);
}

/** The first row covers the bill with the default (else first) manual mode. */
export function initialPaymentRows(modes: RestaurantPaymentMode[], total: number, today: string): PaymentRow[] {
  const manual = manualPaymentModes(modes);
  const mode = manual.find((row) => row.default) ?? manual[0];
  return mode ? [{ mode: mode.mode_of_payment, amount: String(total), reference_no: "", reference_date: today }] : [];
}

/**
 * Totals and the first problem, mirroring the server: cash may exceed the bill
 * (the excess is change), electronic payments may not, the bill must be covered
 * unless partial or credit sales are allowed, and bank modes need a reference.
 */
export function summarizePayments(rows: PaymentRow[], modes: RestaurantPaymentMode[], rules: PaymentRules): PaymentSummary {
  const { total, precision } = rules;
  let paid = 0;
  let nonCash = 0;
  const payments: PaymentInput[] = [];
  let error: string | null = null;
  for (const row of rows) {
    const mode = modes.find((entry) => entry.mode_of_payment === row.mode);
    const amount = Number(row.amount.replace(/,/g, ""));
    if (!row.amount.trim()) continue;
    if (!Number.isFinite(amount) || amount <= 0) {
      error ??= `Enter a valid amount for ${row.mode}.`;
      continue;
    }
    if (mode?.requires_reference && (!row.reference_no.trim() || !row.reference_date)) {
      error ??= `Enter the transaction code and date for ${row.mode}.`;
    }
    paid += amount;
    if (!isCashMode(mode)) nonCash += amount;
    payments.push({
      mode_of_payment: row.mode,
      amount: round(amount, precision),
      ...(mode?.requires_reference ? { reference_no: row.reference_no.trim(), reference_date: row.reference_date } : {}),
    });
  }
  paid = round(paid, precision);
  nonCash = round(nonCash, precision);
  if (nonCash > total) error ??= "Card, bank and mobile payments cannot exceed the bill.";
  if (paid < total && !(rules.allowPartial || rules.isCreditSale)) error ??= "The payments must cover the bill.";
  if (!payments.length && !rules.isCreditSale) error ??= "Add a payment.";
  return {
    paid,
    change: round(Math.max(0, paid - total), precision),
    remaining: round(Math.max(0, total - paid), precision),
    error,
    payments,
  };
}

export function todayIso(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
