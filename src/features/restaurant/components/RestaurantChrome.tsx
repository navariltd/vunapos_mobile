import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { NetworkStatusBanner } from "@/components/network/NetworkStatusBanner";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { restaurantRoleLabel } from "@/features/restaurant/logic/restaurantRoles";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/** Top bar and connectivity banner around every restaurant screen. */
export function RestaurantChrome({ children, showProfileButton = true }: PropsWithChildren<{ showProfileButton?: boolean }>) {
  const { palette } = useAppearance();
  const restaurant = useRestaurant();
  const title = restaurant.settings.restaurant_name || restaurant.posProfile;

  return (
    <SafeAreaView edges={["top"]} style={[styles.root, { backgroundColor: palette.background }]}>
      <View style={[styles.bar, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
        <View style={styles.titles}>
          <Text numberOfLines={1} style={[styles.title, { color: palette.onSurface }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: palette.onSurfaceMuted }]}>
            {restaurantRoleLabel(restaurant.roles)}
          </Text>
        </View>
        {showProfileButton ? <Pressable
          accessibilityLabel="Open profile"
          onPress={() => router.navigate("/(restaurant)/more")}
          style={[styles.profileButton, { borderColor: palette.border, backgroundColor: palette.surfaceContainer }]}
        >
          <MaterialCommunityIcons color={palette.onSurface} name="account-circle-outline" size={24} />
        </Pressable> : null}
      </View>
      <NetworkStatusBanner />
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    height: 52,
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  content: { flex: 1 },
  profileButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  root: { flex: 1 },
  subtitle: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.tiny },
  title: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
  titles: { flex: 1, minWidth: 0 },
});
