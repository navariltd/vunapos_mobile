/** The restaurant routes on mobile (src/app/(restaurant)). */
export type RestaurantPage =
  | "Orders"
  | "Sell"
  | "Kitchen"
  | "Sales"
  | "Payments"
  | "Customers"
  | "Profile"
  | "Close Shift";

// Short names for the VunaPOS roles, in the order the server sends them.
const ROLE_LABELS: Record<string, string> = {
  "VunaPOS Waiter": "Waiter",
  "VunaPOS Cashier": "Cashier",
  "VunaPOS Restaurant Manager": "Manager",
  "VunaPOS Kitchen User": "Kitchen",
  "VunaPOS Kiosk": "Kiosk",
};

export function restaurantRoleLabel(roles?: string[] | null) {
  const labels = (roles || []).map((role) => ROLE_LABELS[role]).filter(Boolean);
  return labels.length ? labels.join(" · ") : "VunaPOS user";
}

export function isKitchenOnlyUser(roles: string[], canManage = false) {
  return (
    !canManage &&
    roles.includes("VunaPOS Kitchen User") &&
    !roles.some((role) =>
      [
        "VunaPOS Waiter",
        "VunaPOS Cashier",
        "VunaPOS Restaurant Manager",
      ].includes(role)
    )
  );
}

// Waiters, cashiers and managers clear a paid kiosk order's table when its guests leave.
export function canClearTables(roles: string[] = [], canManage = false) {
  return (
    canManage ||
    roles.some((role) =>
      ["VunaPOS Waiter", "VunaPOS Cashier", "VunaPOS Restaurant Manager"].includes(role)
    )
  );
}

export function needsRestaurantShift(roles: string[] = [], canTakePayment = false, canManage = false) {
  // Fail closed for legacy/ordinary POS roles and incomplete cached role data.
  // Only a positively identified kitchen-only operator bypasses the selling gate.
  return canTakePayment || !isKitchenOnlyUser(roles, canManage);
}

// Shared pages remain available in restaurant mode, subject to profile feature
// switches. Waiters and cashiers close their own shifts; document permissions still apply.
export function isRestaurantPageAllowed(
  page: RestaurantPage,
  canTakePayment: boolean,
  features?: {
    allowCustomerPayments?: boolean;
    allowCustomerManagement?: boolean;
    kitchenOnly?: boolean;
    canManageShift?: boolean;
  }
) {
  if (features?.kitchenOnly) return page === "Kitchen" || page === "Profile";
  if (page === "Close Shift") return features?.canManageShift ?? canTakePayment;
  if (page === "Payments") return features?.allowCustomerPayments !== false;
  if (page === "Customers") return features?.allowCustomerManagement !== false;
  return ["Orders", "Sell", "Kitchen", "Sales", "Profile"].includes(page);
}
