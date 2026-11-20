import type { ComponentProps } from "react";
import type { MaterialCommunityIcons } from "@expo/vector-icons";

import { isKitchenOnlyUser } from "@/features/restaurant/logic/restaurantRoles";
import type { RestaurantBootstrap } from "@/features/restaurant/context/RestaurantContext";

/** Route names of the tabs under src/app/(restaurant). */
export type RestaurantTabName = "sell" | "orders" | "kitchen" | "more";

export type RestaurantTab = {
  name: RestaurantTabName;
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
};

export const RESTAURANT_TABS: readonly RestaurantTab[] = [
  { name: "sell", label: "Sell", icon: "silverware-fork-knife" },
  { name: "orders", label: "Orders", icon: "clipboard-text-outline" },
  { name: "kitchen", label: "Kitchen", icon: "chef-hat" },
  { name: "more", label: "More", icon: "dots-horizontal" },
];

/** Kitchen-only operators see the board and More (profile); everyone else sees every tab. */
export function visibleRestaurantTabs(kitchenOnly: boolean): RestaurantTabName[] {
  return kitchenOnly ? ["kitchen", "more"] : RESTAURANT_TABS.map((tab) => tab.name);
}

export function restaurantHomeHref(bootstrap: RestaurantBootstrap | null) {
  const profile = bootstrap?.pos_profile;
  const kitchenOnly = isKitchenOnlyUser(profile?.restaurant_roles ?? [], Boolean(profile?.can_manage_restaurant));
  return kitchenOnly ? ("/(restaurant)/kitchen" as const) : ("/(restaurant)/sell" as const);
}
