import {
  buildRestaurantContext,
  isRestaurantMode,
} from "@/features/restaurant/context/RestaurantContext";
import { restaurantHomeHref, visibleRestaurantTabs } from "@/features/restaurant/navigation";

const connection = { companyUrl: "https://vuna.example.com", sessionId: "sid-1" };
const reload = jest.fn();

function bootstrap(profile: Record<string, unknown>, pos_session?: Record<string, unknown>) {
  return {
    pos_profile: { name: "Nairobi", pos_mode: "Restaurant" as const, ...profile },
    pos_session: pos_session as never,
  };
}

describe("restaurant mode detection", () => {
  it("only treats Restaurant profiles as restaurant mode", () => {
    expect(isRestaurantMode(bootstrap({}))).toBe(true);
    expect(isRestaurantMode({ pos_profile: { name: "Shop", pos_mode: "Retail" } })).toBe(false);
    expect(isRestaurantMode({ pos_profile: { name: "Shop" } })).toBe(false);
    expect(isRestaurantMode(null)).toBe(false);
  });

  it("builds no context for a retail profile", () => {
    expect(
      buildRestaurantContext({ bootstrap: { pos_profile: { name: "Shop", pos_mode: "Retail" } }, connection, reload }),
    ).toBeNull();
  });
});

describe("restaurant context", () => {
  it("requires a shift from waiters and reports it ready for the same profile", () => {
    const context = buildRestaurantContext({
      bootstrap: bootstrap(
        { restaurant_roles: ["VunaPOS Waiter"] },
        { ready: true, has_opening_entry: true, pos_profile: "Nairobi", opening_entry: "POS-OPE-1" },
      ),
      connection,
      reload,
    });
    expect(context).toMatchObject({ needsShift: true, shiftReady: true, kitchenOnly: false, canTakePayment: false });
  });

  it("does not accept another profile's shift", () => {
    const context = buildRestaurantContext({
      bootstrap: bootstrap(
        { restaurant_roles: ["VunaPOS Cashier"], can_take_payment: true },
        { ready: true, has_opening_entry: true, pos_profile: "Other" },
      ),
      connection,
      reload,
    });
    expect(context?.shiftReady).toBe(false);
    expect(context?.canTakePayment).toBe(true);
  });

  it("lets kitchen-only staff skip the shift", () => {
    const context = buildRestaurantContext({
      bootstrap: bootstrap({ restaurant_roles: ["VunaPOS Kitchen User"] }),
      connection,
      reload,
    });
    expect(context).toMatchObject({ kitchenOnly: true, needsShift: false });
  });

  it("falls back to empty settings and the profile's payment modes", () => {
    const context = buildRestaurantContext({
      bootstrap: bootstrap({ modes_of_payment: [{ mode_of_payment: "Cash" }] }),
      connection,
      reload,
    });
    expect(context?.settings.service_types).toEqual([]);
    expect(context?.paymentModes).toEqual([{ mode_of_payment: "Cash" }]);
    expect(context?.currency).toBe("KES");
  });
});

describe("restaurant navigation", () => {
  it("sends kitchen-only staff to the kitchen and everyone else to Sell", () => {
    expect(restaurantHomeHref(bootstrap({ restaurant_roles: ["VunaPOS Kitchen User"] }))).toBe("/(restaurant)/kitchen");
    expect(restaurantHomeHref(bootstrap({ restaurant_roles: ["VunaPOS Waiter"] }))).toBe("/(restaurant)/sell");
    expect(
      restaurantHomeHref(bootstrap({ restaurant_roles: ["VunaPOS Kitchen User"], can_manage_restaurant: true })),
    ).toBe("/(restaurant)/sell");
  });

  it("shows kitchen-only staff only Kitchen and More", () => {
    expect(visibleRestaurantTabs(true)).toEqual(["kitchen", "more"]);
    expect(visibleRestaurantTabs(false)).toEqual(["sell", "orders", "kitchen", "more"]);
  });
});
