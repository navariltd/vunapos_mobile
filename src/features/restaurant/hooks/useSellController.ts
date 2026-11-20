import { useEffect, useRef, useState } from "react";

import { createSessionRound, openSession, validateCart } from "@/features/restaurant/api/restaurantApi";
import { restaurantErrorCode, restaurantErrorMessage, RestaurantApiError } from "@/features/restaurant/api/restaurantClient";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { useMenu } from "@/features/restaurant/hooks/useMenu";
import { newId } from "@/features/restaurant/logic/ids";
import { parseKitchenRoutingIssue } from "@/features/restaurant/logic/kitchenRouting";
import {
  addMenuItem,
  draftSubtotal,
  effectiveHeader,
  itemQuantities,
  newOrderDraft,
  planSave,
  removeUnsent,
  setContext,
  setHeader,
  setUnsentNote,
  setUnsentQty,
  type OrderDraft,
} from "@/features/restaurant/logic/orderDraft";
import { newSessionRound } from "@/features/restaurant/logic/sessionDraft";
import { tableSelectionRequired } from "@/features/restaurant/logic/tableContext";
import { sortedServiceTypes } from "@/features/restaurant/logic/tableStatus";
import { ValidatedDraftQueue } from "@/features/restaurant/logic/validatedDraftQueue";
import { currentPricedInvoice, draftStore, useDraftState } from "@/features/restaurant/state/draftStore";
import type {
  KitchenRoutingIssue,
  MenuItemDTO,
  RestaurantDefaultCustomer,
  RestaurantSessionDTO,
  SelectedModifier,
  ServiceType,
} from "@/features/restaurant/types";

const ROUTING_CODES = ["KITCHEN_ROUTING_REQUIRED", "INVALID_KITCHEN_STATION"];
const MENU_RELOAD_CODES = ["INVALID_MODIFIERS", "MENU_ITEM_NOT_AVAILABLE", "ADDON_PRICE_REQUIRED"];

export function defaultCustomer(value: RestaurantDefaultCustomer | string | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? { customer: value, customer_name: value } : value;
}

/** The draft that belongs on screen: a session's next round, or a new (unopened) order. */
export function activeDraftFor(draft: OrderDraft | null, sessionName: string | null, posProfile: string) {
  if (!draft || draft.pos_profile !== posProfile) return null;
  if (sessionName) return draft.restaurant_session === sessionName ? draft : null;
  return !draft.order && !draft.restaurant_session ? draft : null;
}

/**
 * The Sell screen's controller: the round being taken (new order or a visit's
 * next round), its service type and table, the menu for that context, and cart
 * edits that are checked against the server (stock and kitchen routing) before
 * they are accepted.
 */
