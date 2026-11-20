import {
  FrappeClientError,
  getVunaMethod,
  isFrappeConnectionError,
  postFrappeJsonMethod,
} from "@/services/frappeClient";

/** Where restaurant requests go: the signed-in Frappe site and its session. */
export type RestaurantConnection = { companyUrl: string; sessionId: string };

type Envelope<T> = {
  ok: boolean;
  data: T;
  errors?: { code?: string; message?: string }[];
  meta?: Record<string, unknown>;
};

export type ReadParams = Record<string, string | number | boolean | null | undefined>;
export type WriteParams = Record<string, unknown>;

/**
 * A failed restaurant call. `code` is the server's vuna_error_code (the UI
 * branches on it, never on the message) and `meta` its vuna_error_meta.
 */
export class RestaurantApiError extends Error {
  readonly code: string | null;
  readonly meta: Record<string, unknown>;
  /** True when the device could not reach the site; retrying is safe. */
  readonly isConnection: boolean;

  constructor(
    message: string,
    options: { code?: string | null; meta?: Record<string, unknown>; isConnection?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "RestaurantApiError";
    this.code = options.code ?? null;
    this.meta = options.meta ?? {};
    this.isConnection = Boolean(options.isConnection);
    if (options.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

export function restaurantErrorCode(error: unknown): string | null {
  return error instanceof RestaurantApiError ? error.code : null;
}

export function restaurantErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** A bare name is a restaurant method; a dotted path is used as-is (e.g. vunapos.api.pin.verify_manager). */
function method(name: string) {
  return name.includes(".") ? name : `vunapos.api.restaurant.${name}`;
}

function toRestaurantError(error: unknown): RestaurantApiError {
  if (error instanceof RestaurantApiError) return error;
  if (error instanceof FrappeClientError) {
    return new RestaurantApiError(error.message, {
      code: error.domainCode ?? null,
      isConnection: isFrappeConnectionError(error),
      cause: error,
    });
  }
  return new RestaurantApiError(
    error instanceof Error ? error.message : "The restaurant request failed.",
    { cause: error },
  );
}

function definedOnly<T extends Record<string, unknown>>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** GET a read-only restaurant method (vunapos.api.restaurant.<name>). */
export async function restaurantRead<T>(
  connection: RestaurantConnection,
  name: string,
  params: ReadParams = {},
  signal?: AbortSignal,
): Promise<T> {
  try {
    return await getVunaMethod<T>(
      connection.companyUrl,
      connection.sessionId,
      method(name),
      definedOnly(params),
      signal,
    );
  } catch (error) {
    throw toRestaurantError(error);
  }
}

/**
 * POST a restaurant method with a JSON body. Lists and objects travel as real
 * JSON, and the envelope is unwrapped here so a failure keeps its `meta`
 * (routing candidates, the order holding a table, …).
 */
export async function restaurantWrite<T>(
  connection: RestaurantConnection,
  name: string,
  params: WriteParams = {},
  signal?: AbortSignal,
): Promise<T> {
  let envelope: Envelope<T>;
  try {
    envelope = await postFrappeJsonMethod<Envelope<T>>(
      connection.companyUrl,
      connection.sessionId,
      method(name),
      definedOnly(params),
      signal,
    );
  } catch (error) {
    throw toRestaurantError(error);
  }
  if (!envelope || typeof envelope !== "object" || typeof envelope.ok !== "boolean") {
    throw new RestaurantApiError("The server returned an invalid restaurant response.");
  }
  if (!envelope.ok) {
    const first = envelope.errors?.[0];
    throw new RestaurantApiError(first?.message || "The restaurant action could not be completed.", {
      code: first?.code ?? null,
      meta: envelope.meta && typeof envelope.meta === "object" ? envelope.meta : {},
    });
  }
  return envelope.data;
}

/** POST a JSON method that returns Frappe's raw `message` instead of the VunaPOS envelope. */
export async function restaurantRawWrite<T>(
  connection: RestaurantConnection,
  fullMethod: string,
  params: WriteParams = {},
  signal?: AbortSignal,
): Promise<T> {
  try {
    return await postFrappeJsonMethod<T>(connection.companyUrl, connection.sessionId, fullMethod, definedOnly(params), signal);
  } catch (error) {
    throw toRestaurantError(error);
  }
}
