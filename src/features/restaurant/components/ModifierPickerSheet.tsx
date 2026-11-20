import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, HelperText, Text } from "react-native-paper";

import { Sheet } from "@/features/restaurant/components/Sheet";
import { formatMoney } from "@/features/restaurant/format";
import { describeModifiers, modifierSelectionError, toggleModifier } from "@/features/restaurant/logic/modifierSelections";
import type { ModifierGroupDTO, SelectedModifier } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/** Choose an item's options (spice level, extras…) within each group's min/max. */
export function ModifierPickerSheet({
  itemName,
  groups,
  currency,
  precision,
  onConfirm,
  onClose,
}: {
  itemName: string;
  groups: ModifierGroupDTO[];
  currency: string;
  precision: number;
  onConfirm: (choices: SelectedModifier[]) => void;
  onClose: () => void;
}) {
  const { palette } = useAppearance();
  const [selected, setSelected] = useState<{ group: string; option: string }[]>([]);
  const error = modifierSelectionError(groups, selected);
  const choices = describeModifiers(groups, selected);
  const extra = choices.reduce((sum, choice) => sum + choice.extra_rate, 0);

  return (
    <Sheet
      description="Choices apply to each unit. Extra prices are estimates; the bill shows the final amounts."
      footer={
        <View style={styles.footer}>
          <Text style={[styles.extra, { color: palette.onSurfaceMuted }]}>Extras {formatMoney(extra, currency, precision)}</Text>
          <Button disabled={Boolean(error)} mode="contained" onPress={() => onConfirm(choices)}>
            Add to order
          </Button>
        </View>
      }
      onClose={onClose}
      title={itemName}
      visible
    >
      {groups.map((group) => {
        const count = selected.filter((choice) => choice.group === group.name).length;
        return (
          <View key={group.name} style={styles.group}>
            <Text style={[styles.groupTitle, { color: palette.onSurface }]}>{group.label}</Text>
            <Text style={[styles.rule, { color: palette.onSurfaceMuted }]}>
              {group.min_selections ? "Required" : "Optional"} · choose{" "}
              {group.min_selections === group.max_selections
                ? group.max_selections
                : `${group.min_selections}–${group.max_selections}`}
            </Text>
            {group.options.map((option) => {
              const checked = selected.some((choice) => choice.group === group.name && choice.option === option.name);
              const full = !checked && group.max_selections > 1 && count >= group.max_selections;
              const disabled = (!option.available && !checked) || full;
              return (
                <Pressable
                  accessibilityRole={group.max_selections === 1 ? "radio" : "checkbox"}
                  accessibilityState={{ checked, disabled }}
                  disabled={disabled}
                  key={option.name}
                  onPress={() => setSelected((current) => toggleModifier(groups, current, group.name, option.name))}
                  style={[
                    styles.option,
                    { borderColor: checked ? palette.primary : palette.border, backgroundColor: palette.surface },
                    disabled && { opacity: 0.45 },
                  ]}
                >
                  <MaterialCommunityIcons
                    color={checked ? palette.primary : palette.onSurfaceMuted}
                    name={
                      group.max_selections === 1
                        ? checked
                          ? "radiobox-marked"
                          : "radiobox-blank"
                        : checked
                          ? "checkbox-marked"
                          : "checkbox-blank-outline"
                    }
                    size={20}
                  />
                  <Text style={[styles.optionLabel, { color: palette.onSurface }]}>
                    {option.label}
                    {!option.available ? " · Unavailable" : ""}
                  </Text>
                  {option.addon_item ? (
                    <Text style={[styles.rule, { color: palette.onSurfaceMuted }]}>
                      +{formatMoney(option.rate * option.addon_qty, currency, precision)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}
      {error && selected.length ? <HelperText type="info">{error}</HelperText> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  extra: { flex: 1, fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  footer: { alignItems: "center", flex: 1, flexDirection: "row", gap: spacing.sm },
  group: { gap: 6 },
  groupTitle: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
  option: { alignItems: "center", borderRadius: radii.md, borderWidth: 1.5, flexDirection: "row", gap: spacing.sm, minHeight: 46, paddingHorizontal: spacing.sm },
  optionLabel: { flex: 1, fontFamily: typography.fontFamily.regular, fontSize: typography.size.body },
  rule: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
});
