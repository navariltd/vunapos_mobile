import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  RESTAURANT_TABS,
  type RestaurantTabName,
} from "@/features/restaurant/navigation";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

type RestaurantTabBarProps = BottomTabBarProps & { visible: RestaurantTabName[] };

/** The restaurant bottom bar: same visual language as retail, restaurant-owned. */
export function RestaurantTabBar({ state, navigation, visible }: RestaurantTabBarProps) {
  const { palette } = useAppearance();
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          paddingBottom: Math.max(insets.bottom, spacing.xs),
        },
      ]}
    >
      {RESTAURANT_TABS.filter((tab) => visible.includes(tab.name)).map((tab) => {
        const route = state.routes.find((row) => row.name === tab.name);
        if (!route) return null;
        const active = activeName === tab.name;
        const color = active ? palette.onPrimary : palette.onSurfaceMuted;
        return (
          <Pressable
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab.name}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!active && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={[styles.item, active && { backgroundColor: palette.primary }]}
          >
            <MaterialCommunityIcons color={color} name={tab.icon} size={20} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  item: {
    alignItems: "center",
    borderRadius: radii.md,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 2,
  },
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
  },
});
