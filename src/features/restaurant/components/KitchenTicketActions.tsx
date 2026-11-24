import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";

import { useToast } from "@/components/feedback/ToastProvider";
import { ManagerPinSheet } from "@/features/restaurant/components/ManagerPinSheet";
import { Sheet } from "@/features/restaurant/components/Sheet";
import {
  CANCEL_CONTROL,
  lineControl,
  type useKitchenActions,
} from "@/features/restaurant/hooks/useKitchenActions";
import { lineActions, routineKitchenActions } from "@/features/restaurant/logic/kitchenCommands";
import type { KitchenAction, KitchenTicketDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

const ROUTINE_LABELS: Partial<Record<KitchenAction, string>> = {
  Accept: "Accept",
  Start: "Start preparing",
  Ready: "Ready all",
  Serve: "Serve all",
};

type Actions = ReturnType<typeof useKitchenActions>;

/** The ticket's routine buttons (accept, start, ready all, serve all). */
export function KitchenRoutineButtons({ ticket, actions }: { ticket: KitchenTicketDTO; actions: Actions }) {
  const toast = useToast();
  const pending = actions.pending(ticket.name);
  // Only this ticket's own request disables its buttons; other tickets stay as they are.
  const running = actions.busyControl(ticket.name);
  const busy = running !== null;
  const routine = routineKitchenActions(ticket).filter((action) => ROUTINE_LABELS[action]);
  if (!routine.length && !pending) return null;

  async function run(action: KitchenAction) {
    const outcome = await actions.perform(ticket, action);
    if (outcome.ok) toast.success(outcome.message);
    else toast.error(outcome.message);
  }

  return (
    <View style={styles.buttons}>
      {pending ? (
        <Button compact disabled={busy} icon="refresh" loading={busy} mode="contained" onPress={() => void run(pending.action)}>
          Retry {ROUTINE_LABELS[pending.action] ?? pending.action}
        </Button>
      ) : (
        routine.map((action, index) => (
          <Button
            compact
            disabled={busy}
            key={action}
            loading={running === action}
            mode={index === 0 ? "contained" : "outlined"}
            onPress={() => void run(action)}
          >
            {ROUTINE_LABELS[action]}
          </Button>
        ))
      )}
    </View>
  );
}

/** Everything a station can do from the ticket sheet: routine, per-line quantities and cancel. */
export function KitchenTicketActions({
  ticket,
  actions,
  onClose,
}: {
  ticket: KitchenTicketDTO;
  actions: Actions;
  onClose: () => void;
}) {
  const { palette } = useAppearance();
  const toast = useToast();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const running = actions.busyControl(ticket.name);
  const busy = running !== null;
  const lines = actions.pending(ticket.name) ? [] : lineActions(ticket);

  async function runLine(lineId: string, action: KitchenAction, maximum: number) {
    const key = lineControl(lineId, action);
    const qty = Number(amounts[key] || maximum);
    if (!Number.isFinite(qty) || qty <= 0 || qty > maximum) {
      toast.error(`Enter more than 0, up to ${maximum}.`);
      return;
    }
    const outcome = await actions.perform(ticket, action, { [lineId]: qty }, key);
    if (outcome.ok) {
      setAmounts((current) => ({ ...current, [key]: "" }));
      toast.success(outcome.message);
    } else toast.error(outcome.message);
  }

  async function cancel(token?: string) {
    const outcome = await actions.cancelOrder(ticket, reason, token);
    if (outcome.ok) {
      setCancelOpen(false);
      setPinOpen(false);
      toast.info(outcome.message);
      onClose();
    } else toast.error(outcome.message);
  }

  return (
    <View style={styles.section}>
      <KitchenRoutineButtons actions={actions} ticket={ticket} />
      {lines.map(({ line, action, maximum }) => {
        const key = lineControl(line.line_id, action);
        return (
          <View key={key} style={[styles.lineAction, { borderColor: palette.border }]}>
            <Text numberOfLines={1} style={[styles.lineName, { color: palette.onSurface }]}>
              {line.item_name}
            </Text>
            <TextInput
              accessibilityLabel={`${line.item_name} ${action === "Ready" ? "ready" : "served"} quantity`}
              dense
              disabled={busy}
              keyboardType="decimal-pad"
              mode="outlined"
              onChangeText={(value) => setAmounts((current) => ({ ...current, [key]: value }))}
              right={<TextInput.Affix text={`/ ${maximum}`} />}
              style={styles.qtyInput}
              value={amounts[key] || String(maximum)}
            />
            <Button
              compact
              disabled={busy}
              loading={running === key}
              mode="outlined"
              onPress={() => void runLine(line.line_id, action, maximum)}
            >
              {action === "Ready" ? "Ready" : "Served"}
            </Button>
          </View>
        );
      })}
      {ticket.can_cancel_order ? (
        <Button compact disabled={busy} icon="cancel" mode="text" onPress={() => setCancelOpen(true)} textColor={palette.error}>
          Cancel order
        </Button>
      ) : null}
      {cancelOpen ? (
        <Sheet
          description="Unprepared items are cancelled. Explain why for the record."
          footer={
            <>
              <Button onPress={() => setCancelOpen(false)}>Back</Button>
              <Button
                buttonColor={palette.error}
                disabled={!reason.trim() || busy}
                loading={running === CANCEL_CONTROL}
                mode="contained"
                onPress={() => (ticket.requires_cancel_pin ? setPinOpen(true) : void cancel())}
              >
                Cancel order
              </Button>
            </>
          }
          onClose={() => setCancelOpen(false)}
          title={`Cancel ${ticket.sales_order}`}
          visible
        >
          <TextInput label="Reason" mode="outlined" multiline onChangeText={setReason} value={reason} />
          {/* The server already exempts managers when it sets this flag. */}
          {ticket.requires_cancel_pin ? (
            <HelperText type="info">A manager PIN is required to cancel.</HelperText>
          ) : null}
        </Sheet>
      ) : null}
      {pinOpen ? (
        <ManagerPinSheet
          action="order_cancel"
          description="A manager approves cancelling this order."
          onApproved={(token) => void cancel(token)}
          onClose={() => setPinOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  lineAction: { alignItems: "center", borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: spacing.xs, padding: spacing.xs },
  lineName: { flex: 1, fontFamily: typography.fontFamily.medium, fontSize: typography.size.small },
  qtyInput: { width: 104 },
  section: { gap: spacing.xs, marginTop: spacing.xs },
});
