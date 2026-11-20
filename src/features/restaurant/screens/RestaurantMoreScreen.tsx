import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

import { useAppSession } from "@/features/auth/AppSessionProvider";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { restaurantRoleLabel } from "@/features/restaurant/logic/restaurantRoles";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/** Profile facts and account actions. Close Shift and shared pages join this list later. */
export function RestaurantMoreScreen() {
  const { palette } = useAppearance();
  const { signOut } = useAppSession();
  const restaurant = useRestaurant();
  const rows: [string, string | null | undefined][] = [
    ["Role", restaurantRoleLabel(restaurant.roles)],
    ["POS Profile", restaurant.posProfile],
    ["Restaurant", restaurant.settings.restaurant_name || restaurant.settings.restaurant],
    ["Branch", restaurant.settings.branch],
    ["Shift", restaurant.needsShift ? restaurant.shift?.opening_entry ?? "Not open" : "Not required"],
  ];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        {rows.map(([label, value]) => (
          <View key={label} style={[styles.row, { borderBottomColor: palette.borderSubtle }]}>
            <Text style={[styles.label, { color: palette.onSurfaceMuted }]}>{label}</Text>
            <Text style={[styles.value, { color: palette.onSurface }]}>{value || "—"}</Text>
          </View>
        ))}
      </View>
      <Button icon="logout-variant" mode="outlined" onPress={() => void signOut()} textColor={palette.error}>
        Sign out
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, overflow: "hidden" },
  content: { gap: spacing.md, padding: spacing.md },
  label: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  value: { flexShrink: 1, fontFamily: typography.fontFamily.medium, fontSize: typography.size.small, textAlign: "right" },
});
