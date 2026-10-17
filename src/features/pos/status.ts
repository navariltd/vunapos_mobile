import { PosInvoiceStatus } from "@/features/pos/types";

export type PosStatusTone =
  | "error"
  | "neutral"
  | "success"
  | "warning"
  | "workflow";

const SUCCESS_STATUSES = new Set<PosInvoiceStatus>([
  "Completed",
  "Paid",
  "Submitted",
]);

const ERROR_STATUSES = new Set<PosInvoiceStatus>([
  "Cancelled",
  "Credit Note",
  "Overdue",
]);

const WARNING_STATUSES = new Set<PosInvoiceStatus>([
  "Awaiting Payment",
  "On Hold",
  "Partly Paid",
  "Pending",
  "To Bill",
  "To Deliver",
  "To Deliver and Bill",
  "Unpaid",
]);

/** Mirrors the SPA's status priority and tones for invoices and Sales Orders. */
export function getPosStatusPresentation({
  status,
  workflowEnabled = false,
  workflowState,
}: {
  status: PosInvoiceStatus;
  workflowEnabled?: boolean;
  workflowState?: string | null;
}): { label: string; tone: PosStatusTone } {
  if (workflowEnabled && workflowState)
    return { label: workflowState, tone: "workflow" };
  if (SUCCESS_STATUSES.has(status)) return { label: status, tone: "success" };
  if (ERROR_STATUSES.has(status)) return { label: status, tone: "error" };
  if (WARNING_STATUSES.has(status)) return { label: status, tone: "warning" };
  return { label: status, tone: "neutral" };
}
