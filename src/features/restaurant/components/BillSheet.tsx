import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, HelperText, IconButton, Switch, Text, TextInput } from "react-native-paper";

import { checkoutSession, getSession, previewSessionBill } from "@/features/restaurant/api/restaurantApi";
import { restaurantErrorCode, restaurantErrorMessage } from "@/features/restaurant/api/restaurantClient";
import { ChipRow } from "@/features/restaurant/components/ChipRow";
import { Sheet } from "@/features/restaurant/components/Sheet";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { formatMoney } from "@/features/restaurant/format";
import { usePolledResource } from "@/features/restaurant/hooks/usePolledResource";
import {
  initialPaymentRows,
  manualPaymentModes,
  summarizePayments,
  todayIso,
  type PaymentRow,
} from "@/features/restaurant/logic/payments";
import type { RestaurantSessionDTO, SessionBillDTO, SessionSettlementDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/**
 * The visit's bill across all its rounds (service charge and taxes included).
 * Everyone can review it; a cashier with payment rights checks out from here.
 * Previewing never creates an invoice or releases tables.
 */
export function BillSheet({
  session,
  onSettled,
  onClose,
}: {
  session: RestaurantSessionDTO;
  onSettled: (settlement: SessionSettlementDTO) => void;
  onClose: () => void;
}) {
  const { palette } = useAppearance();
  const restaurant = useRestaurant();
  const fetcher = useCallback(
    () => previewSessionBill(restaurant.connection, { session: session.name, pos_profile: restaurant.posProfile }),
    [restaurant.connection, restaurant.posProfile, session.name],
  );
  const preview = usePolledResource(`bill:${session.name}`, fetcher, { intervalMs: 0 });
  const [paying, setPaying] = useState(false);
  const bill = preview.data;
  const currency = session.currency || restaurant.currency;
  const precision = restaurant.currencyPrecision;
  const money = (value: number | undefined) => formatMoney(value, currency, precision);

  if (!bill) {
    return (
      <Sheet onClose={onClose} title="Bill" visible>
        {preview.error ? (
          <>
            <Text style={{ color: palette.error }}>{preview.error}</Text>
            <Button onPress={() => void preview.refresh()}>Try again</Button>
          </>
        ) : (
          <ActivityIndicator style={styles.loading} />
        )}
      </Sheet>
    );
  }

  if (paying) {
    return (
      <PaymentStep
        bill={bill}
        currency={currency}
        onBack={() => setPaying(false)}
        onBillChanged={() => {
          setPaying(false);
          void preview.refresh();
        }}
        onClose={onClose}
        onSettled={onSettled}
        precision={precision}
      />
    );
  }

  const invoice = bill.invoice;
  const total = invoice.totals.rounded_total || invoice.totals.grand_total || 0;
  const taxes = (invoice.taxes ?? []).filter((row) => Number(row.tax_amount || 0) !== 0);
  const gatewayPending = (bill.gateway_links ?? []).length > 0;

  return (
    <Sheet
      description={`${session.name} · ${session.customer_name}`}
      footer={
        <>
          <Button icon="refresh" onPress={() => void preview.refresh()}>
            Refresh
          </Button>
          {restaurant.canTakePayment ? (
            <Button
              disabled={bill.can_checkout === false || gatewayPending || !restaurant.shiftReady}
              icon="cash-register"
              mode="contained"
              onPress={() => setPaying(true)}
            >
              Checkout
            </Button>
          ) : null}
        </>
      }
      onClose={onClose}
      title="Bill"
      visible
    >
      {invoice.items.map((line, index) => (
        <View key={`${line.item_code}-${index}`} style={styles.row}>
          <Text style={[styles.qty, { color: palette.onSurface }]}>{line.qty}×</Text>
          <Text style={[styles.item, { color: palette.onSurface }]}>{line.item_name || line.item_code}</Text>
          <Text style={[styles.amount, { color: palette.onSurface }]}>{money(line.amount)}</Text>
        </View>
      ))}
      <View style={[styles.totals, { borderTopColor: palette.border }]}>
        <TotalRow label="Subtotal" value={money(invoice.totals.net_total)} />
        {taxes.map((row, index) => (
          <TotalRow key={`${row.description}-${index}`} label={row.description || "Tax"} value={money(row.tax_amount)} />
        ))}
        <TotalRow bold label="Total" value={money(total)} />
      </View>
      {bill.checkout_block_reason ? (
        <Text style={[styles.notice, { backgroundColor: palette.warningSurface, color: palette.warning }]}>{bill.checkout_block_reason}</Text>
      ) : null}
      {bill.will_complete_preparation ? (
        <Text style={[styles.notice, { backgroundColor: palette.surfaceContainer, color: palette.onSurface }]}>
          Checking out completes the kitchen preparation still pending on this visit.
        </Text>
      ) : null}
      {gatewayPending ? (
        <Text style={[styles.notice, { backgroundColor: palette.warningSurface, color: palette.warning }]}>
          This visit has a mobile-money payment in progress. Finish it on the web POS before checking out here.
        </Text>
      ) : null}
      {restaurant.canTakePayment && !restaurant.shiftReady ? (
        <HelperText type="error">Open your shift before taking payment.</HelperText>
      ) : null}
      {!restaurant.canTakePayment ? (
        <HelperText type="info">Show this bill to the guest. A cashier takes the payment.</HelperText>
      ) : null}
    </Sheet>
  );
}

function PaymentStep({
  bill,
  currency,
  precision,
  onBack,
  onBillChanged,
  onSettled,
  onClose,
}: {
  bill: SessionBillDTO;
  currency: string;
  precision: number;
  onBack: () => void;
  onBillChanged: () => void;
  onSettled: (settlement: SessionSettlementDTO) => void;
  onClose: () => void;
}) {
  const { palette } = useAppearance();
  const restaurant = useRestaurant();
  const total = bill.invoice.totals.rounded_total || bill.invoice.totals.grand_total || 0;
  const modes = manualPaymentModes(restaurant.paymentModes);
  const [rows, setRows] = useState<PaymentRow[]>(() => initialPaymentRows(restaurant.paymentModes, total, todayIso()));
  const [creditSale, setCreditSale] = useState(false);
  const [dueDate, setDueDate] = useState(todayIso());
  const [taxId, setTaxId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summary = summarizePayments(rows, restaurant.paymentModes, {
    total,
    precision,
    allowPartial: Boolean(restaurant.profile.allow_partial_payment),
    isCreditSale: creditSale,
  });
  const money = (value: number) => formatMoney(value, currency, precision);

  function updateRow(index: number, patch: Partial<PaymentRow>) {
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  function addMode(mode: string) {
    setRows((current) => [...current, { mode, amount: summary.remaining ? String(summary.remaining) : "", reference_no: "", reference_date: todayIso() }]);
  }

  async function submit() {
    if (summary.error || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // The fingerprint ties payment to the reviewed bill; retrying with it never charges twice.
      const settlement = await checkoutSession(restaurant.connection, {
        session: bill.session.name,
        pos_profile: restaurant.posProfile,
        fingerprint: bill.fingerprint,
        payments: summary.payments,
        is_credit_sale: creditSale || undefined,
        due_date: creditSale ? dueDate : undefined,
        tax_id: taxId.trim() || undefined,
      });
      onSettled(settlement);
    } catch (caught) {
      const code = restaurantErrorCode(caught);
      if (code === "SESSION_BILL_CHANGED") {
        onBillChanged();
        return;
      }
      if (code === "SESSION_NOT_OPEN") {
        // An earlier attempt may have gone through before the connection dropped.
        const latest = await getSession(restaurant.connection, bill.session.name).catch(() => null);
        if (latest?.billing_invoice && latest.billing_doctype) {
          onSettled({
            session: latest,
            invoice: { ...bill.invoice, doctype: latest.billing_doctype, name: latest.billing_invoice },
          });
          return;
        }
      }
      setError(restaurantErrorMessage(caught, "Checkout failed. You can retry safely."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      description={`Total ${money(total)}`}
      footer={
        <>
          <Button disabled={submitting} onPress={onBack}>
            Back
          </Button>
          <Button disabled={Boolean(summary.error)} icon="check" loading={submitting} mode="contained" onPress={() => void submit()}>
            Confirm payment
          </Button>
        </>
      }
      onClose={submitting ? () => undefined : onClose}
      title="Take payment"
      visible
    >
      {rows.map((row, index) => {
        const mode = modes.find((entry) => entry.mode_of_payment === row.mode);
        return (
          <View key={`${row.mode}-${index}`} style={[styles.payment, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.paymentHeader}>
              <Text style={[styles.item, { color: palette.onSurface }]}>{row.mode}</Text>
              {rows.length > 1 ? (
                <IconButton
                  accessibilityLabel={`Remove ${row.mode}`}
                  icon="close"
                  onPress={() => setRows((current) => current.filter((_, position) => position !== index))}
                  size={16}
                />
              ) : null}
            </View>
            <TextInput
              dense
              keyboardType="decimal-pad"
              label="Amount"
              mode="outlined"
              onChangeText={(amount) => updateRow(index, { amount })}
              right={<TextInput.Affix text={currency} />}
              value={row.amount}
            />
            {mode?.requires_reference ? (
              <View style={styles.reference}>
                <TextInput
                  autoCapitalize="characters"
                  dense
                  label="Transaction code"
                  mode="outlined"
                  onChangeText={(reference_no) => updateRow(index, { reference_no })}
                  style={styles.flex}
                  value={row.reference_no}
                />
                <TextInput
                  dense
                  label="Date (YYYY-MM-DD)"
                  mode="outlined"
                  onChangeText={(reference_date) => updateRow(index, { reference_date })}
                  style={styles.flex}
                  value={row.reference_date}
                />
              </View>
            ) : null}
          </View>
        );
      })}
      {modes.length > 1 ? (
        <ChipRow
          accessibilityLabel="Add a payment mode"
          activeKey={null}
          chips={modes.map((mode) => ({ key: mode.mode_of_payment, label: `+ ${mode.mode_of_payment}` }))}
          onChange={addMode}
        />
      ) : null}
      {!modes.length ? (
        <Text style={{ color: palette.error }}>This POS Profile has no payment modes the mobile till can take.</Text>
      ) : null}
      <View style={[styles.totals, { borderTopColor: palette.border }]}>
        <TotalRow label="Paid" value={money(summary.paid)} />
        {summary.change ? <TotalRow bold label="Change" value={money(summary.change)} /> : null}
        {summary.remaining ? <TotalRow label="Remaining" value={money(summary.remaining)} /> : null}
      </View>
      {restaurant.profile.allow_credit_sales ? (
        <View style={styles.switchRow}>
          <Text style={[styles.item, { color: palette.onSurface }]}>Credit sale (pay later)</Text>
          <Switch onValueChange={setCreditSale} value={creditSale} />
        </View>
      ) : null}
      {creditSale ? <TextInput dense label="Due date (YYYY-MM-DD)" mode="outlined" onChangeText={setDueDate} value={dueDate} /> : null}
      <TextInput dense label="Customer tax ID (optional)" mode="outlined" onChangeText={setTaxId} value={taxId} />
      {summary.error && rows.some((row) => row.amount.trim()) ? <HelperText type="info">{summary.error}</HelperText> : null}
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </Sheet>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const { palette } = useAppearance();
  const font = bold ? typography.fontFamily.semibold : typography.fontFamily.regular;
  return (
    <View style={styles.totalRow}>
      <Text style={{ color: palette.onSurface, fontFamily: font }}>{label}</Text>
      <Text style={{ color: palette.onSurface, fontFamily: font }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  amount: { fontFamily: typography.fontFamily.medium, fontSize: typography.size.body },
  flex: { flex: 1 },
  item: { flex: 1, fontFamily: typography.fontFamily.medium, fontSize: typography.size.body },
  loading: { padding: spacing.lg },
  notice: { borderRadius: radii.md, overflow: "hidden", padding: spacing.sm },
  payment: { borderRadius: radii.lg, borderWidth: 1, gap: spacing.xs, padding: spacing.sm },
  paymentHeader: { alignItems: "center", flexDirection: "row" },
  qty: { fontFamily: typography.fontFamily.semibold, minWidth: 30 },
  reference: { flexDirection: "row", gap: spacing.xs },
  row: { flexDirection: "row", gap: spacing.xs },
  switchRow: { alignItems: "center", flexDirection: "row" },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totals: { borderTopWidth: 1, gap: 4, marginTop: spacing.xs, paddingTop: spacing.xs },
});
