import { useCallback, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button, Text } from "react-native-paper";

import { getKitchenBoard } from "@/features/restaurant/api/restaurantApi";
import { ChipRow } from "@/features/restaurant/components/ChipRow";
import { KitchenRoutineButtons, KitchenTicketActions } from "@/features/restaurant/components/KitchenTicketActions";
import { KitchenTicketSheet, lineProgress } from "@/features/restaurant/components/KitchenTicketSheet";
import { RestaurantPlaceholder } from "@/features/restaurant/components/RestaurantPlaceholder";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { useKitchenActions } from "@/features/restaurant/hooks/useKitchenActions";
import { useNow } from "@/features/restaurant/hooks/useNow";
import { usePolledResource } from "@/features/restaurant/hooks/usePolledResource";
import { parseServerDatetime } from "@/features/restaurant/logic/tableStatus";
import { kitchenStatusTone } from "@/features/restaurant/theme";
import type { KitchenTicketDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/** The kitchen board refreshes faster than the floor: new tickets matter to the cooks. */
const KITCHEN_POLL_INTERVAL_MS = 8_000;

/** Kitchen display (KDS): the tickets for the stations this user may work, newest work first. */
export function RestaurantKitchenScreen() {
  const { palette } = useAppearance();
  const { width } = useWindowDimensions();
  const restaurant = useRestaurant();
  const now = useNow(15_000);
  const [station, setStation] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const [pages, setPages] = useState(1);
  const [opened, setOpened] = useState<string | null>(null);
  const fetcher = useCallback(async () => {
    // Older pages are re-read with the first so the board stays one consistent list.
    const first = await getKitchenBoard(restaurant.connection, {
      pos_profile: restaurant.posProfile,
      station: station ?? undefined,
      history: history ? 1 : 0,
      start: 0,
    });
    let board = first;
    for (let page = 1; page < pages && board.has_more; page += 1) {
      const next = await getKitchenBoard(restaurant.connection, {
        pos_profile: restaurant.posProfile,
        station: station ?? undefined,
        history: history ? 1 : 0,
        start: board.tickets.length,
      });
      board = { ...next, tickets: [...board.tickets, ...next.tickets] };
    }
    return board;
  }, [history, pages, restaurant.connection, restaurant.posProfile, station]);
  const board = usePolledResource(
    JSON.stringify(["kitchen", restaurant.posProfile, station, history, pages]),
    fetcher,
    { intervalMs: KITCHEN_POLL_INTERVAL_MS },
  );
  const actions = useKitchenActions(board.refresh);
  const columns = width >= 900 ? 3 : width >= 600 ? 2 : 1;

  if (!board.data && board.isLoading) {
    return <RestaurantPlaceholder icon="chef-hat" title="Loading kitchen tickets" />;
  }
  if (!board.data) {
    return (
      <RestaurantPlaceholder description={board.error ?? undefined} icon="alert-circle-outline" title="Kitchen board unavailable">
        <Button mode="contained" onPress={() => void board.refresh()}>
          Try again
        </Button>
      </RestaurantPlaceholder>
    );
  }

  const stations = board.data.stations.filter((row) => row.enabled);
  return (
    <View style={styles.root}>
      <ChipRow
        accessibilityLabel="Kitchen station"
        activeKey={station ?? ""}
        chips={[
          { key: "", label: "All stations" },
          ...stations.map((row) => ({ key: row.name, label: row.ordering_paused ? `${row.station_name} · paused` : row.station_name })),
        ]}
        onChange={(key) => {
          setStation(key || null);
          setPages(1);
        }}
      />
      <View style={styles.toolbar}>
        <Text style={[styles.meta, { color: board.error ? palette.error : palette.onSurfaceMuted }]}>
          {board.error ? "Not refreshed. Retrying." : `${board.data.tickets.length} ticket${board.data.tickets.length === 1 ? "" : "s"}`}
        </Text>
        <Button
          compact
          icon={history ? "history" : "clock-outline"}
          mode="text"
          onPress={() => {
            setHistory(!history);
            setPages(1);
          }}
        >
          {history ? "Showing done" : "Show done"}
        </Button>
      </View>
      <FlashList
        contentContainerStyle={styles.list}
        data={board.data.tickets}
        extraData={[now, actions.busyTicket]}
        key={columns}
        keyExtractor={(ticket) => ticket.name}
        ListEmptyComponent={
          <RestaurantPlaceholder
            description={history ? "Nothing finished yet today." : "New orders appear here as soon as they are sent."}
            icon="chef-hat"
            title={history ? "No finished tickets" : "No tickets waiting"}
          />
        }
        ListFooterComponent={
          board.data.has_more ? (
            <Button onPress={() => setPages((count) => count + 1)} style={styles.more}>
              Load more
            </Button>
          ) : null
        }
        numColumns={columns}
        refreshControl={<RefreshControl onRefresh={() => void board.refresh()} refreshing={false} />}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <TicketCard actions={actions} now={now} onOpen={() => setOpened(item.name)} ticket={item} />
          </View>
        )}
      />
      {opened ? (
        <KitchenTicketSheet
          name={opened}
          onClose={() => setOpened(null)}
          renderActions={(ticket) => (
            <KitchenTicketActions actions={actions} onClose={() => setOpened(null)} ticket={ticket} />
          )}
        />
      ) : null}
    </View>
  );
}

