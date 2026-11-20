import { Pressable, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

import { Sheet } from "@/features/restaurant/components/Sheet";
import { formatMoney } from "@/features/restaurant/format";
import { kitchenStatusTone } from "@/features/restaurant/theme";
import type { RestaurantSessionDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/** Everything placed on a visit, round by round, with each round's kitchen tickets. */
export function RoundsSheet({
  session,
  currency,
  precision,
  busy,
  canCancel,
  onAssignWaiter,
  onCancelVisit,
  onOpenTicket,
  onClose,
}: {
  session: RestaurantSessionDTO;
  currency: string;
  precision: number;
  busy: boolean;
  canCancel: boolean;
  onAssignWaiter: () => void;
  onCancelVisit: () => void;
  onOpenTicket: (ticket: string) => void;
  onClose: () => void;
}) {
  const { appearance, palette } = useAppearance();
  return (
    <Sheet
      description={`${session.name} · Waiter: ${session.waiter_name || session.waiter}`}
      footer={
        <>
          {session.available_waiters?.length ? (
            <Button disabled={busy} onPress={onAssignWaiter}>
              Assign waiter
            </Button>
          ) : null}
          {canCancel ? (
            <Button disabled={busy} onPress={onCancelVisit} textColor={palette.error}>
              Cancel visit
            </Button>
          ) : null}
        </>
      }
      onClose={onClose}
      title="Placed orders"
      visible
    >
      {!session.rounds.length ? <Text style={{ color: palette.onSurfaceMuted }}>Nothing has been placed yet.</Text> : null}
      {session.rounds.map((round, index) => {
        const tickets = (session.kitchen_tickets ?? []).filter((ticket) => ticket.sales_order === round.name);
        const cancelled = round.status === "Cancelled";
        return (
          <View key={round.name} style={[styles.round, { backgroundColor: palette.surface, borderColor: palette.border }, cancelled && { opacity: 0.55 }]}>
            <View style={styles.roundHeader}>
              <Text style={[styles.roundTitle, { color: palette.onSurface }]}>
                Round {index + 1}
                {cancelled ? " · Cancelled" : ""}
              </Text>
              {round.grand_total !== undefined ? (
                <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>{formatMoney(round.grand_total, currency, precision)}</Text>
              ) : null}
            </View>
            {round.items
              .filter((line) => !line.parent_line_id)
              .map((line) => (
                <View key={line.line_id} style={styles.line}>
                  <Text style={[styles.qty, { color: palette.onSurface }]}>{line.qty}×</Text>
                  <View style={styles.lineText}>
                    <Text style={[styles.item, { color: palette.onSurface }]}>{line.item_name}</Text>
                    {line.modifiers?.length ? (
                      <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>{line.modifiers.map((choice) => choice.label).join(" · ")}</Text>
                    ) : null}
                    {line.note ? <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>“{line.note}”</Text> : null}
                  </View>
                </View>
              ))}
            {tickets.length ? (
              <View style={styles.tickets}>
                {tickets.map((ticket) => {
                  const tone = kitchenStatusTone(ticket.status, appearance === "dark");
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={ticket.name}
                      onPress={() => onOpenTicket(ticket.name)}
                      style={[styles.ticket, { backgroundColor: tone.fill, borderColor: tone.stroke }]}
                    >
                      <Text style={[styles.ticketText, { color: palette.onSurface }]}>
                        {ticket.station_label} · {ticket.status}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  item: { fontFamily: typography.fontFamily.medium, fontSize: typography.size.body },
  line: { flexDirection: "row", gap: spacing.xs },
  lineText: { flex: 1 },
  meta: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  qty: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body, minWidth: 28 },
  round: { borderRadius: radii.lg, borderWidth: 1, gap: 6, padding: spacing.sm },
  roundHeader: { flexDirection: "row", justifyContent: "space-between" },
  roundTitle: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
  ticket: { borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  ticketText: { fontFamily: typography.fontFamily.medium, fontSize: typography.size.tiny },
  tickets: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
});
