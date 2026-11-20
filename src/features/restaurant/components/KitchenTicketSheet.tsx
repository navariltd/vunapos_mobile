import { ReactNode, useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import { getKitchenTicket } from "@/features/restaurant/api/restaurantApi";
import { Sheet } from "@/features/restaurant/components/Sheet";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { usePolledResource } from "@/features/restaurant/hooks/usePolledResource";
import { kitchenStatusTone } from "@/features/restaurant/theme";
import type { KitchenTicketDTO, KitchenTicketItemDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

const quantity = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);

/** How far one line has got: "2 ready · 1 served of 3". */
export function lineProgress(line: KitchenTicketItemDTO): string | null {
  const parts: string[] = [];
  if (line.preparing_qty) parts.push(`${quantity(line.preparing_qty)} preparing`);
  if (line.ready_to_serve_qty) parts.push(`${quantity(line.ready_to_serve_qty)} ready`);
  if (line.served_qty) parts.push(`${quantity(line.served_qty)} served`);
  if (line.cancelled_qty) parts.push(`${quantity(line.cancelled_qty)} cancelled`);
  return parts.length ? `${parts.join(" · ")} of ${quantity(line.qty)}` : null;
}

/** One kitchen ticket (KOT), refreshed every 12 s: lines, progress and history. */
export function KitchenTicketSheet({
  name,
  onClose,
  renderActions,
}: {
  name: string;
  onClose: () => void;
  /** The kitchen board passes its action buttons; Sell shows the ticket read-only. */
  renderActions?: (ticket: KitchenTicketDTO, refresh: () => Promise<void>) => ReactNode;
}) {
  const { appearance, palette } = useAppearance();
  const { connection } = useRestaurant();
  const [linked, setLinked] = useState<string | null>(null);
  const active = linked ?? name;
  const fetcher = useCallback(() => getKitchenTicket(connection, active), [active, connection]);
  const result = usePolledResource(`kitchen-ticket:${active}`, fetcher);
  const ticket = result.data;
  const tone = ticket ? kitchenStatusTone(ticket.status, appearance === "dark") : null;

  return (
    <Sheet
      description={ticket ? `${ticket.station_label} · ${ticket.table_labels ? `Table ${ticket.table_labels} · ` : ""}${ticket.service_type ?? ""}` : "Kitchen ticket"}
      onClose={onClose}
      title={active}
      visible
    >
      {!ticket ? (
        result.error ? (
          <Text style={{ color: palette.error }}>{result.error}</Text>
        ) : (
          <ActivityIndicator style={styles.loading} />
        )
      ) : (
        <>
          <View style={styles.statusRow}>
            <View style={[styles.status, { backgroundColor: tone?.fill, borderColor: tone?.stroke }]}>
              <Text style={[styles.statusText, { color: palette.onSurface }]}>{ticket.status}</Text>
            </View>
            <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>
              Sent by {ticket.sent_by_name || ticket.sent_by}
              {ticket.waiter_name || ticket.waiter ? ` · Waiter ${ticket.waiter_name || ticket.waiter}` : ""}
            </Text>
          </View>
          {ticket.production_completed_at_billing ? (
            <Text style={[styles.notice, { backgroundColor: palette.warningSurface, color: palette.warning }]}>
              Billed before it was made: stock has already moved, so later steps only record progress.
            </Text>
          ) : null}
          {ticket.remake_of ? (
            <View style={[styles.notice, { backgroundColor: palette.surfaceContainer }]}>
              <Text style={[styles.item, { color: palette.onSurface }]}>Replacement — no extra charge</Text>
              {ticket.remake_reason ? <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>{ticket.remake_reason}</Text> : null}
              <Pressable onPress={() => setLinked(ticket.remake_of ?? null)}>
                <Text style={[styles.link, { color: palette.primary }]}>Original ticket: {ticket.remake_of}</Text>
              </Pressable>
            </View>
          ) : null}
          {linked && linked !== name ? (
            <Pressable onPress={() => setLinked(null)}>
              <Text style={[styles.link, { color: palette.primary }]}>Back to {name}</Text>
            </Pressable>
          ) : null}
          {ticket.order_note ? (
            <Text style={[styles.meta, { color: palette.onSurface }]}>Order note: “{ticket.order_note}”</Text>
          ) : null}
          {ticket.items
            .filter((line) => !line.parent_line_id)
            .map((line) => {
              const progress = lineProgress(line);
              const addons = ticket.items.filter((row) => row.parent_line_id === line.line_id);
              return (
                <View key={line.line_id} style={[styles.line, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text style={[styles.item, { color: palette.onSurface }]}>
                    {quantity(line.qty)} × {line.item_name}
                    {line.temporary_routing ? "  · routed for this round" : ""}
                  </Text>
                  {line.modifiers.length ? (
                    <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>{line.modifiers.map((row) => row.label).join(" · ")}</Text>
                  ) : null}
                  {addons.map((row) => (
                    <Text key={row.line_id} style={[styles.meta, { color: palette.onSurfaceMuted }]}>
                      + {quantity(row.qty)} {row.item_name}
                    </Text>
                  ))}
                  {line.note ? <Text style={[styles.meta, { color: palette.onSurface }]}>“{line.note}”</Text> : null}
                  {progress ? <Text style={[styles.meta, { color: palette.primary }]}>{progress}</Text> : null}
                </View>
              );
            })}
          {renderActions ? renderActions(ticket, result.refresh) : null}
          {ticket.actions?.length ? (
            <View style={styles.history}>
              <Text style={[styles.item, { color: palette.onSurface }]}>History</Text>
              {ticket.actions.map((row) => (
                <Text key={row.name} style={[styles.meta, { color: row.outcome === "Failed" ? palette.error : palette.onSurfaceMuted }]}>
                  {row.occurred_at.slice(11, 16)} · {row.action}: {row.from_status} → {row.to_status} · {row.actor}
                  {row.reason ? ` · ${row.reason}` : ""}
                  {row.error_message ? ` · ${row.error_message}` : ""}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  history: { gap: 4, marginTop: spacing.xs },
  item: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
  line: { borderRadius: radii.md, borderWidth: 1, gap: 2, padding: spacing.sm },
  link: { fontFamily: typography.fontFamily.medium, fontSize: typography.size.small },
  loading: { padding: spacing.lg },
  meta: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  notice: { borderRadius: radii.md, gap: 4, overflow: "hidden", padding: spacing.sm },
  status: { borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  statusText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.small },
});
