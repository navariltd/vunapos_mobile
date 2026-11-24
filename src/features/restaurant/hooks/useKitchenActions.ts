import { useCallback, useRef, useState } from "react";

import { cancelKitchenOrder, kitchenAction } from "@/features/restaurant/api/restaurantApi";
import { RestaurantApiError, restaurantErrorMessage } from "@/features/restaurant/api/restaurantClient";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { newId } from "@/features/restaurant/logic/ids";
import { createKitchenCommandStore } from "@/features/restaurant/logic/kitchenCommands";
import { KITCHEN_ACTION_LABELS } from "@/features/restaurant/logic/kitchenStatus";
import { draftStore } from "@/features/restaurant/state/draftStore";
import type { KitchenAction, KitchenTicketDTO } from "@/features/restaurant/types";

/** Shared across screens so an unanswered action keeps its request key. */
export const kitchenCommands = createKitchenCommandStore(newId);

type Outcome = { ok: true; message: string } | { ok: false; message: string };

/** The control on a ticket whose request is in flight: an action, a line ("line:Ready") or "cancel". */
export const CANCEL_CONTROL = "cancel";
export const lineControl = (lineId: string, action: KitchenAction) => `${lineId}:${action}`;

/**
 * Accept / start / ready / serve and cancel for kitchen tickets, safe to retry.
 *
 * Busy state is per ticket: an action on one ticket never disables or restyles
 * another ticket's buttons, and two tickets can be worked at the same time. A
 * ticket runs one request at a time, so its own buttons wait for it.
 */
export function useKitchenActions(onChanged: () => void | Promise<void>) {
  const { connection } = useRestaurant();
  /** Ticket name → the control whose request is running. */
  const [busy, setBusy] = useState<Record<string, string>>({});
  const running = useRef(new Set<string>());
  const cancelKeys = useRef(new Map<string, string>());

  const start = (ticket: string, control: string) => {
    if (running.current.has(ticket)) return false;
    running.current.add(ticket);
    setBusy((current) => ({ ...current, [ticket]: control }));
    return true;
  };

  const finish = async (ticket: string) => {
    running.current.delete(ticket);
    setBusy((current) => {
      const next = { ...current };
      delete next[ticket];
      return next;
    });
    draftStore.markOrdersChanged();
    await onChanged();
  };

  async function perform(
    snapshot: KitchenTicketDTO,
    action: KitchenAction,
    quantities?: Record<string, number>,
    control: string = action,
  ): Promise<Outcome> {
    if (!start(snapshot.name, control)) return { ok: false, message: "This ticket is still being updated." };
    const command = kitchenCommands.commandFor(snapshot, action, { quantities });
    try {
      await kitchenAction(connection, command);
      kitchenCommands.settle(snapshot.name);
      return { ok: true, message: `${snapshot.name}: ${KITCHEN_ACTION_LABELS[command.action]} done.` };
    } catch (caught) {
      // A refused action is final; only an unanswered one keeps its key for a retry.
      if (caught instanceof RestaurantApiError && !caught.isConnection && caught.code !== "IDEMPOTENCY_CONFLICT") {
        kitchenCommands.settle(snapshot.name);
      }
      return { ok: false, message: restaurantErrorMessage(caught, "Kitchen action failed. You can retry safely.") };
    } finally {
      await finish(snapshot.name);
    }
  }

  async function cancelOrder(snapshot: KitchenTicketDTO, reason: string, managerPinToken?: string): Promise<Outcome> {
    if (!start(snapshot.name, CANCEL_CONTROL)) return { ok: false, message: "This ticket is still being updated." };
    const keyName = `${snapshot.name}:${reason.trim()}`;
    if (!cancelKeys.current.has(keyName)) cancelKeys.current.set(keyName, newId());
    try {
      await cancelKitchenOrder(connection, {
        ticket: snapshot.name,
        request_key: cancelKeys.current.get(keyName)!,
        expected_status: snapshot.status,
        reason: reason.trim(),
        manager_pin_token: managerPinToken,
      });
      cancelKeys.current.delete(keyName);
      return { ok: true, message: "Order cancelled. Its table stays assigned until the visit closes." };
    } catch (caught) {
      return { ok: false, message: restaurantErrorMessage(caught, "Could not cancel this order.") };
    } finally {
      await finish(snapshot.name);
    }
  }

  /** The control running on this ticket, or null when the ticket is idle. */
  const busyControl = useCallback((ticket: string): string | null => busy[ticket] ?? null, [busy]);

  return { busy, busyControl, perform, cancelOrder, pending: kitchenCommands.pending };
}
