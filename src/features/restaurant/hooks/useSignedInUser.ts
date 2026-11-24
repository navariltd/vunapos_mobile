import { useEffect, useState } from "react";

import { restaurantRawWrite } from "@/features/restaurant/api/restaurantClient";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";

/** The signed-in Frappe user id (their email), or null until it loads. */
export function useSignedInUser(): string | null {
  const { connection } = useRestaurant();
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    restaurantRawWrite<string>(connection, "frappe.auth.get_logged_user")
      .then((value) => {
        if (active && typeof value === "string") setUser(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [connection]);

  return user;
}
