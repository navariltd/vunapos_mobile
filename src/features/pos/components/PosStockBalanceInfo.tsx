import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet } from "react-native";
import { useState } from "react";
import { Text } from "react-native-paper";

import { formatStockBalanceDetails } from "@/features/pos/stockBalance";
import { PosCatalogueItem } from "@/features/pos/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

type Props = {
  item: Pick<
    PosCatalogueItem,
    "actual_qty" | "conversion_factor" | "stock_uom" | "uom"
  >;
};

/** Native equivalent of the SPA's hover stock-conversion tooltip. */
export function PosStockBalanceInfo({ item }: Props) {
  const { palette } = useAppearance();
  const [visible, setVisible] = useState(false);
  const details = formatStockBalanceDetails(item);
  if (!details) return null;

  return (
    <>
      <Pressable
        accessibilityHint="Shows stock quantity in the warehouse and selling units"
        accessibilityLabel="View stock balance details"
        hitSlop={8}
        onPress={(event) => {
          event.stopPropagation();
          setVisible(true);
        }}
        style={styles.trigger}
      >
        <MaterialCommunityIcons
          color={palette.onSurfaceMuted}
          name="information-outline"
          size={15}
        />
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <Pressable
          accessibilityLabel="Dismiss stock balance details"
          onPress={() => setVisible(false)}
          style={[styles.scrim, { backgroundColor: palette.scrim }]}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
            style={[styles.dialog, { backgroundColor: palette.surface }]}
          >
            <Text style={[styles.title, { color: palette.onSurface }]}>Stock balance</Text>
            <Text style={[styles.details, { color: palette.onSurfaceMuted }]}>
              {details}
            </Text>
            <Text style={[styles.dismiss, { color: palette.primary }]}>Tap outside to close</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  details: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  dialog: {
    borderRadius: radii.lg,
    gap: spacing.sm,
    maxWidth: 320,
    padding: spacing.lg,
    width: "86%",
  },
  dismiss: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.small,
    marginTop: spacing.xs,
  },
  scrim: { alignItems: "center", flex: 1, justifyContent: "center" },
  title: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
  trigger: { alignItems: "center", justifyContent: "center" },
});
