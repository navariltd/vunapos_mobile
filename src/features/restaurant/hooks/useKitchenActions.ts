import { useRef, useState } from "react";

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

/** Accept / start / ready / serve and cancel for kitchen tickets, safe to retry. */
export function useKitchenActions(onChanged: () => void | Promise<void>) {
  const { connection } = useRestaurant();
  const [busyTicket, setBusyTicket] = useState<string | null>(null);
  const running = useRef(false);
  const cancelKeys = useRef(new Map<string, string>());

  async function perform(
    snapshot: KitchenTicketDTO,
    action: KitchenAction,
    quantities?: Record<string, number>,
  ): Promise<Outcome> {
    if (running.current) return { ok: false, message: "Another kitchen action is still running." };
    running.current = true;
    setBusyTicket(snapshot.name);
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
      running.current = false;
      setBusyTicket(null);
      draftStore.markOrdersChanged();
      await onChanged();
    }
  }

  async function cancelOrder(snapshot: KitchenTicketDTO, reason: string, managerPinToken?: string): Promise<Outcome> {
    if (running.current) return { ok: false, message: "Another kitchen action is still running." };
    const keyName = `${snapshot.name}:${reason.trim()}`;
    if (!cancelKeys.current.has(keyName)) cancelKeys.current.set(keyName, newId());
    running.current = true;
    setBusyTicket(snapshot.name);
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
      running.current = false;
      setBusyTicket(null);
      draftStore.markOrdersChanged();
      await onChanged();
    }
  }

  return { busyTicket, perform, cancelOrder, pending: kitchenCommands.pending };
}
