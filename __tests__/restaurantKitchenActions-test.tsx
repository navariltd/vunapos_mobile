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

  it("keeps busy state per ticket so other tickets' buttons are untouched", async () => {
    const other = { name: "KOT-8", status: "Sent", modified: "m1", available_actions: ["Accept"], items: [] } as never;
    let answer: (value: unknown) => void = () => undefined;
    mockKitchenAction.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve))).mockResolvedValueOnce({});
    const { result } = await renderHook(() => useKitchenActions(jest.fn()));

    let first: Promise<{ ok: boolean }> | undefined;
    await act(async () => {
      first = result.current.perform(ticket, "Accept");
    });
    expect(result.current.busyControl("KOT-7")).toBe("Accept");
    expect(result.current.busyControl("KOT-8")).toBeNull();

    // Another ticket can still be worked while the first is in flight.
    let second: { ok: boolean } | undefined;
    await act(async () => {
      second = await result.current.perform(other, "Accept");
    });
    expect(second?.ok).toBe(true);
    expect(result.current.busyControl("KOT-7")).toBe("Accept");

    await act(async () => {
      answer({});
      await first;
    });
    expect(result.current.busyControl("KOT-7")).toBeNull();
    kitchenCommands.settle("KOT-8");
  });

  it("refuses a second action on the same ticket while one is running", async () => {
    let answer: (value: unknown) => void = () => undefined;
    mockKitchenAction.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const { result } = await renderHook(() => useKitchenActions(jest.fn()));
    let first: Promise<{ ok: boolean }> | undefined;
    await act(async () => {
      first = result.current.perform(ticket, "Accept");
    });
    let again: { ok: boolean } | undefined;
    await act(async () => {
      again = await result.current.perform(ticket, "Accept");
    });
    expect(again?.ok).toBe(false);
    expect(mockKitchenAction).toHaveBeenCalledTimes(1);
    await act(async () => {
      answer({});
      await first;
    });
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
