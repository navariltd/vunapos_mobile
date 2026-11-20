import { createContext, PropsWithChildren, useContext, useMemo } from "react";

import { useAppSession } from "@/features/auth/AppSessionProvider";
import type { RestaurantConnection } from "@/features/restaurant/api/restaurantClient";
import {
  isKitchenOnlyUser,
  needsRestaurantShift,
} from "@/features/restaurant/logic/restaurantRoles";
import type {
  RestaurantPaymentMode,
  RestaurantProfile,
  RestaurantSettings,
} from "@/features/restaurant/types";
import { useRootPosBootstrapSnapshot } from "@/sync/PosBootstrapSnapshot";

/** The cashier/waiter's own POS shift, from bootstrap.pos_session. */
export type RestaurantShift = {
  ready: boolean;
  has_opening_entry: boolean;
  opening_entry?: string | null;
  closing_entry?: string | null;
  opened_at?: string | null;
  pos_profile?: string | null;
  status?: "CLOSING" | "CLOSING_FAILED" | "OPEN" | "OPENING_REQUIRED";
};

/** The parts of the shared bootstrap snapshot restaurant mode reads. */
export type RestaurantBootstrap = {
  site_name?: string;
  pos_profile?: RestaurantProfile;
  pos_session?: RestaurantShift | null;
  payment_modes?: RestaurantPaymentMode[];
};

export type RestaurantContextValue = {
  connection: RestaurantConnection;
  profile: RestaurantProfile;
  posProfile: string;
  settings: RestaurantSettings;
  shift: RestaurantShift | null;
  paymentModes: RestaurantPaymentMode[];
  currency: string;
  currencyPrecision: number;
  roles: string[];
  canTakePayment: boolean;
  canManage: boolean;
  kitchenOnly: boolean;
  /** Everyone but a kitchen-only operator works inside their own POS shift. */
  needsShift: boolean;
  shiftReady: boolean;
  reload: () => void | Promise<void>;
};

const EMPTY_SETTINGS: RestaurantSettings = {
  service_types: [],
  allow_multiple_orders_per_table: false,
  require_manager_pin_order_cancel: false,
};

/** Reads restaurant facts from a bootstrap payload without touching retail types. */
export function readRestaurantBootstrap(data: unknown): RestaurantBootstrap | null {
  return data && typeof data === "object" ? (data as RestaurantBootstrap) : null;
}

export function isRestaurantMode(data: unknown): boolean {
  return readRestaurantBootstrap(data)?.pos_profile?.pos_mode === "Restaurant";
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function buildRestaurantContext(input: {
  bootstrap: RestaurantBootstrap;
  connection: RestaurantConnection;
  reload: () => void | Promise<void>;
}): RestaurantContextValue | null {
  const profile = input.bootstrap.pos_profile;
  if (!profile?.name || profile.pos_mode !== "Restaurant") return null;
  const roles = profile.restaurant_roles ?? [];
  const canTakePayment = Boolean(profile.can_take_payment);
  const canManage = Boolean(profile.can_manage_restaurant);
  const shift = input.bootstrap.pos_session ?? null;
  const shiftMatches = !shift?.pos_profile || shift.pos_profile === profile.name;
  return {
    connection: input.connection,
    profile,
    posProfile: profile.name,
    settings: profile.restaurant ?? EMPTY_SETTINGS,
    shift,
    paymentModes: input.bootstrap.payment_modes ?? profile.modes_of_payment ?? [],
    currency: profile.currency ?? "KES",
    currencyPrecision: profile.currency_precision ?? 2,
    roles,
    canTakePayment,
    canManage,
    kitchenOnly: isKitchenOnlyUser(roles, canManage),
    needsShift: needsRestaurantShift(roles, canTakePayment, canManage),
    shiftReady: Boolean(shift?.ready && shiftMatches),
    reload: input.reload,
  };
}

/** Restaurant-wide facts for the screens under src/app/(restaurant). */
export function RestaurantProvider({ children }: PropsWithChildren) {
  const { companyUrl, sessionId } = useAppSession();
  const snapshot = useRootPosBootstrapSnapshot();
  const data = snapshot?.data;
  const reload = snapshot?.reload;
  const value = useMemo(() => {
    const bootstrap = readRestaurantBootstrap(data);
    if (!bootstrap || !companyUrl || !sessionId || !reload) return null;
    return buildRestaurantContext({ bootstrap, connection: { companyUrl, sessionId }, reload });
  }, [companyUrl, data, reload, sessionId]);
  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

/** Null until a Restaurant-mode bootstrap is available. */
export function useOptionalRestaurant() {
  return useContext(RestaurantContext);
}

export function useRestaurant(): RestaurantContextValue {
  const value = useContext(RestaurantContext);
  if (!value) throw new Error("useRestaurant must be used inside a Restaurant-mode RestaurantProvider.");
  return value;
}
