import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { Button, Searchbar, Text } from "react-native-paper";

import { useToast } from "@/components/feedback/ToastProvider";
import { getSession } from "@/features/restaurant/api/restaurantApi";
import { ChipRow } from "@/features/restaurant/components/ChipRow";
import { KitchenRoutingSheet } from "@/features/restaurant/components/KitchenRoutingSheet";
import { MenuItemCard } from "@/features/restaurant/components/MenuItemCard";
import { OrderSheet } from "@/features/restaurant/components/OrderSheet";
import { RestaurantPlaceholder } from "@/features/restaurant/components/RestaurantPlaceholder";
import { TablePicker } from "@/features/restaurant/components/TablePicker";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { formatMoney, itemImageUrl } from "@/features/restaurant/format";
import { usePolledResource } from "@/features/restaurant/hooks/usePolledResource";
import { useSellController } from "@/features/restaurant/hooks/useSellController";
import { unsentCount } from "@/features/restaurant/logic/orderDraft";
import type { MenuItemDTO, RestaurantTableDTO, TableStatusDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/**
 * Sell: choose the service type (and a table when it needs one), add items from
 * the menu for that context, and place the round. With `?session=` it takes the
 * next round for an open visit.
 */
export function RestaurantSellScreen() {
  const { palette } = useAppearance();
  const toast = useToast();
  const restaurant = useRestaurant();
  const params = useLocalSearchParams<{ session?: string }>();
  const sessionName = typeof params.session === "string" && params.session ? params.session : null;
  const sessionFetcher = useCallback(
    () => getSession(restaurant.connection, sessionName ?? ""),
    [restaurant.connection, sessionName],
  );
  const sessionResult = usePolledResource(sessionName ? `session:${sessionName}` : null, sessionFetcher);
  const session = sessionResult.data?.name === sessionName ? sessionResult.data : null;
  const sell = useSellController({ sessionName, session });
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickingTable, setPickingTable] = useState(false);
  const { draft, menu, serviceType, setError } = sell;
  const readOnly = Boolean(session && session.status !== "Open");
  const precision = restaurant.currencyPrecision;
  const currency = session?.currency || restaurant.currency;

  useEffect(() => {
    if (!sell.error) return;
    toast.error(sell.error);
    setError(null);
  }, [sell.error, setError, toast]);

  function openSession(name: string) {
    const leave = () => {
      setPickingTable(false);
      router.setParams({ session: name });
    };
    if (draft?.unsent.length) {
      Alert.alert("Discard unsent items?", "The items you have not placed will be removed.", [
        { style: "cancel", text: "Keep" },
        { onPress: leave, style: "destructive", text: "Discard" },
      ]);
    } else leave();
  }

  function startNewSale() {
    setPickingTable(false);
    router.setParams({ session: "" });
  }

  function pickTable(table: RestaurantTableDTO, row: TableStatusDTO | undefined) {
    const visit = row?.session;
    if (visit?.status === "Settled") {
      toast.info(`Table ${table.table_label} has a paid kiosk order. Clear it when the guests leave.`);
      return;
    }
    if (visit) {
      if (visit.name !== sessionName) openSession(visit.name);
      return;
    }
    if (row?.orders.length) {
      toast.warning(`Table ${table.table_label} has an older order. Open it from the web POS.`);
      return;
    }
    if (session) {
      // Joining or moving tables on an open visit comes with the visit controls.
      return;
    }
    void sell
      .chooseTable(table)
      .then(() => setPickingTable(false))
      .catch(() => undefined);
  }

  async function place(routing?: Record<string, string>) {
    const name = routing ? await sell.applyKitchenRouting(routing) : await sell.placeOrder();
    if (!name) return;
    setSheetOpen(false);
    toast.success("Order sent to the kitchen.");
    if (name !== sessionName) router.setParams({ session: name });
    else void sessionResult.refresh();
  }

  if (!restaurant.settings.service_types.length) {
    return (
      <RestaurantPlaceholder
        description="Add a service type to this restaurant before taking orders."
        icon="silverware-fork-knife"
        title="No service types configured"
      />
    );
  }
  if (sessionName && !session) {
    return sessionResult.error ? (
      <RestaurantPlaceholder description={sessionResult.error} icon="alert-circle-outline" title="Visit unavailable">
        <Button mode="contained" onPress={() => void sessionResult.refresh()}>
          Try again
        </Button>
        <Button onPress={startNewSale}>New sale</Button>
      </RestaurantPlaceholder>
    ) : (
      <RestaurantPlaceholder icon="silverware-fork-knife" title="Loading visit" />
    );
  }
  if (!draft) return <RestaurantPlaceholder icon="silverware-fork-knife" title="Preparing the selling screen" />;

  const tableLabel = session
    ? session.tables
        .filter((row) => !row.released_at)
        .map((row) => row.table_label)
        .join(" + ")
    : draft.table_label;
  const showTablePicker = sell.needsTable || pickingTable;
  const items = (menu.menu?.items ?? []).filter((item) => {
    const needle = query.trim().toLowerCase();
    return (
      (!category || item.menu_category === category) &&
      (!needle || `${item.item_code} ${item.item_name} ${item.barcode ?? ""}`.toLowerCase().includes(needle))
    );
  });
  const count = unsentCount(draft);
  const total = sell.pricedInvoice
    ? sell.pricedInvoice.totals.rounded_total || sell.pricedInvoice.totals.grand_total
    : sell.localSubtotal;

  function tapItem(item: MenuItemDTO) {
    if (item.has_variants || menu.menu?.modifier_groups?.[item.item_code]?.length) {
      toast.info("Options and variants are coming in the next update.");
      return;
    }
    void sell.addItem(item);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.context, { backgroundColor: palette.surface, borderBottomColor: palette.borderSubtle }]}>
        <ChipRow
          accessibilityLabel="Service type"
          activeKey={serviceType?.name ?? null}
          chips={sell.serviceTypes.map((row) => ({
            key: row.name,
            label: row.service_type_name,
            disabled: Boolean(session) && row.name !== serviceType?.name,
          }))}
          onChange={(key) => {
            const next = sell.serviceTypes.find((row) => row.name === key);
            if (!next || session) return;
            sell.chooseServiceType(next);
            setCategory("");
            setPickingTable(Boolean(next.requires_table));
          }}
        />
        {serviceType?.requires_table || session ? (
          <View style={styles.contextRow}>
            {serviceType?.requires_table ? (
              <Pressable
                accessibilityRole="button"
                disabled={Boolean(session) || readOnly}
                onPress={() => setPickingTable(true)}
                style={[styles.tableChip, { borderColor: palette.border }]}
              >
                <MaterialCommunityIcons color={palette.onSurface} name="table-furniture" size={16} />
                <Text style={[styles.contextText, { color: palette.onSurface }]}>
                  {tableLabel ? `Table ${tableLabel}` : "Choose a table"}
                </Text>
              </Pressable>
            ) : null}
            {session ? (
              <>
                <Text numberOfLines={1} style={[styles.contextMuted, { color: palette.onSurfaceMuted }]}>
                  {session.customer_name} · {session.guest_count || 0} guests
                  {session.preparation_status ? ` · ${session.preparation_status}` : ""}
                </Text>
                <Button compact mode="text" onPress={startNewSale}>
                  New sale
                </Button>
              </>
            ) : null}
          </View>
        ) : null}
        {readOnly ? (
          <Text style={[styles.contextMuted, styles.readOnly, { color: palette.warning }]}>
            This visit is {session?.status.toLowerCase()} and can no longer take orders.
          </Text>
        ) : null}
      </View>

      {showTablePicker ? (
        <TablePicker
          onCancel={sell.needsTable ? undefined : () => setPickingTable(false)}
          onPick={pickTable}
          prompt={`Choose a table for ${serviceType?.service_type_name ?? "this order"}`}
          selected={draft.table ? [draft.table] : []}
        />
      ) : (
        <>
          {menu.menu?.categories.length ? (
            <ChipRow
              accessibilityLabel="Menu categories"
              activeKey={category}
              chips={[{ key: "", label: "All" }, ...menu.menu.categories.map((row) => ({ key: row.item_group, label: row.label }))]}
              onChange={setCategory}
            />
          ) : null}
          <Searchbar
            onChangeText={setQuery}
            placeholder="Search the menu"
            style={[styles.search, { backgroundColor: palette.surface }]}
            value={query}
          />
          {!menu.menu && menu.isLoading ? (
            <RestaurantPlaceholder icon="book-open-variant" title="Loading menu" />
          ) : !menu.menu ? (
            <RestaurantPlaceholder description={menu.error ?? undefined} icon="alert-circle-outline" title="Menu unavailable">
              <Button mode="contained" onPress={menu.reload}>
                Try again
              </Button>
            </RestaurantPlaceholder>
          ) : (
            <FlatList
              columnWrapperStyle={styles.columns}
              contentContainerStyle={styles.grid}
              data={items}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.item_code}
              ListEmptyComponent={
                <RestaurantPlaceholder icon="magnify" title={query ? "No matching items" : "Nothing on this menu"} />
              }
              numColumns={2}
              renderItem={({ item }) => (
                <MenuItemCard
                  busy={sell.pendingItem === item.item_code}
                  currency={currency}
                  customizable={Boolean(menu.menu?.modifier_groups?.[item.item_code]?.length)}
                  disabled={readOnly || sell.busy}
                  imageUrl={restaurant.profile.hide_images ? null : itemImageUrl(item.image, restaurant.connection.companyUrl)}
                  item={item}
                  onPress={() => tapItem(item)}
                  precision={precision}
                  quantity={sell.quantities.get(item.item_code) ?? 0}
                />
              )}
            />
          )}
        </>
      )}

      {count ? (
        <Pressable
          accessibilityLabel={`Review ${count} new items`}
          accessibilityRole="button"
          onPress={() => setSheetOpen(true)}
          style={[styles.cartBar, { backgroundColor: palette.primary }]}
        >
          <View style={[styles.cartCount, { backgroundColor: palette.onPrimary }]}>
            <Text style={[styles.cartCountText, { color: palette.primary }]}>{count}</Text>
          </View>
          <Text style={[styles.cartText, { color: palette.onPrimary }]}>{sell.checking ? "Checking…" : "Review order"}</Text>
          <Text style={[styles.cartText, { color: palette.onPrimary }]}>{formatMoney(total, currency, precision)}</Text>
        </Pressable>
      ) : null}

      <OrderSheet
        busy={sell.busy}
        checking={sell.checking}
        currency={currency}
        draft={draft}
        invoice={sell.pricedInvoice}
        localSubtotal={sell.localSubtotal}
        onClear={() =>
          Alert.alert("Clear new items?", "Items that have not been placed are removed.", [
            { style: "cancel", text: "Keep" },
            { onPress: sell.clearUnsent, style: "destructive", text: "Clear" },
          ])
        }
        onClose={() => setSheetOpen(false)}
        onNote={sell.setNote}
        onOrderNote={sell.setOrderNote}
        onPlace={() => void place()}
        onQty={(lineId, qty) => void sell.setQty(lineId, qty)}
        onRemove={sell.removeLine}
        precision={precision}
        readOnly={readOnly}
        title={[serviceType?.service_type_name, tableLabel ? `Table ${tableLabel}` : null].filter(Boolean).join(" · ")}
        visible={sheetOpen}
      />
      {sell.routingIssue ? (
        <KitchenRoutingSheet
          initial={draft.kitchen_routing}
          issue={sell.routingIssue}
          onClose={sell.dismissRouting}
          onConfirm={(routing) => void place(routing)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cartBar: {
    alignItems: "center",
    borderRadius: radii.lg,
    bottom: spacing.sm,
    elevation: 4,
    flexDirection: "row",
    gap: spacing.sm,
    left: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    position: "absolute",
    right: spacing.md,
  },
  cartCount: { alignItems: "center", borderRadius: radii.pill, height: 26, justifyContent: "center", minWidth: 26, paddingHorizontal: 6 },
  cartCountText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.small },
  cartText: { flex: 1, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
  columns: { gap: spacing.sm },
  context: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing.xs },
  contextMuted: { flex: 1, fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  contextRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md },
  contextText: { fontFamily: typography.fontFamily.medium, fontSize: typography.size.small },
  grid: { gap: spacing.sm, padding: spacing.md, paddingBottom: 96 },
  readOnly: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  root: { flex: 1 },
  search: { elevation: 0, marginHorizontal: spacing.md, marginBottom: spacing.xs },
  tableChip: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
  },
});
