import { act, renderHook, waitFor } from "@testing-library/react-native";

import { RestaurantApiError } from "@/features/restaurant/api/restaurantClient";
import { activeDraftFor, defaultCustomer, useSellController } from "@/features/restaurant/hooks/useSellController";
import { draftStore } from "@/features/restaurant/state/draftStore";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const mockApi = {
  getMenu: jest.fn(),
  validateCart: jest.fn(),
  openSession: jest.fn(),
  createSessionRound: jest.fn(),
};
jest.mock("@/features/restaurant/api/restaurantApi", () => ({
  getMenu: (...args: unknown[]) => mockApi.getMenu(...args),
  validateCart: (...args: unknown[]) => mockApi.validateCart(...args),
  openSession: (...args: unknown[]) => mockApi.openSession(...args),
  createSessionRound: (...args: unknown[]) => mockApi.createSessionRound(...args),
}));

const mockRestaurant = {
  connection: { companyUrl: "https://vuna.example.com", sessionId: "sid" },
  posProfile: "Nairobi",
  profile: { name: "Nairobi", default_customer: { customer: "Walk-in", customer_name: "Walk-in" } },
  settings: {
    service_types: [
      { name: "Dine In", service_type_name: "Dine In", requires_table: true, display_order: 1, is_default: true },
      { name: "Takeaway", service_type_name: "Takeaway", requires_table: false, display_order: 2, is_default: false },
    ],
    allow_multiple_orders_per_table: false,
    require_manager_pin_order_cancel: false,
  },
};
jest.mock("@/features/restaurant/context/RestaurantContext", () => ({
  useRestaurant: () => mockRestaurant,
}));

const biryani = { item_code: "BIRYANI", item_name: "Chicken Biryani", uom: "Plate", rate: 950, menu_category: null };
const invoice = { doctype: "Sales Order", name: "", docstatus: 0, items: [], totals: { grand_total: 1900 } };

async function setup() {
  return renderHook(() => useSellController({ sessionName: null, session: null }));
}

describe("restaurant sell controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    draftStore.reset();
    mockApi.getMenu.mockResolvedValue({ items: [biryani], categories: [] });
    mockApi.validateCart.mockResolvedValue({ valid: true, qsr_items: [], invoice });
  });

  it("starts a new sale on the default service type and customer, asking for a table", async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.draft).not.toBeNull());
    expect(result.current.draft).toMatchObject({ service_type: "Dine In", table: null });
    expect(result.current.header?.customer).toBe("Walk-in");
    expect(result.current.needsTable).toBe(true);
    expect(mockApi.getMenu).not.toHaveBeenCalled();
  });

  it("loads the menu once a table is chosen and commits only validated items", async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.draft).not.toBeNull());
    await act(async () => {
      await result.current.chooseTable({ name: "T4", table_label: "4" });
    });
    await waitFor(() => expect(mockApi.getMenu).toHaveBeenCalled());
    expect(mockApi.getMenu.mock.calls[0][1]).toMatchObject({ service_type: "Dine In", table: "T4" });

    await act(async () => {
      await result.current.addItem(biryani as never);
    });
    expect(result.current.draft?.unsent).toEqual([expect.objectContaining({ item_code: "BIRYANI", qty: 1 })]);
    expect(result.current.pricedInvoice).toEqual(invoice);

    mockApi.validateCart.mockRejectedValueOnce(new RestaurantApiError("Out of rice", { code: "INSUFFICIENT_STOCK" }));
    await act(async () => {
      await result.current.addItem(biryani as never);
    });
    expect(result.current.draft?.unsent[0].qty).toBe(1);
  });

  it("opens the visit once and reuses it when retrying a failed round", async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.draft).not.toBeNull());
    await act(async () => {
      await result.current.chooseTable({ name: "T4", table_label: "4" });
    });
    await act(async () => {
      await result.current.addItem(biryani as never);
    });

    const visit = { name: "VRS-1", pos_profile: "Nairobi", service_type: "Dine In", customer: "Walk-in", customer_name: "Walk-in", guest_count: 0, tables: [{ table: "T4", table_label: "4", released_at: null }], rounds: [] };
    mockApi.openSession.mockResolvedValue(visit);
    mockApi.createSessionRound.mockRejectedValueOnce(new RestaurantApiError("Offline", { isConnection: true }));
    let name: string | null = "unset";
    await act(async () => {
      name = await result.current.placeOrder();
    });
    expect(name).toBeNull();
    expect(result.current.draft?.unsent).toHaveLength(1);

    mockApi.createSessionRound.mockResolvedValueOnce({ name: "SO-1" });
    await act(async () => {
      name = await result.current.placeOrder();
    });
    expect(name).toBe("VRS-1");
    expect(mockApi.openSession).toHaveBeenCalledTimes(1);
    const roundKeys = mockApi.createSessionRound.mock.calls.map((call) => call[1].idempotency_key);
    expect(new Set(roundKeys).size).toBe(1);
    expect(draftStore.getState().draft).toMatchObject({ restaurant_session: "VRS-1", unsent: [] });
  });

  it("asks for kitchen stations when routing is missing", async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.draft).not.toBeNull());
    await act(async () => {
      await result.current.chooseTable({ name: "T4", table_label: "4" });
    });
    mockApi.validateCart.mockRejectedValueOnce(
      new RestaurantApiError("Choose a station", {
        code: "KITCHEN_ROUTING_REQUIRED",
        meta: {
          items: [{ item_code: "BIRYANI", item_group: "Mains", reason: "missing", candidates: [] }],
          stations: [{ name: "KS-1", station_name: "Hot Kitchen" }],
        },
      }),
    );
    await act(async () => {
      await result.current.addItem(biryani as never);
    });
    expect(result.current.routingIssue?.stations).toEqual([{ name: "KS-1", station_name: "Hot Kitchen" }]);

    await act(async () => {
      await result.current.applyKitchenRouting({ BIRYANI: "KS-1" });
    });
    expect(result.current.draft?.kitchen_routing).toEqual({ BIRYANI: "KS-1" });
    expect(result.current.draft?.unsent).toHaveLength(1);
  });
});

describe("sell helpers", () => {
  it("normalises the profile's default customer", () => {
    expect(defaultCustomer("Walk-in")).toEqual({ customer: "Walk-in", customer_name: "Walk-in" });
    expect(defaultCustomer(null)).toBeNull();
  });

  it("only shows a draft for its own visit and profile", () => {
    const draft = { pos_profile: "Nairobi", order: null, restaurant_session: "VRS-1" } as never;
    expect(activeDraftFor(draft, "VRS-1", "Nairobi")).toBe(draft);
    expect(activeDraftFor(draft, null, "Nairobi")).toBeNull();
    expect(activeDraftFor(draft, "VRS-1", "Other")).toBeNull();
  });
});
