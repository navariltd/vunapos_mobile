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

type Tone = { stroke: string; fill: string };

/** Kitchen ticket colours, matching the web app's kitchenStatusClass. */
export function kitchenStatusTone(status: string, isDark: boolean): Tone {
  const tones: Record<string, [Tone, Tone]> = {
    done: [{ stroke: "#a3a3a3", fill: "#ededed" }, { stroke: "#5c5c5c", fill: "#2a2a2a" }],
    ready: [{ stroke: "#059669", fill: "#d1fae5" }, { stroke: "#34d399", fill: "#022c22" }],
    preparing: [{ stroke: "#d97706", fill: "#fef3c7" }, { stroke: "#fbbf24", fill: "#451a03" }],
    cancelled: [{ stroke: "#cc2929", fill: "#fff0f0" }, { stroke: "#eb9091", fill: "#442126" }],
    waiting: [{ stroke: "#0284c7", fill: "#e0f2fe" }, { stroke: "#38bdf8", fill: "#082f49" }],
  };
  const key =
    status === "Completed"
      ? "done"
      : status === "Ready" || status === "Served"
        ? "ready"
        : status === "Preparing"
          ? "preparing"
          : status === "Cancelled"
            ? "cancelled"
            : "waiting";
  return tones[key][isDark ? 1 : 0];
}
