import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

export type Chip = { key: string; label: string; disabled?: boolean };

/** A horizontally scrolling row of single-choice chips (service types, categories). */
export function ChipRow({
  chips,
  activeKey,
  onChange,
  accessibilityLabel,
}: {
  chips: Chip[];
  activeKey: string | null;
  onChange: (key: string) => void;
  accessibilityLabel?: string;
}) {
  const { palette } = useAppearance();
  return (
    <ScrollView
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.row}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
    >
      {chips.map((chip) => {
        const active = chip.key === activeKey;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ disabled: chip.disabled, selected: active }}
            disabled={chip.disabled}
            key={chip.key}
            onPress={() => onChange(chip.key)}
            style={[
              styles.chip,
              active
                ? { backgroundColor: palette.primary, borderColor: palette.primary }
                : { backgroundColor: palette.surface, borderColor: palette.border },
              chip.disabled && { opacity: 0.45 },
            ]}
          >
            <Text style={[styles.text, { color: active ? palette.onPrimary : palette.onSurface }]}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: spacing.md },
  row: { alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  scroller: { flexGrow: 0 },
  text: { fontFamily: typography.fontFamily.medium, fontSize: typography.size.small },
});
