import {
  restaurantRawWrite,
  restaurantRead,
  restaurantWrite,
  type RestaurantConnection as C,
} from "@/features/restaurant/api/restaurantClient";
import type {
  CartCheckDTO,
  FloorPlanDTO,
  InvoiceDTO,
  KitchenAction,
  KitchenBoardDTO,
  KitchenTicketDTO,
  MenuDTO,
  OrderLineInput,
  PaymentInput,
  RestaurantCustomerDTO,
  RestaurantOrderDTO,
  RestaurantOrderSummaryDTO,
  RestaurantSessionDTO,
  RestaurantSessionSummaryDTO,
  SessionBillDTO,
  SessionSettlementDTO,
  TableStatusDTO,
  TemplateVariantDTO,
} from "@/features/restaurant/types";

// Typed wrappers for vunapos.api.restaurant (and the few shared endpoints
// restaurant mode needs). Server signatures: vunapos/api/restaurant.py.

type KitchenRouting = Record<string, string>;

// ---- floor and tables ----

export const getFloorPlan = (c: C, pos_profile: string) =>
  restaurantRead<FloorPlanDTO>(c, "get_floor_plan", { pos_profile });

export const getTableStatus = (c: C, pos_profile: string) =>
  restaurantRead<TableStatusDTO[]>(c, "get_table_status", { pos_profile });

// ---- menu and cart ----

export const getMenu = (
  c: C,
  params: {
    pos_profile: string;
    service_type?: string | null;
    table?: string | null;
    query?: string | null;
    customer?: string | null;
    price_list?: string | null;
  },
) => restaurantRead<MenuDTO>(c, "get_menu", params);

export const getTemplateVariants = (
  c: C,
  params: { template_item_code: string; pos_profile: string; customer?: string | null; price_list?: string | null },
) =>
  restaurantRead<{ template: { item_code: string; item_name: string }; variants: TemplateVariantDTO[] }>(
    c,
    "vunapos.api.item.get_template_variants",
    params,
  );

/** Checks a whole candidate round (ingredient stock and kitchen routing) and prices it. */
export const validateCart = (
  c: C,
  params: {
    pos_profile: string;
    service_type: string;
    items: OrderLineInput[];
    table?: string | null;
    customer?: string | null;
    kitchen_routing?: KitchenRouting;
    price_list?: string | null;
  },
) => restaurantWrite<CartCheckDTO>(c, "validate_cart", params);

export const previewCart = (
  c: C,
  params: {
    pos_profile: string;
    service_type: string;
    items: OrderLineInput[];
    table?: string | null;
    customer?: string | null;
    price_list?: string | null;
  },
) => restaurantWrite<InvoiceDTO>(c, "preview_cart", params);

// ---- sessions (visits) and rounds ----

export const openSession = (
  c: C,
  params: {
    pos_profile: string;
    idempotency_key: string;
    service_type: string;
    tables: string[];
    customer?: string | null;
    guest_count?: number;
  },
) => restaurantWrite<RestaurantSessionDTO>(c, "open_session", params);

export const getSession = (c: C, session: string) =>
  restaurantRead<RestaurantSessionDTO>(c, "get_session", { session });

export const listSessions = (c: C, pos_profile: string) =>
  restaurantRead<RestaurantSessionSummaryDTO[]>(c, "list_sessions", { pos_profile });

export const updateSession = (
  c: C,
  params: {
    session: string;
    tables?: string[];
    guest_count?: number;
    customer?: string;
    waiter?: string;
    expected_modified?: string;
  },
) => restaurantWrite<RestaurantSessionDTO>(c, "update_session", params);

export const cancelEmptySession = (c: C, session: string) =>
  restaurantWrite<RestaurantSessionDTO>(c, "cancel_empty_session", { session });

export const clearTable = (c: C, session: string) =>
  restaurantWrite<RestaurantSessionDTO>(c, "clear_table", { session });

export const createSessionRound = (
  c: C,
  params: {
    session: string;
    items: OrderLineInput[];
    idempotency_key: string;
    order_note?: string | null;
    pos_profile: string;
    kitchen_routing?: KitchenRouting;
  },
) => restaurantWrite<RestaurantOrderDTO>(c, "create_session_round", params);

// ---- open orders ----

export const listOrders = (c: C, params: { pos_profile: string; status?: string; table?: string; service_type?: string }) =>
  restaurantRead<RestaurantOrderSummaryDTO[]>(c, "list_orders", params);

export const getOrder = (c: C, order: string) =>
  restaurantRead<RestaurantOrderDTO>(c, "get_order", { order });

// ---- billing ----

export const previewSessionBill = (
  c: C,
  params: { session: string; pos_profile: string; loyalty_points?: number },
) => restaurantRead<SessionBillDTO>(c, "preview_session_bill", params);

export const checkoutSession = (
  c: C,
  params: {
    session: string;
    pos_profile: string;
    fingerprint: string;
    payments: PaymentInput[];
    is_credit_sale?: boolean;
    due_date?: string;
    loyalty_points?: number;
    tax_id?: string;
    shipping_address_name?: string;
    checkout_fields?: Record<string, string>;
  },
) => restaurantWrite<SessionSettlementDTO>(c, "checkout_session", params);

// ---- kitchen ----

export const getKitchenBoard = (
  c: C,
  params: { pos_profile: string; station?: string; history?: number; start?: number },
) => restaurantRead<KitchenBoardDTO>(c, "get_kitchen_board", params);

export const getKitchenTicket = (c: C, ticket: string) =>
  restaurantRead<KitchenTicketDTO>(c, "get_kitchen_ticket", { ticket });

export const kitchenAction = (
  c: C,
  params: {
    ticket: string;
    action: KitchenAction;
    request_key: string;
    expected_status: string;
    quantities?: Record<string, number>;
    expected_modified?: string;
    reason?: string;
  },
) => restaurantWrite<KitchenTicketDTO>(c, "kitchen_action", params);

export const cancelKitchenOrder = (
  c: C,
  params: { ticket: string; request_key: string; expected_status: string; reason: string; manager_pin_token?: string },
) => restaurantWrite<KitchenTicketDTO>(c, "cancel_kitchen_order", params);

// ---- supervisor approval ----

export type ManagerPinAction = "item_removal" | "order_cancel";

export const verifyManagerPin = (c: C, params: { pos_profile: string; pin: string; action: ManagerPinAction }) =>
  restaurantWrite<{ token: string; manager?: string; display_name?: string; expires_in?: number }>(
    c,
    "vunapos.api.pin.verify_manager",
    params,
  );

// ---- the user's own POS shift ----

export const openShift = (
  c: C,
  params: { pos_profile: string; opening_balance: { mode_of_payment: string; opening_amount: number }[] },
) =>
  restaurantRawWrite<{ success: boolean; name: string; pos_profile: string; message?: string }>(
    c,
    "vunapos.api.pos_entry.create_opening_entry",
    params,
  );

// ---- customers (shared VunaPOS endpoint) ----

export const searchCustomers = (c: C, params: { pos_profile: string; query?: string; limit?: number }) =>
  restaurantRead<RestaurantCustomerDTO[]>(c, "vunapos.api.customer.search_customers", params);
