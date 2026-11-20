import {
  createSessionRound,
  getMenu,
  verifyManagerPin,
} from "@/features/restaurant/api/restaurantApi";
import {
  RestaurantApiError,
  restaurantErrorCode,
} from "@/features/restaurant/api/restaurantClient";
import {
  FrappeClientError,
  getVunaMethod,
  postFrappeJsonMethod,
} from "@/services/frappeClient";

jest.mock("@/services/frappeClient", () => {
  class FrappeClientError extends Error {
    code: string;
    domainCode?: string;
    constructor(message: string, kind: string, ...rest: unknown[]) {
      super(message);
      this.code = kind;
      this.domainCode = rest[3] as string | undefined;
    }
  }
  return {
    FrappeClientError,
    getVunaMethod: jest.fn(),
    postFrappeJsonMethod: jest.fn(),
    isFrappeConnectionError: (error: unknown) =>
      error instanceof FrappeClientError && error.code === "connection",
  };
});

const mockGet = jest.mocked(getVunaMethod);
const mockPost = jest.mocked(postFrappeJsonMethod);
const connection = { companyUrl: "https://vuna.example.com", sessionId: "sid-1" };

describe("restaurant API client", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads restaurant methods over GET and drops undefined params", async () => {
    mockGet.mockResolvedValue({ items: [] });
    await getMenu(connection, { pos_profile: "Nairobi", service_type: "Dine In", table: undefined });
    expect(mockGet).toHaveBeenCalledWith(
      "https://vuna.example.com",
      "sid-1",
      "vunapos.api.restaurant.get_menu",
      { pos_profile: "Nairobi", service_type: "Dine In" },
      undefined,
    );
  });

  it("posts lists as real JSON and unwraps the envelope", async () => {
    mockPost.mockResolvedValue({ ok: true, data: { name: "SO-1" } });
    const items = [{ item_code: "BIRYANI", qty: 2, line_id: "l1" }];
    const order = await createSessionRound(connection, {
      session: "VRS-1",
      items,
      idempotency_key: "k1",
      pos_profile: "Nairobi",
    });
    expect(order).toEqual({ name: "SO-1" });
    expect(mockPost).toHaveBeenCalledWith(
      "https://vuna.example.com",
      "sid-1",
      "vunapos.api.restaurant.create_session_round",
      { session: "VRS-1", items, idempotency_key: "k1", pos_profile: "Nairobi" },
      undefined,
    );
  });

  it("keeps the server code and meta on a failed write", async () => {
    mockPost.mockResolvedValue({
      ok: false,
      data: null,
      errors: [{ code: "TABLE_OCCUPIED", message: "T4 is taken" }],
      meta: { order: "VRS-9" },
    });
    const failure = createSessionRound(connection, {
      session: "VRS-1",
      items: [],
      idempotency_key: "k1",
      pos_profile: "Nairobi",
    });
    await expect(failure).rejects.toMatchObject({
      name: "RestaurantApiError",
      message: "T4 is taken",
      code: "TABLE_OCCUPIED",
      meta: { order: "VRS-9" },
    });
  });

  it("maps a read failure's domain code", async () => {
    mockGet.mockRejectedValue(
      new FrappeClientError("Not open", "api", undefined, undefined, undefined, "SESSION_NOT_OPEN"),
    );
    const caught = await getMenu(connection, { pos_profile: "Nairobi" }).catch((error) => error);
    expect(caught).toBeInstanceOf(RestaurantApiError);
    expect(restaurantErrorCode(caught)).toBe("SESSION_NOT_OPEN");
    expect(caught.isConnection).toBe(false);
  });

  it("flags connection failures as retryable", async () => {
    mockPost.mockRejectedValue(new FrappeClientError("Offline", "connection"));
    const caught = await verifyManagerPin(connection, {
      pos_profile: "Nairobi",
      pin: "1234",
      action: "order_cancel",
    }).catch((error) => error);
    expect(caught.isConnection).toBe(true);
    expect(mockPost.mock.calls[0][2]).toBe("vunapos.api.pin.verify_manager");
  });

  it("rejects a response that is not an envelope", async () => {
    mockPost.mockResolvedValue("<html>");
    await expect(
      createSessionRound(connection, { session: "S", items: [], idempotency_key: "k", pos_profile: "P" }),
    ).rejects.toThrow("invalid restaurant response");
  });
});
