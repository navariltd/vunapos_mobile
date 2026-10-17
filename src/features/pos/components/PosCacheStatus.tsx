import { StyleSheet, Text } from "react-native";

import { useAppearance } from "@/theme/AppearanceProvider";
import { spacing, typography } from "@/theme/tokens";

type PosCacheStatusProps = {
  isOffline: boolean;
  isRefreshing?: boolean;
  isStale?: boolean;
  lastUpdated: number | null | undefined;
};

/** Reports only actionable cache states; refresh timestamps remain internal. */
export function PosCacheStatus({
  isOffline,
  isRefreshing = false,
  isStale = false,
}: PosCacheStatusProps) {
  const { palette } = useAppearance();
  const label = isOffline
    ? "Offline · saved data unavailable"
    : isRefreshing
      ? "Refreshing…"
      : isStale
        ? "Saved data may be outdated"
        : null;

  if (!label) return null;
  return <Text style={[styles.label, { color: palette.onSurfaceMuted }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.tiny,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    textAlign: "center",
  },
});
