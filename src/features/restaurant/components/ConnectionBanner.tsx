import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { restaurantRead } from "@/features/restaurant/api/restaurantClient";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { useRestaurantConnectivity } from "@/features/restaurant/state/connectivity";
import { useNetworkStatus } from "@/services/NetworkStatusProvider";
import { useAppearance } from "@/theme/AppearanceProvider";
import { spacing, typography } from "@/theme/tokens";

const RECHECK_MS = 5_000;

/**
 * Shown while the company site cannot be reached. It clears on the next
 * successful request: a ping every 5 s while it is up, and straight away when
 * the device reports it is back online.
 */
export function ConnectionBanner() {
  const { palette } = useAppearance();
  const { connection } = useRestaurant();
  const status = useRestaurantConnectivity();
  const { connectionStatus } = useNetworkStatus();
  const offline = status === "offline";

  useEffect(() => {
    if (!offline) return;
    // The ping needs no session; any answer marks the site reachable again.
    const check = () => void restaurantRead(connection, "vunapos.api.pos.ping").catch(() => undefined);
    check();
    const timer = setInterval(check, RECHECK_MS);
    return () => clearInterval(timer);
  }, [connection, connectionStatus, offline]);

  if (!offline) return null;
  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: palette.warningSurface }]}>
      <MaterialCommunityIcons color={palette.warning} name="wifi-off" size={16} />
      <Text style={[styles.text, { color: palette.warning }]}>Connection unavailable. Reconnecting…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { alignItems: "center", flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: 6 },
  text: { flex: 1, fontFamily: typography.fontFamily.medium, fontSize: typography.size.small },
});
