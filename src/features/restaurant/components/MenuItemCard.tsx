import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import { formatMoney, hasOffer } from "@/features/restaurant/format";
import type { MenuItemDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

type MenuItemCardProps = {
  item: MenuItemDTO;
  imageUrl: string | null;
  currency: string;
  precision: number;
  /** How many are already on the order (sent and waiting). */
  quantity: number;
  /** Has modifier groups: tapping opens the picker. */
  customizable: boolean;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
};

/** One menu item: tap to add. Offers show the list price crossed out. */
export function MenuItemCard({
  item,
  imageUrl,
  currency,
  precision,
  quantity,
  customizable,
  busy,
  disabled,
  onPress,
}: MenuItemCardProps) {
  const { palette } = useAppearance();
  const paused = Boolean(item.ordering_paused);
  const variants = Boolean(item.has_variants);
  const blocked = disabled || paused;
  const note = paused
    ? item.availability_reason || "Not available now"
    : variants
      ? "Choose an option"
      : customizable
        ? "Customisable"
        : null;

  return (
    <Pressable
      accessibilityHint={paused ? "Not available now" : "Adds this item to the order"}
      accessibilityLabel={`${item.item_name}, ${formatMoney(item.rate, currency, precision)}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy }}
      disabled={blocked || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: palette.surface, borderColor: quantity ? palette.primary : palette.border },
        blocked && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {imageUrl ? (
        <Image resizeMode="cover" source={{ uri: imageUrl }} style={[styles.image, { backgroundColor: palette.surfaceContainer }]} />
      ) : null}
      <View style={styles.body}>
        <Text numberOfLines={2} style={[styles.name, { color: palette.onSurface }]}>
          {item.item_name}
        </Text>
        {note ? (
          <Text numberOfLines={1} style={[styles.note, { color: paused ? palette.error : palette.onSurfaceMuted }]}>
            {note}
          </Text>
        ) : null}
        <View style={styles.priceRow}>
          <View style={styles.prices}>
            <Text style={[styles.price, { color: palette.onSurface }]}>{formatMoney(item.rate, currency, precision)}</Text>
            {hasOffer(item) ? (
              <Text style={[styles.listPrice, { color: palette.onSurfaceMuted }]}>
                {formatMoney(item.price_list_rate, currency, precision)}
              </Text>
            ) : null}
          </View>
          <View style={[styles.add, { backgroundColor: blocked ? palette.disabled : palette.primary }]}>
            {busy ? (
              <ActivityIndicator color={palette.onPrimary} size={14} />
            ) : quantity ? (
              <Text style={[styles.quantity, { color: palette.onPrimary }]}>{quantity}</Text>
            ) : (
              <MaterialCommunityIcons color={palette.onPrimary} name="plus" size={18} />
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  add: { alignItems: "center", borderRadius: radii.md, height: 32, justifyContent: "center", minWidth: 32, paddingHorizontal: 6 },
  body: { flex: 1, gap: 4, padding: spacing.sm },
  card: { borderRadius: radii.lg, borderWidth: 1.5, flex: 1, overflow: "hidden" },
  image: { aspectRatio: 1.6, width: "100%" },
  listPrice: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.tiny, textDecorationLine: "line-through" },
  name: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body, lineHeight: 19 },
  note: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.tiny },
  price: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.small },
  priceRow: { alignItems: "flex-end", flexDirection: "row", gap: spacing.xs, justifyContent: "space-between", marginTop: "auto" },
  prices: { flex: 1 },
  quantity: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.small },
});
