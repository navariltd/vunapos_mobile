import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { PosNavigationTab } from "@/features/pos/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

const navigationItems = [
  { icon: "home-outline", label: "Home", tab: "Home" },
  { icon: "receipt-text-outline", label: "Sales", tab: "Invoices" },
  { icon: "credit-card-outline", label: "Payments", tab: "Payments" },
  { icon: "account-group-outline", label: "Customers", tab: "Customers" },
  { icon: "logout-variant", label: "Close Shift", tab: "Close Shift" },
] as const;

type PosBottomNavigationProps = {
  activeTab: PosNavigationTab;
  customersEnabled?: boolean;
  onTabChange: (tab: PosNavigationTab) => void;
  paymentsEnabled?: boolean;
};

function isImplementedTab(
  tab: PosNavigationTab,
  customersEnabled: boolean,
  paymentsEnabled: boolean,
): boolean {
  return (
    tab === "Home" ||
    tab === "Invoices" ||
    tab === "Close Shift" ||
    (tab === "Customers" && customersEnabled) ||
    (tab === "Payments" && paymentsEnabled)
  );
}

/** Native tabs become interactive only when their required profile feature is available. */
export function PosBottomNavigation({
  activeTab,
  customersEnabled = false,
  onTabChange,
  paymentsEnabled = false,
}: PosBottomNavigationProps) {
  const { palette } = useAppearance();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.navigation,
        { backgroundColor: palette.surface, borderTopColor: palette.border },
      ]}
    >
      {navigationItems.map(({ icon, label, tab }) => {
        const isActive = tab === activeTab;
        const color = isActive ? palette.onPrimary : palette.onSurfaceMuted;
        const itemContent = (
          <>
            <MaterialCommunityIcons color={color} name={icon} size={19} />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </>
        );

        if (isImplementedTab(tab, customersEnabled, paymentsEnabled)) {
          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              key={tab}
              onPress={() => onTabChange(tab)}
              style={[
                styles.item,
                isActive && { backgroundColor: palette.primary },
              ]}
            >
              {itemContent}
            </Pressable>
          );
        }

        return (
          <View
            accessibilityLabel={label}
            accessibilityRole="tab"
            accessibilityState={{ disabled: true }}
            key={tab}
            style={styles.item}
          >
            {itemContent}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 10,
  },
  navigation: {
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
});
