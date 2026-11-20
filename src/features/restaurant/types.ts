// Restaurant mode DTOs. They mirror vunapos/dto/restaurant.py and the SPA's
// features/restaurant/types.ts. Restaurant code keeps its own copies of the item
// and invoice shapes so it never depends on the retail feature (src/features/pos).

// ---- bootstrap (pos_profile carries these; null/absent on Retail profiles) ----

export type ServiceType = {
  name: string;
  service_type_name: string;
  requires_table: boolean;
  display_order: number;
  description?: string | null;
  price_list?: string | null;
  taxes_and_charges?: string | null;
  is_default: boolean;
};

export type RestaurantSettings = {
  restaurant?: string | null;
  restaurant_name?: string | null;
  branch?: string | null;
  service_types: ServiceType[];
  allow_multiple_orders_per_table: boolean;
  require_manager_pin_order_cancel: boolean;
  complete_preparation_on_billing?: boolean;
  kiosk_mode?: boolean;
};

export type RestaurantPaymentMode = {
  mode_of_payment: string;
  default?: boolean;
  type?: string | null;
  payment_gateway?: string | null;
  requires_reference?: boolean;
};

export type RestaurantDefaultCustomer = {
  customer: string;
  customer_name?: string | null;
};

/** The parts of the bootstrap profile restaurant mode reads. */
export type RestaurantProfile = {
  name: string;
  company?: string;
  warehouse?: string;
  currency?: string;
  currency_precision?: number;
  pos_mode?: "Retail" | "Restaurant";
  restaurant?: RestaurantSettings | null;
  can_take_payment?: boolean;
  can_manage_restaurant?: boolean;
  restaurant_roles?: string[];
  default_customer?: RestaurantDefaultCustomer | string | null;
  modes_of_payment?: RestaurantPaymentMode[];
  new_item_position?: "Top" | "Bottom" | string;
  allow_customer_management?: boolean;
  allow_customer_creation?: boolean;
  allow_customer_payments?: boolean;
  allow_credit_sales?: boolean;
  allow_partial_payment?: boolean;
  hide_images?: boolean;
  require_manager_pin_item_removal?: boolean;
  print_format?: string | null;
};

// ---- floor plan (vunapos/services/floor_plan_service.py) ----
// Positions and sizes are in virtual canvas units (1000 x 700), not pixels.

export type FloorElementType = "Wall" | "Door" | "Window" | "Bar Counter" | "Plant" | "Label";
export type RestaurantTableShape = "Square" | "Round" | "Rectangle" | "Oval";

export type FloorElementDTO = {
  name?: string;
  element_type: FloorElementType;
  label?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color?: string | null;
};

export type RestaurantTableDTO = {
  name: string;
  floor: string;
  table_label: string;
  seats: number;
  shape: RestaurantTableShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  is_active: boolean;
};

export type RestaurantFloorDTO = {
  name: string;
  floor_name: string;
  display_order: number;
  is_active: boolean;
  background_color?: string | null;
  background_image?: string | null;
  elements: FloorElementDTO[];
  tables: RestaurantTableDTO[];
};

export type FloorPlanDTO = {
  pos_profile: string;
  pos_mode: "Restaurant";
  canvas: { width: number; height: number };
  version: string;
  can_edit: boolean;
  floors: RestaurantFloorDTO[];
};

// ---- menu ----

export type ItemTaxDTO = {
  template?: string;
  tax_rate?: number;
  inclusive_tax_rate?: number;
  exclusive_tax_rate?: number;
  inclusive?: boolean;
  net_rate?: number;
  tax_amount?: number;
  gross_rate?: number;
};

export type MenuItemDTO = {
  item_code: string;
  item_name: string;
  item_group?: string;
  menu_category: string | null;
  description?: string;
  image?: string | null;
  uom?: string;
  stock_uom?: string;
  sales_uom?: string | null;
  rate?: number;
  price_list_rate?: number;
  actual_qty?: number;
  is_stock_item?: boolean | number;
  has_variants?: boolean | number;
  variant_of?: string | null;
  barcode?: string | null;
  is_qsr?: boolean;
  ordering_paused?: boolean;
  availability_reason?: string | null;
  item_tax?: ItemTaxDTO | null;
};

export type ModifierOptionDTO = {
  name: string;
  label: string;
  addon_item?: string | null;
  addon_qty: number;
  uom?: string | null;
  rate: number;
  item_tax?: ItemTaxDTO | null;
  available: boolean;
};

export type ModifierGroupDTO = {
  name: string;
  label: string;
  min_selections: number;
  max_selections: number;
  options: ModifierOptionDTO[];
};

export type SelectedModifier = { group: string; option: string; label: string; extra_rate: number };

