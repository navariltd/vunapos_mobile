import { act, renderHook } from "@testing-library/react-native";

import { RestaurantApiError } from "@/features/restaurant/api/restaurantClient";
import { kitchenCommands, useKitchenActions } from "@/features/restaurant/hooks/useKitchenActions";

const mockKitchenAction = jest.fn();
jest.mock("@/features/restaurant/api/restaurantApi", () => ({
  kitchenAction: (...args: unknown[]) => mockKitchenAction(...args),
  cancelKitchenOrder: jest.fn(),
}));
jest.mock("@/features/restaurant/context/RestaurantContext", () => ({
  useRestaurant: () => ({ connection: { companyUrl: "https://vuna.example.com", sessionId: "sid" } }),
}));

const ticket = { name: "KOT-7", status: "Sent", modified: "m1", available_actions: ["Accept"], items: [] } as never;

describe("kitchen actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    kitchenCommands.settle("KOT-7");
  });

  it("retries an unanswered action with the same request key", async () => {
    mockKitchenAction.mockRejectedValueOnce(new RestaurantApiError("Offline", { isConnection: true })).mockResolvedValueOnce({});
    const refresh = jest.fn();
    const { result } = await renderHook(() => useKitchenActions(refresh));
    let outcome: { ok: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.perform(ticket, "Accept");
    });
    expect(outcome?.ok).toBe(false);
    expect(result.current.pending("KOT-7")?.action).toBe("Accept");
    await act(async () => {
      outcome = await result.current.perform(ticket, "Accept");
    });
    expect(outcome?.ok).toBe(true);
    const keys = mockKitchenAction.mock.calls.map((call) => call[1].request_key);
    expect(keys[0]).toBe(keys[1]);
    expect(result.current.pending("KOT-7")).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("drops a refused action so the next one gets a new key", async () => {
    mockKitchenAction.mockRejectedValueOnce(new RestaurantApiError("Ticket changed", { code: "KITCHEN_STALE_STATE" }));
    const { result } = await renderHook(() => useKitchenActions(jest.fn()));
    await act(async () => {
      await result.current.perform(ticket, "Accept");
    });
    expect(result.current.pending("KOT-7")).toBeNull();
    expect(mockKitchenAction.mock.calls[0][1]).toMatchObject({ expected_status: "Sent", expected_modified: "m1" });
  });
});
