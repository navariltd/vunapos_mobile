import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Button, IconButton, Searchbar, Text } from "react-native-paper";

import { useToast } from "@/components/feedback/ToastProvider";
import { getLoggedUser } from "@/features/restaurant/api/restaurantApi";
import { ChipRow } from "@/features/restaurant/components/ChipRow";
import { RestaurantPlaceholder } from "@/features/restaurant/components/RestaurantPlaceholder";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { useFloorPlan } from "@/features/restaurant/hooks/useFloorData";
import { useNow } from "@/features/restaurant/hooks/useNow";
import { useOpenOrders } from "@/features/restaurant/hooks/useOpenOrders";
import {
  DEFAULT_ORDERS_FILTER,
  filterOrders,
  isAwaitingPayment,
  isFiltered,
  isPaidKioskOrder,
  type OrdersFilter,
} from "@/features/restaurant/logic/ordersFilter";
import { sortedServiceTypes } from "@/features/restaurant/logic/tableStatus";
import { timeSince } from "@/features/restaurant/logic/timeLabels";
import { kitchenStatusTone } from "@/features/restaurant/theme";
import type { RestaurantOrderSummaryDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/** Open orders (visits) across the restaurant: search, filter and open one in Sell. */
export function RestaurantOrdersScreen() {
  const { palette } = useAppearance();
  const toast = useToast();
  const restaurant = useRestaurant();
  const orders = useOpenOrders();
  const floorPlan = useFloorPlan();
  const now = useNow();
  const [filter, setFilter] = useState<OrdersFilter>(DEFAULT_ORDERS_FILTER);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const serviceTypes = sortedServiceTypes(restaurant.settings.service_types);

  useEffect(() => {
    let active = true;
    getLoggedUser(restaurant.connection)
      .then((user) => active && setCurrentUser(user))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [restaurant.connection]);

  const floorOfTable = useMemo(
    () => new Map(floorPlan.floors.flatMap((floor) => floor.tables.map((table) => [table.name, floor.name] as const))),
    [floorPlan.floors],
  );
  const visible = orders.data ? filterOrders(orders.data, filter, { currentUser, floorOfTable }) : null;
  const update = (patch: Partial<OrdersFilter>) => setFilter((current) => ({ ...current, ...patch }));

  function open(order: RestaurantOrderSummaryDTO) {
    if (!order.restaurant_session) {
      toast.warning(`${order.name} is an older order. Open it from the web POS.`);
      return;
    }
    // Open the visit showing what was ordered; the menu behind it takes the next round.
    router.navigate({ pathname: "/(restaurant)/sell", params: { session: order.restaurant_session, view: "orders" } });
  }

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <Searchbar
          onChangeText={(query) => update({ query })}
          placeholder="Table, customer or order"
          style={[styles.search, { backgroundColor: palette.surface }]}
          value={filter.query}
        />
        <IconButton
          accessibilityLabel={filter.sort === "oldest" ? "Show newest first" : "Show oldest first"}
          icon={filter.sort === "oldest" ? "sort-clock-ascending-outline" : "sort-clock-descending-outline"}
          onPress={() => update({ sort: filter.sort === "oldest" ? "newest" : "oldest" })}
        />
      </View>
      <ChipRow
        accessibilityLabel="Service type"
        activeKey={filter.serviceType ?? ""}
        chips={[{ key: "", label: "All" }, ...serviceTypes.map((row) => ({ key: row.name, label: row.service_type_name }))]}
        onChange={(key) => update({ serviceType: key || null })}
      />
      <ChipRow
        accessibilityLabel="Floor and owner"
        activeKey={filter.mine ? "__mine" : filter.awaitingPayment ? "__awaiting" : filter.floor ?? ""}
        chips={[
          { key: "", label: "All floors" },
          ...floorPlan.floors.map((floor) => ({ key: floor.name, label: floor.floor_name })),
          { key: "__mine", label: "Mine", disabled: !currentUser },
          ...(restaurant.settings.kiosk_mode ? [{ key: "__awaiting", label: "Awaiting payment" }] : []),
        ]}
        onChange={(key) =>
          update({
            floor: key.startsWith("__") ? filter.floor : key || null,
            mine: key === "__mine" ? !filter.mine : false,
            awaitingPayment: key === "__awaiting" ? !filter.awaitingPayment : false,
          })
        }
      />
      {!visible && orders.isLoading ? (
        <RestaurantPlaceholder icon="clipboard-text-outline" title="Loading orders" />
      ) : !visible ? (
        <RestaurantPlaceholder description={orders.error ?? undefined} icon="alert-circle-outline" title="Orders unavailable">
          <Button mode="contained" onPress={() => void orders.refresh()}>
            Try again
          </Button>
        </RestaurantPlaceholder>
      ) : (
        <FlashList
          contentContainerStyle={styles.list}
          data={visible}
          extraData={now}
          ItemSeparatorComponent={Separator}
          keyExtractor={(order) => order.name}
          ListEmptyComponent={
            isFiltered(filter) ? (
              <RestaurantPlaceholder icon="filter-remove-outline" title="No matching orders">
                <Button onPress={() => setFilter(DEFAULT_ORDERS_FILTER)}>Clear filters</Button>
              </RestaurantPlaceholder>
            ) : (
              <RestaurantPlaceholder description="Orders you place appear here until they are billed." icon="clipboard-check-outline" title="No open orders" />
            )
          }
          refreshControl={<RefreshControl onRefresh={() => void orders.refresh()} refreshing={false} />}
          renderItem={({ item }) => <OrderRow now={now} onPress={() => open(item)} order={item} serviceTypes={serviceTypes} />}
        />
      )}
    </View>
  );
}

function OrderRow({
  order,
  now,
  serviceTypes,
  onPress,
}: {
  order: RestaurantOrderSummaryDTO;
  now: Date;
  serviceTypes: { name: string; service_type_name: string }[];
  onPress: () => void;
}) {
  const { appearance, palette } = useAppearance();
  const service = serviceTypes.find((row) => row.name === order.service_type)?.service_type_name ?? order.service_type;
  const elapsed = timeSince(order.opened_at, now);
  const prep = order.preparation_status && order.preparation_status !== "No preparation" ? order.preparation_status : null;
  const tone = prep ? kitchenStatusTone(prep, appearance === "dark") : null;
  const title = order.table_label ? `Table ${order.table_label}` : order.order_number ? `Order ${order.order_number}` : service;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: palette.surface, borderColor: palette.border }, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.rowMain}>
        <View style={styles.rowTop}>
          <Text style={[styles.title, { color: palette.onSurface }]}>{title}</Text>
          {elapsed ? <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>{elapsed}</Text> : null}
        </View>
        <Text numberOfLines={1} style={[styles.meta, { color: palette.onSurfaceMuted }]}>
          {[order.table_label || order.order_number ? service : null, order.customer, order.pax ? `${order.pax} guests` : null, order.waiter_name || order.waiter]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <View style={styles.badges}>
          {prep && tone ? (
            <View style={[styles.badge, { backgroundColor: tone.fill, borderColor: tone.stroke }]}>
              <Text style={[styles.badgeText, { color: palette.onSurface }]}>Kitchen: {prep}</Text>
            </View>
          ) : null}
          {order.billing_pending ? <Badge label="Billing" /> : null}
          {isAwaitingPayment(order) ? <Badge label="Awaiting payment" /> : null}
          {isPaidKioskOrder(order) ? <Badge label="Paid · clear table" /> : null}
          {!order.restaurant_session ? <Badge label="Older order" /> : null}
        </View>
      </View>
      <MaterialCommunityIcons color={palette.onSurfaceMuted} name="chevron-right" size={22} />
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function Badge({ label }: { label: string }) {
  const { palette } = useAppearance();
  return (
    <View style={[styles.badge, { backgroundColor: palette.warningSurface, borderColor: palette.warning }]}>
      <Text style={[styles.badgeText, { color: palette.warning }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  badgeText: { fontFamily: typography.fontFamily.medium, fontSize: typography.size.tiny },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  list: { padding: spacing.md },
  separator: { height: spacing.xs },
  meta: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  root: { flex: 1 },
  row: { alignItems: "center", borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.sm },
  rowMain: { flex: 1, gap: 4 },
  rowTop: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  search: { elevation: 0, flex: 1 },
  searchRow: { alignItems: "center", flexDirection: "row", paddingLeft: spacing.md, paddingTop: spacing.xs },
  title: { fontFamily: typography.fontFamily.semibold, fontSize: 16 },
});
