import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";

import { useToast } from "@/components/feedback/ToastProvider";
import { KeyboardAwareFormScroll } from "@/components/layout/KeyboardAwareFormScroll";
import { useAppSession } from "@/features/auth/AppSessionProvider";
import { openShift } from "@/features/restaurant/api/restaurantApi";
import { restaurantErrorMessage } from "@/features/restaurant/api/restaurantClient";
import { RestaurantPlaceholder } from "@/features/restaurant/components/RestaurantPlaceholder";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { openingBalances, shiftGateState } from "@/features/restaurant/logic/shift";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/** Waiters, cashiers and managers open their own POS shift before they reach the floor. */
export function RestaurantShiftGate() {
  const { palette } = useAppearance();
  const toast = useToast();
  const { signOut } = useAppSession();
  const restaurant = useRestaurant();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const state = shiftGateState(restaurant.shift);
  const modes = restaurant.paymentModes.map((mode) => mode.mode_of_payment);

  const signOutButton = (
    <Button mode="text" onPress={() => void signOut()} textColor={palette.onSurfaceMuted}>
      Sign out
    </Button>
  );

  if (state.kind !== "open-required") {
    const copy =
      state.kind === "closing"
        ? ["Shift closing in progress", "ERPNext is consolidating your last shift. Try again when it completes."]
        : state.kind === "closing-failed"
          ? ["Shift closing needs attention", `Closing entry ${state.closingEntry ?? ""} needs a supervisor review first.`]
          : ["Shift unavailable", "Your POS shift could not be verified. Refresh and try again."];
    return (
      <RestaurantPlaceholder icon="cash-register" title={copy[0]} description={copy[1]}>
        <Button mode="contained" onPress={() => void restaurant.reload()} style={styles.retry}>
          Refresh
        </Button>
        {signOutButton}
      </RestaurantPlaceholder>
    );
  }

  async function open() {
    if (opening) return;
    const result = openingBalances(modes, amounts);
    if ("invalidMode" in result) {
      setError(`Enter a valid opening balance for ${result.invalidMode}.`);
      return;
    }
    setError(null);
    setOpening(true);
    try {
      await openShift(restaurant.connection, {
        pos_profile: restaurant.posProfile,
        opening_balance: result.balances,
      });
      toast.success("Shift opened.");
      // The refreshed bootstrap carries the open session and lifts the gate.
      await restaurant.reload();
    } catch (caught) {
      setError(restaurantErrorMessage(caught, "Could not open your shift."));
    } finally {
      setOpening(false);
    }
  }

  return (
    <KeyboardAwareFormScroll contentContainerStyle={styles.content} style={{ backgroundColor: palette.background }}>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.onSurface }]}>Open your shift</Text>
        <Text style={[styles.body, { color: palette.onSurfaceMuted }]}>
          Enter the cash and other balances you start with on {restaurant.posProfile}. Leave a field blank for zero.
        </Text>
        {modes.length ? (
          modes.map((mode) => (
            <TextInput
              accessibilityLabel={`${mode} opening balance`}
              disabled={opening}
              key={mode}
              keyboardType="decimal-pad"
              label={mode}
              mode="outlined"
              onChangeText={(value) => setAmounts((current) => ({ ...current, [mode]: value }))}
              placeholder="0.00"
              right={<TextInput.Affix text={restaurant.currency} />}
              value={amounts[mode] ?? ""}
            />
          ))
        ) : (
          <Text style={[styles.body, { color: palette.error }]}>
            This POS Profile has no payment modes. Ask an administrator to add them before opening a shift.
          </Text>
        )}
        {error ? <HelperText type="error">{error}</HelperText> : null}
        <Button disabled={opening || !modes.length} loading={opening} mode="contained" onPress={() => void open()}>
          Open shift
        </Button>
      </View>
      {signOutButton}
    </KeyboardAwareFormScroll>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.body, lineHeight: typography.lineHeight.body },
  card: { borderRadius: radii.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  content: { gap: spacing.md, padding: spacing.md },
  retry: { marginTop: spacing.sm },
  title: { fontFamily: typography.fontFamily.semibold, fontSize: 18 },
});
