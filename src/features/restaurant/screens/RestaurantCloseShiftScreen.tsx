import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";

import { useToast } from "@/components/feedback/ToastProvider";
import { KeyboardAwareFormScroll } from "@/components/layout/KeyboardAwareFormScroll";
import { closeShift, getClosingPreview } from "@/features/restaurant/api/restaurantApi";
import { restaurantErrorMessage } from "@/features/restaurant/api/restaurantClient";
import { RestaurantPlaceholder } from "@/features/restaurant/components/RestaurantPlaceholder";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { formatMoney } from "@/features/restaurant/format";
import { usePolledResource } from "@/features/restaurant/hooks/usePolledResource";
import { parseOpeningAmount } from "@/features/restaurant/logic/shift";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/** Count the drawer per payment mode and close the user's own POS shift. */
export function RestaurantCloseShiftScreen() {
  const { palette } = useAppearance();
  const toast = useToast();
  const restaurant = useRestaurant();
  const fetcher = useCallback(() => getClosingPreview(restaurant.connection, restaurant.posProfile), [restaurant.connection, restaurant.posProfile]);
  const preview = usePolledResource(`closing:${restaurant.posProfile}`, fetcher, { intervalMs: 0 });
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = (value: number) => formatMoney(value, restaurant.currency, restaurant.currencyPrecision);

  if (!restaurant.needsShift) {
    return <RestaurantPlaceholder icon="cash-register" title="No shift to close" description="Kitchen staff work without a POS shift." />;
  }
  if (!preview.data) {
    return preview.error ? (
      <RestaurantPlaceholder description={preview.error} icon="alert-circle-outline" title="Closing summary unavailable">
        <Button mode="contained" onPress={() => void preview.refresh()}>
          Try again
        </Button>
      </RestaurantPlaceholder>
    ) : (
      <RestaurantPlaceholder icon="cash-register" title="Loading your shift" />
    );
  }
  const data = preview.data;

  function balances() {
    const rows = [];
    for (const payment of data.payments) {
      const raw = counted[payment.mode_of_payment];
      const amount = raw === undefined || raw === "" ? payment.expected_amount : parseOpeningAmount(raw);
      if (amount === null) return { invalid: payment.mode_of_payment };
      rows.push({ mode_of_payment: payment.mode_of_payment, closing_amount: amount });
    }
    return { rows };
  }

  async function close() {
    const result = balances();
    if ("invalid" in result) {
      setError(`Enter a valid counted amount for ${result.invalid}.`);
      return;
    }
    setClosing(true);
    setError(null);
    try {
      const closed = await closeShift(restaurant.connection, { pos_profile: restaurant.posProfile, closing_balances: result.rows });
      toast.success(`Shift closed (${closed.name}).`);
      // The refreshed bootstrap no longer has an open shift, so the gate returns.
      await restaurant.reload();
      router.navigate("/(restaurant)/more");
    } catch (caught) {
      setError(restaurantErrorMessage(caught, "Could not close your shift."));
    } finally {
      setClosing(false);
    }
  }

  return (
    <KeyboardAwareFormScroll contentContainerStyle={styles.content} style={{ backgroundColor: palette.background }}>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.onSurface }]}>Close your shift</Text>
        <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>
          {data.opening_entry} · since {data.period_start_date}
        </Text>
        <Row label="Invoices" value={String(data.invoice_count)} />
        <Row label="Sales" value={money(data.grand_total)} />
      </View>
      {data.payments.map((payment) => {
        const raw = counted[payment.mode_of_payment];
        const amount = raw === undefined || raw === "" ? payment.expected_amount : parseOpeningAmount(raw) ?? 0;
        const difference = amount - payment.expected_amount;
        return (
          <View key={payment.mode_of_payment} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.mode, { color: palette.onSurface }]}>{payment.mode_of_payment}</Text>
            <Row label="Opening" value={money(payment.opening_amount)} />
            <Row label="Expected" value={money(payment.expected_amount)} />
            <TextInput
              dense
              disabled={closing}
              keyboardType="decimal-pad"
              label="Counted"
              mode="outlined"
              onChangeText={(value) => setCounted((current) => ({ ...current, [payment.mode_of_payment]: value }))}
              placeholder={String(payment.expected_amount)}
              right={<TextInput.Affix text={restaurant.currency} />}
              value={raw ?? ""}
            />
            {Math.abs(difference) > 0.0001 ? (
              <Text style={[styles.meta, { color: palette.warning }]}>
                {difference > 0 ? "Over" : "Short"} by {money(Math.abs(difference))}
              </Text>
            ) : null}
          </View>
        );
      })}
      {error ? <HelperText type="error">{error}</HelperText> : null}
      <Button
        disabled={closing}
        loading={closing}
        mode="contained"
        onPress={() =>
          Alert.alert("Close your shift?", "You will need to open a new shift to take more orders.", [
            { style: "cancel", text: "Not yet" },
            { onPress: () => void close(), text: "Close shift" },
          ])
        }
      >
        Close shift
      </Button>
      <Button disabled={closing} onPress={() => router.navigate("/(restaurant)/more")}>
        Back
      </Button>
    </KeyboardAwareFormScroll>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { palette } = useAppearance();
  return (
    <View style={styles.row}>
      <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>{label}</Text>
      <Text style={[styles.meta, { color: palette.onSurface }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, gap: 6, padding: spacing.md },
  content: { gap: spacing.sm, padding: spacing.md },
  meta: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  mode: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
  row: { flexDirection: "row", justifyContent: "space-between" },
  title: { fontFamily: typography.fontFamily.semibold, fontSize: 18 },
});
