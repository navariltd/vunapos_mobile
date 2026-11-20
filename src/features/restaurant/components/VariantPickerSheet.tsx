import { Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import { Sheet } from "@/features/restaurant/components/Sheet";
import { formatMoney } from "@/features/restaurant/format";
import type { TemplateVariantDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/** Pick one variant of a template item (size, flavour…), limited to what this menu sells. */
export function VariantPickerSheet({
  itemName,
  variants,
  loading,
  error,
  currency,
  precision,
  onPick,
  onClose,
}: {
  itemName: string;
  variants: TemplateVariantDTO[];
  loading: boolean;
  error: string | null;
  currency: string;
  precision: number;
  onPick: (variant: TemplateVariantDTO) => void;
  onClose: () => void;
}) {
  const { palette } = useAppearance();
  return (
    <Sheet description="Choose an option." onClose={onClose} title={itemName} visible>
      {loading ? <ActivityIndicator style={styles.loading} /> : null}
      {error ? <Text style={{ color: palette.error }}>{error}</Text> : null}
      {!loading && !error && !variants.length ? (
        <Text style={{ color: palette.onSurfaceMuted }}>No options of this item are on the menu here.</Text>
      ) : null}
      {variants.map((variant) => {
        const paused = Boolean(variant.ordering_paused);
        const attributes = (variant.attributes ?? []).map((row) => row.attribute_value).join(" · ");
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: paused }}
            disabled={paused}
            key={variant.item_code}
            onPress={() => onPick(variant)}
            style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }, paused && { opacity: 0.45 }]}
          >
            <View style={styles.text}>
              <Text style={[styles.name, { color: palette.onSurface }]}>{attributes || variant.item_name}</Text>
              {paused ? (
                <Text style={[styles.meta, { color: palette.error }]}>{variant.availability_reason || "Not available now"}</Text>
              ) : attributes ? (
                <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>{variant.item_name}</Text>
              ) : null}
            </View>
            <Text style={[styles.name, { color: palette.onSurface }]}>{formatMoney(variant.rate, currency, precision)}</Text>
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  loading: { padding: spacing.lg },
  meta: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  name: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
  row: { alignItems: "center", borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 52, padding: spacing.sm },
  text: { flex: 1, gap: 2 },
});