export function useSellController({
  sessionName,
  session,
}: {
  sessionName: string | null;
  session: RestaurantSessionDTO | null;
}) {
  const restaurant = useRestaurant();
  const { connection, posProfile, profile } = restaurant;
  const serviceTypes = sortedServiceTypes(restaurant.settings.service_types);
  const storeDraft = useDraftState((state) => state.draft);
  const pricedInvoice = useDraftState(currentPricedInvoice);
  const draft = activeDraftFor(storeDraft, sessionName, posProfile);

  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [routingIssue, setRoutingIssue] = useState<KitchenRoutingIssue | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // Opening a visit and sending its first round are separate requests. Keep the
  // opened visit (by draft key) so a retry after a failed round does not open another.
  const openedVisit = useRef<{ key: string; session: RestaurantSessionDTO } | null>(null);
  const queue = useRef(new ValidatedDraftQueue<OrderDraft>());
  // The visit a just-placed new order opened, until the screen switches to it,
  // so its next-round draft is not replaced by a fresh sale in between.
  const handoff = useRef<string | null>(null);
  const pendingEdit = useRef<((current: OrderDraft) => OrderDraft) | null>(null);

  // A new sale starts on the default service type with the profile's default customer.
  useEffect(() => {
    if (sessionName && handoff.current === sessionName) handoff.current = null;
    if (draft) return;
    if (!sessionName && handoff.current && storeDraft?.restaurant_session === handoff.current) return;
    if (sessionName) {
      if (!session) return;
      draftStore.setDraft(newSessionRound(session, newId()));
      return;
    }
    const service = serviceTypes.find((row) => row.is_default) ?? serviceTypes[0];
    if (!service) return;
    const customer = defaultCustomer(profile.default_customer);
    draftStore.setDraft(
      newOrderDraft({
        pos_profile: posProfile,
        service_type: service.name,
        customer: customer?.customer,
        customer_name: customer?.customer_name,
        idempotency_key: newId(),
      }),
    );
  }, [draft, posProfile, profile.default_customer, serviceTypes, session, sessionName, storeDraft]);

  const serviceType: ServiceType | undefined = serviceTypes.find(
    (row) => row.name === (session?.service_type ?? draft?.service_type),
  );
  const needsTable = !session && tableSelectionRequired(serviceType?.requires_table, draft?.table);
  const header = draft ? effectiveHeader(draft) : null;
  const menu = useMenu({
    serviceType: serviceType?.name,
    table: draft?.table,
    customer: session?.customer ?? header?.customer,
    priceList: session?.selling_price_list,
    enabled: Boolean(draft) && !needsTable,
  });

  /**
   * Validate the entire candidate round, not just the tapped item: different items
   * and UOMs can consume the same last ingredient. Only accepted drafts are committed.
   */
  const checkedEdit = (edit: (current: OrderDraft) => OrderDraft) => {
    setError(null);
    const start = draftStore.getState().draft;
    return queue.current
      .enqueue({
        read: () => draftStore.getState().draft,
        commit: (next) => draftStore.setDraft(next),
        edit,
        // A context change (service type, table, a new sale) supersedes the edit.
        blocked: () => {
          const current = draftStore.getState().draft;
          return (
            !current ||
            current.idempotency_key !== start?.idempotency_key ||
            current.service_type !== start?.service_type ||
            current.table !== start?.table
          );
        },
        changed: (pending) => setChecking(pending > 0),
        validate: async (next) => {
          const step = planSave(next)[0];
          if (step?.kind !== "create" || !step.params.items.length) return;
          const checked = await validateCart(connection, {
            pos_profile: next.pos_profile,
            service_type: next.service_type,
            table: next.table,
            customer: effectiveHeader(next).customer,
            items: step.params.items,
            kitchen_routing: next.kitchen_routing,
            price_list: session?.selling_price_list,
          });
          draftStore.accept(next, checked.invoice);
        },
      })
      .catch((caught: unknown) => {
        const code = restaurantErrorCode(caught);
        if (code && ROUTING_CODES.includes(code) && caught instanceof RestaurantApiError) {
          pendingEdit.current = edit;
          setRoutingIssue(parseKitchenRoutingIssue(caught.meta));
        }
        if (code && MENU_RELOAD_CODES.includes(code)) menu.reload();
        setError(restaurantErrorMessage(caught, "Could not check this item."));
        throw caught;
      });
  };

  const addItem = async (item: MenuItemDTO, modifiers?: SelectedModifier[]) => {
    if (session && session.status !== "Open") return;
    setPendingItem(item.item_code);
    try {
      await checkedEdit((current) => {
        const next = addMenuItem(
          current,
          { item_code: item.item_code, item_name: item.item_name, uom: item.uom, modifiers },
          newId,
        );
        // Profiles that list new items first put the new line on top.
        if (profile.new_item_position === "Top" && next.unsent.length > current.unsent.length) {
          return { ...next, unsent: [next.unsent[next.unsent.length - 1], ...next.unsent.slice(0, -1)] };
        }
        return next;
      });
    } catch {
      /* checkedEdit reports the server's actionable error. */
    } finally {
      setPendingItem((value) => (value === item.item_code ? null : value));
    }
  };

  const setQty = (lineId: string, qty: number) => checkedEdit((current) => setUnsentQty(current, lineId, qty)).catch(() => undefined);
  // Removing a line or editing a note never consumes more stock: no server check needed.
  const removeLine = (lineId: string) => draftStore.updateDraft((current) => removeUnsent(current, lineId));
  const setNote = (lineId: string, note: string) => draftStore.updateDraft((current) => setUnsentNote(current, lineId, note));
  const setOrderNote = (orderNote: string) => draftStore.updateDraft((current) => setHeader(current, { order_note: orderNote }));
  /** A new sale's customer and guests (an open visit changes these through update_session). */
  const setDraftCustomer = (customer: { customer: string; customer_name: string }) =>
    draftStore.updateDraft((current) => setHeader(current, { customer: customer.customer, customer_name: customer.customer_name }));
  const setDraftGuests = (pax: number) => draftStore.updateDraft((current) => setHeader(current, { pax }));
  const clearUnsent = () => draftStore.updateDraft((current) => ({ ...current, unsent: [] }));

  /** Before a visit opens, the service type and table can still change. */
  const chooseServiceType = (service: ServiceType) => {
    draftStore.updateDraft((current) =>
      setContext(current, {
        service_type: service.name,
        table: service.requires_table ? current.table : null,
        table_label: service.requires_table ? current.table_label : null,
      }),
    );
  };

  const chooseTable = (table: { name: string; table_label: string }) =>
    checkedEdit((current) =>
      setContext(current, { service_type: current.service_type, table: table.name, table_label: table.table_label }),
    );

  const clearTable = () =>
    draftStore.updateDraft((current) => setContext(current, { service_type: current.service_type, table: null, table_label: null }));


  /**
   * Send the waiting lines as a round: open the visit first if this is a new
   * order. Both calls carry idempotency keys, so retrying after a network
   * failure never duplicates the visit or the round. Returns the visit name.
   */
  const placeOrder = async (kitchenRouting?: Record<string, string>): Promise<string | null> => {
    const current = activeDraftFor(draftStore.getState().draft, sessionName, posProfile);
    if (!current || inFlight.current || queue.current.pending) return null;
    if (!session && tableSelectionRequired(serviceType?.requires_table, current.table)) {
      setError("Choose a table for this order first.");
      return null;
    }
    const step = planSave(current)[0];
    if (step?.kind !== "create" || !step.params.items.length) return null;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const opened = openedVisit.current?.key === current.idempotency_key ? openedVisit.current.session : null;
      const visit =
        session ??
        opened ??
        (await openSession(connection, {
          pos_profile: posProfile,
          idempotency_key: `session:${current.idempotency_key}`,
          service_type: current.service_type,
          tables: current.table ? [current.table] : [],
          customer: effectiveHeader(current).customer,
          guest_count: effectiveHeader(current).pax,
        }));
      if (!session) openedVisit.current = { key: current.idempotency_key, session: visit };
      await createSessionRound(connection, {
        session: visit.name,
        items: step.params.items,
        idempotency_key: current.idempotency_key,
        order_note: step.params.order_note,
        pos_profile: posProfile,
        kitchen_routing: kitchenRouting ?? current.kitchen_routing,
      });
      openedVisit.current = null;
      if (!session) handoff.current = visit.name;
      draftStore.setDraft(newSessionRound(visit, newId()));
      draftStore.markOrdersChanged();
      return visit.name;
    } catch (caught) {
      const code = restaurantErrorCode(caught);
      if (code && ROUTING_CODES.includes(code) && caught instanceof RestaurantApiError) {
        setRoutingIssue(parseKitchenRoutingIssue(caught.meta));
      }
      if (code && MENU_RELOAD_CODES.includes(code)) menu.reload();
      setError(restaurantErrorMessage(caught, "Could not place this order. You can retry safely."));
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  /** Apply the stations picked for unrouted items, then retry the edit that needed them. */
  const applyKitchenRouting = async (routing: Record<string, string>): Promise<string | null> => {
    setRoutingIssue(null);
    draftStore.updateDraft((current) => ({ ...current, kitchen_routing: { ...current.kitchen_routing, ...routing } }));
    const edit = pendingEdit.current;
    pendingEdit.current = null;
    // A cart edit asked for the stations: retry it. Otherwise placing the order did.
    if (edit) {
      await checkedEdit(edit).catch(() => undefined);
      return null;
    }
    return placeOrder(routing);
  };

  const rates = new Map<string, number>();
  for (const item of menu.menu?.items ?? []) if (item.rate !== undefined) rates.set(item.item_code, item.rate);
  const localSubtotal = draft ? draftSubtotal(draft, rates).amount : 0;

  return {
    draft,
    header,
    session,
    serviceTypes,
    serviceType,
    needsTable,
    menu,
    quantities: itemQuantities(draft),
    pricedInvoice,
    localSubtotal,
    error,
    setError,
    busy,
    placeOrder,
    checking,
    pendingItem,
    routingIssue,
    dismissRouting: () => {
      pendingEdit.current = null;
      setRoutingIssue(null);
    },
    addItem,
    setQty,
    setNote,
    setOrderNote,
    setDraftCustomer,
    setDraftGuests,
    removeLine,
    clearUnsent,
    chooseServiceType,
    chooseTable,
    clearTable,
    applyKitchenRouting,
    checkedEdit,
  };
}

export type SellController = ReturnType<typeof useSellController>;
