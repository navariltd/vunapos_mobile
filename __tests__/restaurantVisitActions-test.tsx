import { act, renderHook } from "@testing-library/react-native";

import { RestaurantApiError } from "@/features/restaurant/api/restaurantClient";
import { useVisitActions } from "@/features/restaurant/hooks/useVisitActions";
import { draftStore } from "@/features/restaurant/state/draftStore";

const mockUpdateSession = jest.fn();
const mockCancelEmptySession = jest.fn();
jest.mock("@/features/restaurant/api/restaurantApi", () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
  cancelEmptySession: (...args: unknown[]) => mockCancelEmptySession(...args),
}));
jest.mock("@/features/restaurant/context/RestaurantContext", () => ({
  useRestaurant: () => ({ connection: { companyUrl: "https://vuna.example.com", sessionId: "sid" } }),
}));

const session = { name: "VRS-1", guest_count: 2 } as never;

describe("visit actions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("updates the visit, refreshes it and tells the lists", async () => {
    mockUpdateSession.mockResolvedValue({ name: "VRS-1" });
    const refresh = jest.fn().mockResolvedValue(undefined);
    const before = draftStore.getState().ordersVersion;
    const { result } = await renderHook(() => useVisitActions(session, refresh));
    await act(async () => {
      await result.current.setTables(["T6", "T7"]);
    });
    expect(mockUpdateSession.mock.calls[0][1]).toEqual({ session: "VRS-1", tables: ["T6", "T7"] });
    expect(refresh).toHaveBeenCalled();
    expect(draftStore.getState().ordersVersion).toBe(before + 1);
  });

  it("never sends negative or fractional guests", async () => {
    mockUpdateSession.mockResolvedValue({});
    const { result } = await renderHook(() => useVisitActions(session, jest.fn().mockResolvedValue(undefined)));
    await act(async () => {
      await result.current.setGuests(-2.5);
    });
    expect(mockUpdateSession.mock.calls[0][1]).toEqual({ session: "VRS-1", guest_count: 0 });
  });

  it("reports the server's message when a table is taken", async () => {
    mockUpdateSession.mockRejectedValue(new RestaurantApiError("T6 is occupied", { code: "TABLE_OCCUPIED" }));
    const { result } = await renderHook(() => useVisitActions(session, jest.fn()));
    let outcome: unknown = "unset";
    await act(async () => {
      outcome = await result.current.setTables(["T6"]);
    });
    expect(outcome).toBeNull();
    expect(result.current.error).toBe("T6 is occupied");
  });
});
