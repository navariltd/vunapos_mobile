import type { RestaurantShift } from "@/features/restaurant/context/RestaurantContext";

export type ShiftGateState =
  | { kind: "open-required" }
  | { kind: "closing"; closingEntry?: string | null }
  | { kind: "closing-failed"; closingEntry?: string | null }
  | { kind: "unavailable" };

/** What the gate shows for a shift that is not ready. */
export function shiftGateState(shift: RestaurantShift | null): ShiftGateState {
  switch (shift?.status) {
    case "CLOSING":
      return { kind: "closing", closingEntry: shift.closing_entry };
    case "CLOSING_FAILED":
      return { kind: "closing-failed", closingEntry: shift.closing_entry };
    case "OPENING_REQUIRED":
      return { kind: "open-required" };
    default:
      // No session at all also means the user has to open one.
      return shift ? { kind: "unavailable" } : { kind: "open-required" };
  }
}

/** Blank counts as zero; anything else must be a non-negative number, or null (invalid). */
export function parseOpeningAmount(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return 0;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function openingBalances(
  modes: string[],
  amounts: Record<string, string>,
): { balances: { mode_of_payment: string; opening_amount: number }[] } | { invalidMode: string } {
  const balances = [];
  for (const mode of modes) {
    const amount = parseOpeningAmount(amounts[mode] ?? "");
    if (amount === null) return { invalidMode: mode };
    balances.push({ mode_of_payment: mode, opening_amount: amount });
  }
  return { balances };
}
