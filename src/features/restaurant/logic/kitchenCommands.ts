import type { KitchenAction, KitchenTicketDTO } from "@/features/restaurant/types";

export type KitchenCommand = {
  ticket: string;
  action: KitchenAction;
  request_key: string;
  expected_status: string;
  expected_modified?: string;
  quantities?: Record<string, number>;
  reason?: string;
};

/** Ticket-level buttons: every routine action, but finish accepting before starting. */
export function routineKitchenActions(ticket: KitchenTicketDTO): KitchenAction[] {
  const actions = ticket.available_actions ?? [];
  return actions.filter(
    (action) =>
      action !== "Undo Serve" && action !== "Cancel Remake" && !(action === "Start" && actions.includes("Accept")),
  );
}

/** Lines that can take a quantity for Ready or Serve, with the most they can take. */
export function lineActions(ticket: KitchenTicketDTO) {
  if (ticket.status === "Cancelled" || !ticket.modified) return [];
  return ticket.items
    .filter((line) => !line.parent_line_id)
    .flatMap((line) =>
      (["Ready", "Serve"] as const)
        .filter((action) => ticket.available_actions?.includes(action) && Number(line.available_quantities?.[action]) > 0)
        .map((action) => ({ line, action, maximum: Number(line.available_quantities?.[action]) })),
    );
}

/**
 * Kitchen actions in flight, per ticket. A command keeps its request key until
 * the server answers, so retrying after a dropped connection can never apply
 * it twice. Kept outside React so it survives leaving and reopening the board.
 */
export function createKitchenCommandStore(makeKey: () => string) {
  const pending = new Map<string, KitchenCommand>();
  return {
    pending: (ticket: string) => pending.get(ticket) ?? null,
    /** The in-flight command for this ticket, or a new one for this action. */
    commandFor(snapshot: KitchenTicketDTO, action: KitchenAction, extra: { quantities?: Record<string, number>; reason?: string } = {}) {
      const existing = pending.get(snapshot.name);
      if (existing) return existing;
      const command: KitchenCommand = {
        ticket: snapshot.name,
        action,
        request_key: makeKey(),
        expected_status: snapshot.status,
        ...(snapshot.modified ? { expected_modified: snapshot.modified } : {}),
        ...(extra.quantities ? { quantities: extra.quantities } : {}),
        ...(extra.reason ? { reason: extra.reason } : {}),
      };
      pending.set(snapshot.name, command);
      return command;
    },
    settle: (ticket: string) => pending.delete(ticket),
  };
}