export type MenuDTO = {
  pos_profile: string;
  service_type: string | null;
  table: string | null;
  floor: string | null;
  price_list: string;
  restricted: boolean;
  source: "Menu" | "POS Profile Item Groups" | "All Items";
  categories: { item_group: string; label: string }[];
  items: MenuItemDTO[];
  available_item_codes?: string[] | null;
  modifier_groups?: Record<string, ModifierGroupDTO[]>;
  /** Seconds until timed availability changes and the menu should be reloaded. */
  availability_refresh_after?: number | null;
};

export type TemplateVariantDTO = MenuItemDTO & {
  attributes?: { attribute: string; attribute_value: string }[];
};

// ---- invoices (bill preview / settlement) ----

export type InvoiceItemDTO = {
  item_code: string;
  item_name?: string;
  qty: number;
  uom?: string;
  rate?: number;
  price_list_rate?: number;
  amount?: number;
  discount_percentage?: number;
  discount_amount?: number;
  is_free_item?: boolean | number;
};

export type InvoiceTaxDTO = {
  description?: string;
  account_head?: string;
  rate?: number;
  tax_amount?: number;
  included_in_print_rate?: boolean | number;
};

export type InvoiceDTO = {
  doctype: string;
  name: string;
  docstatus: 0 | 1 | 2;
  customer?: string;
  customer_name?: string;
  selling_price_list?: string;
  posting_date?: string;
  loyalty_points?: number;
  loyalty_amount?: number;
  items: InvoiceItemDTO[];
  taxes?: InvoiceTaxDTO[];
  payments?: PaymentInput[];
  totals: {
    net_total?: number;
    total_taxes_and_charges?: number;
    grand_total?: number;
    rounded_total?: number;
    paid_amount?: number;
    outstanding_amount?: number;
    change_amount?: number;
  };
};

export type PaymentInput = {
  mode_of_payment: string;
  amount: number;
  reference_no?: string;
  reference_date?: string;
  gateway_payment_link?: string;
};

export type GatewayPaymentLinkDTO = {
  name: string;
  status: string;
  mode_of_payment: string;
  payment_gateway: string;
  amount?: number;
  transaction_reference?: string | null;
  restaurant_session?: string | null;
  handover_required?: boolean;
  can_handover?: boolean;
};

// ---- tables, orders and sessions ----

export type TableOrderRefDTO = {
  name: string;
  service_type: string;
  pax: number;
  waiter: string;
  waiter_name: string | null;
  opened_at: string;
};

export type KioskStatus = "Awaiting Payment" | "Paid" | "Sent to Kitchen";

export type RestaurantSessionStatus = "Open" | "Settling" | "Settled" | "Closed - Unpaid" | "Cancelled";

export type RestaurantSessionSummaryDTO = {
  name: string;
  status?: RestaurantSessionStatus;
  preparation_status?: string;
  customer: string;
  waiter: string;
  waiter_name: string | null;
  guest_count: number;
  opened_at: string;
  service_type: string;
  modified: string;
  tables: { table: string; table_label: string }[];
  kiosk_status?: KioskStatus | null;
  order_number?: number | null;
  sales_orders?: string[];
};

export type TableStatusDTO = {
  table: string;
  table_label: string;
  floor: string;
  seats: number;
  status: "Free" | "Occupied" | "Paid" | string;
  session?: RestaurantSessionSummaryDTO | null;
  orders: TableOrderRefDTO[];
};

export type RestaurantOrderLineDTO = {
  line_id: string;
  item_code: string;
  item_name: string;
  qty: number;
  uom: string;
  rate?: number;
  amount?: number;
  note: string | null;
  added_by: string;
  added_at: string;
  modifiers?: { label: string }[];
  parent_line_id?: string | null;
};

export type RestaurantOrderStatus = "Open" | "Billed" | "Cancelled";

export type RestaurantOrderDTO = {
  name: string;
  status: RestaurantOrderStatus;
  pos_profile: string;
  restaurant?: string | null;
  branch?: string | null;
  restaurant_session?: string | null;
  grand_total?: number;
  service_type: string;
  table: string | null;
  table_label: string | null;
  customer: string | null;
  customer_name: string | null;
  pax: number;
  waiter: string;
  waiter_name: string | null;
  opened_at: string;
  order_note: string | null;
  items: RestaurantOrderLineDTO[];
  invoice_doctype: string | null;
  invoice: string | null;
  modified: string;
};

export type RestaurantOrderSummaryDTO = Pick<
  RestaurantOrderDTO,
  | "name"
  | "restaurant_session"
  | "status"
  | "service_type"
  | "table"
  | "table_label"
  | "customer"
  | "pax"
  | "waiter"
  | "waiter_name"
  | "opened_at"
  | "invoice_doctype"
  | "invoice"
  | "modified"
