import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { useAppearance } from "@/theme/AppearanceProvider";
import { spacing, typography } from "@/theme/tokens";

/** Centered icon + message for empty, loading and not-yet-built states. */
export function RestaurantPlaceholder({
  icon,
  title,
  description,
  children,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const { palette } = useAppearance();
  return (
    <View style={styles.root}>
      <MaterialCommunityIcons color={palette.onSurfaceMuted} name={icon} size={40} />
      <Text style={[styles.title, { color: palette.onSurface }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: palette.onSurfaceMuted }]}>{description}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  description: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    textAlign: "center",
  },
  root: { alignItems: "center", flex: 1, gap: spacing.xs, justifyContent: "center", padding: spacing.xl },
  title: { fontFamily: typography.fontFamily.semibold, fontSize: 16, textAlign: "center" },
});
