import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Provider as PaperProvider } from "react-native-paper";

import { RestaurantSellScreen } from "@/features/restaurant/screens/RestaurantSellScreen";
import { draftStore } from "@/features/restaurant/state/draftStore";

// FlashList measures native layout, which jest cannot; give it a phone-sized viewport.
jest.mock("@shopify/flash-list/dist/recyclerview/utils/measureLayout", () => {
  const actual = jest.requireActual("@shopify/flash-list/dist/recyclerview/utils/measureLayout");
  const box = () => ({ x: 0, y: 0, width: 400, height: 900 });
  return { ...actual, measureParentSize: jest.fn(box), measureFirstChildLayout: jest.fn(box), measureItemLayout: jest.fn(box) };
});

const mockParams: { session?: string; view?: string } = {};
jest.mock("expo-router", () => ({
  router: { setParams: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  useIsFocused: () => true,
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@/components/feedback/ToastProvider", () => ({
  useToast: () => ({ error: jest.fn(), info: jest.fn(), success: jest.fn(), warning: jest.fn() }),
}));

const mockApi = {
  getMenu: jest.fn(),
  getFloorPlan: jest.fn(),
  getTableStatus: jest.fn(),
  validateCart: jest.fn(),
  getSession: jest.fn(),
};
jest.mock("@/features/restaurant/api/restaurantApi", () => ({
  getMenu: (...args: unknown[]) => mockApi.getMenu(...args),
  getFloorPlan: (...args: unknown[]) => mockApi.getFloorPlan(...args),
  getTableStatus: (...args: unknown[]) => mockApi.getTableStatus(...args),
  validateCart: (...args: unknown[]) => mockApi.validateCart(...args),
  getSession: (...args: unknown[]) => mockApi.getSession(...args),
  openSession: jest.fn(),
  createSessionRound: jest.fn(),
  getTemplateVariants: jest.fn(),
  updateSession: jest.fn(),
  cancelEmptySession: jest.fn(),
  renderReceipt: jest.fn(),
  previewSessionBill: jest.fn(),
  checkoutSession: jest.fn(),
  getKitchenTicket: jest.fn(),
  searchCustomers: jest.fn().mockResolvedValue([]),
}));

const mockRestaurant = {
  connection: { companyUrl: "https://vuna.example.com", sessionId: "sid" },
  posProfile: "WL - Waiter Tablet",
  profile: { name: "WL - Waiter Tablet", default_customer: "Walk-in", hide_images: true },
  settings: {
    service_types: [
      { name: "Dine In", service_type_name: "Dine In", requires_table: true, display_order: 1, is_default: false },
      { name: "Takeaway", service_type_name: "Takeaway", requires_table: false, display_order: 2, is_default: true },
    ],
    allow_multiple_orders_per_table: false,
    require_manager_pin_order_cancel: false,
  },
  currency: "KES",
  currencyPrecision: 2,
  canTakePayment: false,
  shiftReady: true,
  paymentModes: [],
};
jest.mock("@/features/restaurant/context/RestaurantContext", () => ({
  useRestaurant: () => mockRestaurant,
}));

/** FlashList finishes its first layout asynchronously; let it settle inside act. */
async function flushListLayout() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("restaurant Sell screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    draftStore.reset();
    mockApi.getMenu.mockResolvedValue({
      items: [{ item_code: "BURGER", item_name: "Beef Burger", rate: 1010, menu_category: "Burgers" }],
      categories: [{ item_group: "Burgers", label: "Burgers" }],
    });
    mockApi.getFloorPlan.mockResolvedValue({ canvas: { width: 1000, height: 700 }, floors: [], can_edit: false });
    mockApi.getTableStatus.mockResolvedValue([]);
  });

  it("renders a takeaway sale's menu without looping", async () => {
    await render(
      <PaperProvider>
        <RestaurantSellScreen />
      </PaperProvider>,
    );
    await waitFor(() => expect(screen.getByText("Beef Burger")).toBeTruthy());
    expect(mockApi.getMenu).toHaveBeenCalledTimes(1);
    await flushListLayout();
  });

  it("asks for a table first on a dine-in default without looping", async () => {
    mockRestaurant.settings.service_types[0].is_default = true;
    mockRestaurant.settings.service_types[1].is_default = false;
    mockApi.getFloorPlan.mockResolvedValue({
      canvas: { width: 1000, height: 700 },
      can_edit: false,
      floors: [{ name: "F1", floor_name: "Rooftop", display_order: 1, is_active: true, elements: [], tables: [
        { name: "R3", floor: "F1", table_label: "R3", seats: 4, shape: "Square", x: 100, y: 100, width: 80, height: 80, rotation: 0, is_active: true },
      ] }],
    });
    await render(
      <PaperProvider>
        <RestaurantSellScreen />
      </PaperProvider>,
    );
    await waitFor(() => expect(screen.getByText("Choose a table for Dine In")).toBeTruthy());
    await waitFor(() => expect(mockApi.getTableStatus).toHaveBeenCalled());
    expect(mockApi.getMenu).not.toHaveBeenCalled();
    await flushListLayout();
    mockRestaurant.settings.service_types[0].is_default = false;
    mockRestaurant.settings.service_types[1].is_default = true;
  });

  it("opens an existing visit without looping", async () => {
    mockParams.session = "VRS-1";
    mockApi.getSession.mockResolvedValue({
      name: "VRS-1", status: "Open", pos_profile: "WL - Waiter Tablet", service_type: "Dine In", customer: "Walk-in",
      customer_name: "Walk-in", guest_count: 2, waiter: "w", waiter_name: "Waiter", opened_at: "2026-11-20 09:00:00",
      modified: "m", restaurant: "Java", branch: "B", company: "C",
      tables: [{ table: "R1", table_label: "R1", released_at: null }], rounds: [],
    });
    await render(
      <PaperProvider>
        <RestaurantSellScreen />
      </PaperProvider>,
    );
    await waitFor(() => expect(screen.getByText("Beef Burger")).toBeTruthy());
    expect(mockApi.getMenu).toHaveBeenCalledTimes(1);
    await flushListLayout();
    delete mockParams.session;
  });

  it("shows a visit's placed orders when opened from Orders", async () => {
    mockParams.session = "VRS-2";
    mockParams.view = "orders";
    mockApi.getSession.mockResolvedValue({
      name: "VRS-2", status: "Open", pos_profile: "Cashier", service_type: "Takeaway", customer: "Walk-in",
      customer_name: "Walk-in", guest_count: 1, waiter: "w", waiter_name: "Waiter", opened_at: "2026-11-20 09:00:00",
      modified: "m", restaurant: "Java", branch: "B", company: "C", tables: [], kitchen_tickets: [],
      rounds: [{ name: "SO-1", status: "Open", grand_total: 1010, items: [
        { line_id: "l1", item_code: "BURGER", item_name: "Beef Burger", qty: 1, uom: "Nos", note: null, added_by: "w", added_at: "t" },
      ] }],
    });
    await render(
      <PaperProvider>
        <RestaurantSellScreen />
      </PaperProvider>,
    );
    await waitFor(() => expect(screen.getByText("Placed orders")).toBeTruthy());
    expect(screen.getByText("Round 1")).toBeTruthy();
    await flushListLayout();
    delete mockParams.session;
    delete mockParams.view;
  });
});
