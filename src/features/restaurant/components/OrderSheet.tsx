import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { Button, IconButton, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatMoney } from "@/features/restaurant/format";
import { MAX_NOTE_LENGTH, type OrderDraft } from "@/features/restaurant/logic/orderDraft";
import type { InvoiceDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

type OrderSheetProps = {
  visible: boolean;
  draft: OrderDraft;
  /** The server's bill for exactly this round, or null while it is being checked. */
  invoice: InvoiceDTO | null;
  localSubtotal: number;
  currency: string;
  precision: number;
  title: string;
  busy: boolean;
  checking: boolean;
  readOnly: boolean;
  onClose: () => void;
  onQty: (lineId: string, qty: number) => void;
  onNote: (lineId: string, note: string) => void;
  onRemove: (lineId: string) => void;
  onOrderNote: (note: string) => void;
  onClear: () => void;
  onPlace: () => void;
};

/** The round being taken: lines waiting to be sent, their notes, and the running bill. */
export function OrderSheet({
  visible,
  draft,
  invoice,
  localSubtotal,
  currency,
  precision,
  title,
  busy,
  checking,
  readOnly,
  onClose,
  onQty,
  onNote,
  onRemove,
  onOrderNote,
  onClear,
  onPlace,
}: OrderSheetProps) {
  const { palette } = useAppearance();
  const locked = readOnly || busy;
  const money = (value: number | undefined) => formatMoney(value, currency, precision);
  const taxes = (invoice?.taxes ?? []).filter((row) => Number(row.tax_amount || 0) !== 0);

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView edges={["top", "bottom"]} style={[styles.root, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: palette.onSurface }]}>New items</Text>
            <Text style={[styles.subtitle, { color: palette.onSurfaceMuted }]}>{title}</Text>
          </View>
          {draft.unsent.length && !locked ? (
            <Button compact mode="text" onPress={onClear} textColor={palette.error}>
              Clear
            </Button>
          ) : null}
          <IconButton accessibilityLabel="Close" icon="close" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {draft.unsent.length ? (
            draft.unsent.map((line) => (
              <View key={line.line_id} style={[styles.line, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={styles.lineTop}>
                  <View style={styles.lineName}>
                    <Text style={[styles.itemName, { color: palette.onSurface }]}>{line.item_name}</Text>
                    {line.modifiers?.length ? (
                      <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>
                        {line.modifiers.map((choice) => choice.label).join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.stepper}>
                    <IconButton
                      accessibilityLabel={`Remove one ${line.item_name}`}
                      disabled={locked}
                      icon={line.qty > 1 ? "minus" : "delete-outline"}
                      iconColor={line.qty > 1 ? undefined : palette.error}
                      mode="outlined"
                      onPress={() => (line.qty > 1 ? onQty(line.line_id, line.qty - 1) : onRemove(line.line_id))}
                      size={16}
                    />
                    <Text style={[styles.qty, { color: palette.onSurface }]}>{line.qty}</Text>
                    <IconButton
                      accessibilityLabel={`Add one ${line.item_name}`}
                      disabled={locked}
                      icon="plus"
                      mode="outlined"
                      onPress={() => onQty(line.line_id, line.qty + 1)}
                      size={16}
                    />
                  </View>
                </View>
                <TextInput
                  dense
                  disabled={locked}
                  label="Note for the kitchen"
                  maxLength={MAX_NOTE_LENGTH}
                  mode="outlined"
                  onChangeText={(value) => onNote(line.line_id, value)}
                  value={line.note}
                />
              </View>
            ))
          ) : (
            <View style={styles.empty}>
              <MaterialCommunityIcons color={palette.onSurfaceMuted} name="silverware-fork-knife" size={32} />
              <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>Tap menu items to add them to this order.</Text>
            </View>
          )}
          {draft.unsent.length ? (
            <TextInput
              disabled={locked}
              label="Order note"
              maxLength={MAX_NOTE_LENGTH}
              mode="outlined"
              multiline
              onChangeText={onOrderNote}
              value={draft.headerEdits.order_note ?? draft.header.order_note}
            />
          ) : null}
        </ScrollView>
        {draft.unsent.length ? (
          <View style={[styles.footer, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
            {invoice ? (
              <>
                <Row label="Subtotal" value={money(invoice.totals.net_total)} />
                {taxes.map((row, index) => (
                  <Row key={`${row.description}-${index}`} label={row.description || "Tax"} value={money(row.tax_amount)} />
                ))}
                <Row bold label="Total" value={money(invoice.totals.rounded_total || invoice.totals.grand_total)} />
              </>
            ) : (
              <Row label={checking ? "Checking prices…" : "Estimated subtotal"} value={money(localSubtotal)} />
            )}
            <Button
              disabled={locked || checking}
              icon="send"
              loading={busy}
              mode="contained"
              onPress={onPlace}
              style={styles.place}
            >
              Place order
            </Button>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const { palette } = useAppearance();
  const style = { color: palette.onSurface, fontFamily: bold ? typography.fontFamily.semibold : typography.fontFamily.regular };
  return (
    <View style={styles.row}>
      <Text style={[styles.rowText, style]}>{label}</Text>
      <Text style={[styles.rowText, style]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, padding: spacing.md },
  empty: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xxxl },
  footer: { borderTopWidth: 1, gap: 4, padding: spacing.md },
  header: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row", paddingLeft: spacing.md },
  headerText: { flex: 1 },
  itemName: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
  line: { borderRadius: radii.lg, borderWidth: 1, gap: spacing.xs, padding: spacing.sm },
  lineName: { flex: 1, gap: 2 },
  lineTop: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  meta: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  place: { marginTop: spacing.xs },
  qty: { fontFamily: typography.fontFamily.semibold, fontSize: 16, minWidth: 22, textAlign: "center" },
  root: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowText: { fontSize: typography.size.body },
  stepper: { alignItems: "center", flexDirection: "row" },
  subtitle: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  title: { fontFamily: typography.fontFamily.semibold, fontSize: 18 },
});