> & {
  preparation_status?: string;
  billing_pending?: boolean;
  kiosk_status?: KioskStatus | null;
  order_number?: number | null;
  sales_orders?: string[];
};

export type KitchenTicketSummaryDTO = {
  name: string;
  sales_order: string;
  kitchen_station: string;
  station_label: string;
  status: string;
  sent_at: string;
  production_completed_at_billing?: number;
};

export type RestaurantSessionDTO = Omit<RestaurantSessionSummaryDTO, "tables"> & {
  status: RestaurantSessionStatus;
  pos_profile: string;
  restaurant: string;
  branch: string;
  company: string;
  customer_name: string;
  selling_price_list?: string | null;
  currency?: string | null;
  billing_doctype?: string | null;
  billing_invoice?: string | null;
  billing_profile?: string | null;
  kitchen_tickets?: KitchenTicketSummaryDTO[];
  available_waiters?: { name: string; full_name: string }[];
  walkout_reason?: string | null;
  walkout_by?: string | null;
  walkout_at?: string | null;
  confirmed_by?: string | null;
  tables: { table: string; table_label: string; released_at: string | null }[];
  rounds: RestaurantOrderDTO[];
};

export type OrderLineInput = {
  item_code: string;
  qty: number;
  uom?: string;
  note?: string;
  line_id: string;
  modifiers?: { group: string; option: string }[];
};

export type CartCheckDTO = { valid: boolean; qsr_items: string[]; invoice: InvoiceDTO };

export type SessionBillDTO = {
  session: RestaurantSessionDTO;
  invoice: InvoiceDTO;
  fingerprint: string;
  account_reference: string;
  gateway_links?: GatewayPaymentLinkDTO[];
  can_checkout?: boolean;
  can_record_walkout?: boolean;
  checkout_block_reason?: string | null;
  will_complete_preparation?: boolean;
};

export type SessionSettlementDTO = { session: RestaurantSessionDTO; invoice: InvoiceDTO };

// ---- kitchen ----

export type KitchenRoutingIssue = {
  items: {
    item_code: string;
    item_group: string;
    reason: "missing" | "ambiguous" | "invalid";
    candidates: string[];
  }[];
  stations: { name: string; station_name: string }[];
};

export type KitchenAction = "Accept" | "Start" | "Ready" | "Serve" | "Undo Serve" | "Cancel Remake";

export type KitchenLineProgress = {
  accepted_qty: number;
  started_qty: number;
  ready_qty: number;
  served_qty: number;
  not_accepted_qty: number;
  waiting_qty: number;
  preparing_qty: number;
  ready_to_serve_qty: number;
  rejected_qty?: number;
  rejected_served_qty?: number;
  remade_qty?: number;
  retired_qty?: number;
  cancelled_qty?: number;
  available_quantities: Partial<Record<KitchenAction, number>>;
};

export type KitchenTicketItemDTO = {
  line_id: string;
  work_order?: string | null;
  parent_line_id?: string | null;
  item_code: string;
  item_name: string;
  qty: number;
  uom: string;
  stock_qty: number;
  stock_uom: string;
  note?: string | null;
  modifiers: { label: string }[];
  temporary_routing: boolean;
} & Partial<KitchenLineProgress>;

export type KitchenTicketActionDTO = {
  name: string;
  action: string;
  outcome: "Succeeded" | "Failed";
  from_status: string;
  to_status: string;
  actor: string;
  occurred_at: string;
  reason?: string;
  approved_by?: string;
  error_message?: string;
  stock_entries?: string;
};

export type KitchenTicketDTO = KitchenTicketSummaryDTO & {
  modified?: string;
  pos_profile?: string;
  restaurant_session: string;
  table_labels?: string | null;
  service_type?: string | null;
  sent_by: string;
  sent_by_name?: string | null;
  waiter?: string | null;
  waiter_name?: string | null;
  order_note?: string | null;
  available_actions?: KitchenAction[];
  can_cancel_order?: boolean;
  requires_cancel_pin?: boolean;
  can_remake?: boolean;
  can_reject?: boolean;
  can_stop_preparation?: boolean;
  can_cancel_remake?: boolean;
  can_record_waste?: boolean;
  remake_of?: string | null;
  remake_reason?: string | null;
  actions?: KitchenTicketActionDTO[];
  items: KitchenTicketItemDTO[];
};

export type KitchenStationDTO = {
  name: string;
  station_name: string;
  enabled: number;
  ordering_paused?: boolean;
  availability_reason?: string | null;
  unavailable_until?: string | null;
};

export type KitchenBoardDTO = {
  can_manage_availability?: boolean;
  stations: KitchenStationDTO[];
  tickets: KitchenTicketDTO[];
  has_more: boolean;
  start: number;
};
