import type { TableStatusKind } from "@/features/restaurant/logic/tableStatus";

type StatusColors = { stroke: string; fill: string; dashed: boolean };

// The web app's status colours (styles/globals.css), so both clients read the same.
const LIGHT: Record<TableStatusKind, StatusColors> = {
  free: { stroke: "#16a34a", fill: "#e3f3e8", dashed: true },
  occupied: { stroke: "#2563eb", fill: "#e1e9fc", dashed: false },
  paid: { stroke: "#b45309", fill: "#f6eadf", dashed: false },
};

const DARK: Record<TableStatusKind, StatusColors> = {
  free: { stroke: "#4ade80", fill: "#1f3326", dashed: true },
  occupied: { stroke: "#60a5fa", fill: "#1f2b3b", dashed: false },
  paid: { stroke: "#fbbf24", fill: "#3a311a", dashed: false },
};

export function tableStatusColors(kind: TableStatusKind, isDark: boolean): StatusColors {
  return (isDark ? DARK : LIGHT)[kind];
}

export const STATUS_ICON: Record<TableStatusKind, "check" | "account-group" | "receipt"> = {
  free: "check",
  occupied: "account-group",
  paid: "receipt",
};