function TicketCard({
  ticket,
  now,
  actions,
  onOpen,
}: {
  ticket: KitchenTicketDTO;
  now: Date;
  actions: ReturnType<typeof useKitchenActions>;
  onOpen: () => void;
}) {
  const { appearance, palette } = useAppearance();
  const tone = kitchenStatusTone(ticket.status, appearance === "dark");
  const minutes = Math.max(0, Math.floor((now.getTime() - parseServerDatetime(ticket.sent_at).getTime()) / 60000));
  const late = minutes >= 20 && !["Ready", "Served", "Completed", "Cancelled"].includes(ticket.status);
  const where = ticket.table_labels ? `Table ${ticket.table_labels}` : ticket.service_type || ticket.restaurant_session;

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: tone.stroke }]}>
      <Pressable accessibilityHint="Opens the ticket" accessibilityRole="button" onPress={onOpen} style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={styles.flex}>
            <Text style={[styles.where, { color: palette.onSurface }]}>{where}</Text>
            <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>
              {ticket.station_label} · {ticket.name}
              {ticket.waiter_name || ticket.waiter ? ` · ${ticket.waiter_name || ticket.waiter}` : ""}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.status, { backgroundColor: tone.fill, borderColor: tone.stroke }]}>
              <Text style={[styles.statusText, { color: palette.onSurface }]}>{ticket.status}</Text>
            </View>
            <Text style={[styles.minutes, { color: late ? palette.error : palette.onSurfaceMuted }]}>{minutes} min</Text>
          </View>
        </View>
        {ticket.remake_of ? <Text style={[styles.meta, { color: palette.warning }]}>Replacement for {ticket.remake_of}</Text> : null}
        {ticket.order_note ? <Text style={[styles.note, { color: palette.onSurface }]}>“{ticket.order_note}”</Text> : null}
        {ticket.items
          .filter((line) => !line.parent_line_id)
          .map((line) => {
            const progress = lineProgress(line);
            return (
              <View key={line.line_id} style={styles.line}>
                <Text style={[styles.qty, { color: palette.onSurface }]}>{line.qty}×</Text>
                <View style={styles.flex}>
                  <Text style={[styles.item, { color: palette.onSurface }]}>{line.item_name}</Text>
                  {line.modifiers.length ? (
                    <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>{line.modifiers.map((row) => row.label).join(" · ")}</Text>
                  ) : null}
                  {line.note ? <Text style={[styles.note, { color: palette.onSurface }]}>“{line.note}”</Text> : null}
                  {progress ? <Text style={[styles.meta, { color: palette.primary }]}>{progress}</Text> : null}
                </View>
              </View>
            );
          })}
      </Pressable>
      <View style={styles.cardActions}>
        <KitchenRoutineButtons actions={actions} ticket={ticket} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 2, flex: 1, overflow: "hidden" },
  cardActions: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  cardBody: { gap: 6, padding: spacing.sm },
  cardHeader: { flexDirection: "row", gap: spacing.xs },
  // FlashList has no column gap: each cell pads half the gap on every side.
  cell: { flex: 1, padding: spacing.sm / 2 },
  flex: { flex: 1 },
  headerRight: { alignItems: "flex-end", gap: 4 },
  item: { fontFamily: typography.fontFamily.semibold, fontSize: 15 },
  line: { flexDirection: "row", gap: spacing.xs },
  list: { padding: spacing.md - spacing.sm / 2 },
  meta: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  minutes: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.small },
  more: { marginTop: spacing.xs },
  note: { fontFamily: typography.fontFamily.medium, fontSize: typography.size.small, fontStyle: "italic" },
  qty: { fontFamily: typography.fontFamily.semibold, fontSize: 15, minWidth: 30 },
  root: { flex: 1 },
  status: { borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  statusText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.tiny },
  toolbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingLeft: spacing.md },
  where: { fontFamily: typography.fontFamily.semibold, fontSize: 16 },
});
