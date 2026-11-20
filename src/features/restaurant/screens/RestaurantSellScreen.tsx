import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, IconButton, ProgressBar, Searchbar, Text } from "react-native-paper";

import { useToast } from "@/components/feedback/ToastProvider";
import { getSession, getTemplateVariants } from "@/features/restaurant/api/restaurantApi";
import { restaurantErrorMessage } from "@/features/restaurant/api/restaurantClient";
import { BillSheet } from "@/features/restaurant/components/BillSheet";
import { ChipRow } from "@/features/restaurant/components/ChipRow";
import { CustomerPickerSheet } from "@/features/restaurant/components/CustomerPickerSheet";
import { KitchenTicketSheet } from "@/features/restaurant/components/KitchenTicketSheet";
import { KitchenRoutingSheet } from "@/features/restaurant/components/KitchenRoutingSheet";
import { MenuItemCard } from "@/features/restaurant/components/MenuItemCard";
import { ModifierPickerSheet } from "@/features/restaurant/components/ModifierPickerSheet";
import { OrderSheet } from "@/features/restaurant/components/OrderSheet";
import { RestaurantPlaceholder } from "@/features/restaurant/components/RestaurantPlaceholder";
import { RoundsSheet } from "@/features/restaurant/components/RoundsSheet";
import { Sheet } from "@/features/restaurant/components/Sheet";
import { TablePicker } from "@/features/restaurant/components/TablePicker";
import { VariantPickerSheet } from "@/features/restaurant/components/VariantPickerSheet";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { formatMoney, itemImageUrl } from "@/features/restaurant/format";
import { usePolledResource } from "@/features/restaurant/hooks/usePolledResource";
import { useSellController } from "@/features/restaurant/hooks/useSellController";
import { useReceipt } from "@/features/restaurant/hooks/useReceipt";
import { useVisitActions } from "@/features/restaurant/hooks/useVisitActions";
import { restaurantCustomerControls } from "@/features/restaurant/logic/customerControls";
import { unsentCount } from "@/features/restaurant/logic/orderDraft";
import { selectVisitTable } from "@/features/restaurant/logic/tableTransfer";
import { draftStore } from "@/features/restaurant/state/draftStore";
import type {
  MenuItemDTO,
  ModifierGroupDTO,
  SessionSettlementDTO,
  RestaurantTableDTO,
  TableStatusDTO,
  TemplateVariantDTO,
} from "@/features/restaurant/types";
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
  const params = useLocalSearchParams<{ session?: string; view?: string }>();
  const sessionName = typeof params.session === "string" && params.session ? params.session : null;
  const sessionFetcher = useCallback(
    () => getSession(restaurant.connection, sessionName ?? ""),
    [restaurant.connection, sessionName],
  );
  const sessionResult = usePolledResource(sessionName ? `session:${sessionName}` : null, sessionFetcher);
  const session = sessionResult.data?.name === sessionName ? sessionResult.data : null;
  const sell = useSellController({ sessionName, session });
  const visit = useVisitActions(session, sessionResult.refresh);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickingTable, setPickingTable] = useState(false);
  const [variantsFor, setVariantsFor] = useState<{
    item: MenuItemDTO;
    variants: TemplateVariantDTO[];
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [customizing, setCustomizing] = useState<{ item: MenuItemDTO; groups: ModifierGroupDTO[] } | null>(null);
  const variantRequest = useRef(0);
  const [tableAction, setTableAction] = useState<{ kind: "join" | "transfer"; selection: string[] } | null>(null);
  const [roundsOpen, setRoundsOpen] = useState(false);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [settled, setSettled] = useState<SessionSettlementDTO | null>(null);
  const receipt = useReceipt();

  // Opened from Orders: show the visit's placed orders first, until closed.
  const showRounds = roundsOpen || (params.view === "orders" && Boolean(session));
  function closeRounds() {
    setRoundsOpen(false);
    if (params.view) router.setParams({ view: "" });
  }
  const { draft, menu, serviceType, setError } = sell;
  const readOnly = Boolean(session && session.status !== "Open");
  const precision = restaurant.currencyPrecision;
  const currency = session?.currency || restaurant.currency;

  useEffect(() => {
    if (!sell.error) return;
    toast.error(sell.error);
    setError(null);
  }, [sell.error, setError, toast]);

  const visitError = visit.error;
  const clearVisitError = visit.clearError;
  useEffect(() => {
    if (!visitError) return;
    toast.error(visitError);
    clearVisitError();
  }, [clearVisitError, toast, visitError]);

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
    const visitRow = row?.session;
    if (visitRow?.status === "Settled") {
      toast.info(`Table ${table.table_label} has a paid kiosk order. Clear it when the guests leave.`);
      return;
    }
    if (visitRow) {
      if (visitRow.name === sessionName) {
        if (tableAction?.kind === "join") {
          setTableAction({ ...tableAction, selection: selectVisitTable(tableAction.selection, table.name, "join") });
        }
        return;
      }
      if (session) {
        toast.warning(`Table ${table.table_label} belongs to another visit. Choose a free table.`);
        return;
      }
      openSession(visitRow.name);
      return;
    }
    if (row?.orders.length) {
      toast.warning(`Table ${table.table_label} has an older order. Open it from the web POS.`);
      return;
    }
    if (session) {
      if (tableAction) {
        setTableAction({ ...tableAction, selection: selectVisitTable(tableAction.selection, table.name, tableAction.kind) });
      }
      return;
    }
    void sell
      .chooseTable(table)
      .then(() => setPickingTable(false))
      .catch(() => undefined);
  }

  const activeTables = session?.tables.filter((row) => !row.released_at).map((row) => row.table) ?? [];

  function startTableAction(kind: "join" | "transfer") {
    setTableAction({ kind, selection: kind === "join" ? activeTables : [] });
  }

  async function saveTables() {
    if (!tableAction?.selection.length) return;
    const saved = await visit.setTables(tableAction.selection);
    if (saved) {
      toast.success(tableAction.kind === "transfer" ? "Visit moved." : "Tables updated.");
      setTableAction(null);
    }
  }

  function changeGuests(delta: number) {
    if (session) {
      void visit.setGuests((session.guest_count || 0) + delta);
    } else if (draft) {
      sell.setDraftGuests(Math.max(0, (sell.header?.pax ?? 0) + delta));
    }
  }

  function cancelVisit() {
    Alert.alert("Cancel this visit?", "It has no orders. Its tables are released.", [
      { style: "cancel", text: "Keep" },
      {
        onPress: () => {
          void visit.cancelEmpty().then((done) => {
            if (!done) return;
            closeRounds();
            toast.info("Visit cancelled.");
            startNewSale();
          });
        },
        style: "destructive",
        text: "Cancel visit",
      },
    ]);
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
  const showTablePicker = sell.needsTable || pickingTable || Boolean(tableAction);
  const guests = session ? session.guest_count || 0 : sell.header?.pax ?? 0;
  const customerControls = restaurantCustomerControls({
    allowCreation: false,
    roundCount: session?.rounds.length ?? 0,
    readOnly: readOnly || visit.busy,
  });
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

  function modifierGroupsFor(item: MenuItemDTO) {
    const groups = menu.menu?.modifier_groups;
    return groups?.[item.item_code] ?? (item.variant_of ? groups?.[item.variant_of] : undefined) ?? [];
  }

  /** Templates open their variants; items with modifier groups open the picker; others are added. */
  function tapItem(item: MenuItemDTO) {
    if (item.has_variants) {
      void loadVariants(item);
      return;
    }
    const groups = modifierGroupsFor(item);
    if (groups.length) {
      setCustomizing({ item, groups });
      return;
    }
    void sell.addItem(item);
  }

  async function loadVariants(item: MenuItemDTO) {
    const request = ++variantRequest.current;
    setVariantsFor({ item, variants: [], loading: true, error: null });
    try {
      const response = await getTemplateVariants(restaurant.connection, {
        template_item_code: item.item_code,
        pos_profile: restaurant.posProfile,
        customer: session?.customer ?? sell.header?.customer,
        price_list: session?.selling_price_list,
      });
      if (request !== variantRequest.current) return;
      const allowed = menu.menu?.available_item_codes;
      setVariantsFor({
        item,
        variants: response.variants.filter((row) => !allowed || allowed.includes(row.item_code)),
        loading: false,
        error: null,
      });
    } catch (caught) {
      if (request === variantRequest.current) {
        setVariantsFor({ item, variants: [], loading: false, error: restaurantErrorMessage(caught, "Could not load the options.") });
      }
    }
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
          <Pressable
            accessibilityRole="button"
            disabled={customerControls.disabled}
            onPress={() => setCustomerOpen(true)}
            style={[styles.tableChip, styles.customerChip, { borderColor: palette.border }]}
          >
            <MaterialCommunityIcons color={palette.onSurface} name="account-outline" size={16} />
            <Text numberOfLines={1} style={[styles.contextText, styles.shrink, { color: palette.onSurface }]}>
              {session?.customer_name ?? sell.header?.customer_name ?? "Customer"}
            </Text>
          </Pressable>
          <View style={styles.guests}>
            <IconButton
              accessibilityLabel="One guest fewer"
              disabled={readOnly || visit.busy || guests <= 0}
              icon="minus"
              onPress={() => changeGuests(-1)}
              size={14}
            />
            <Text style={[styles.contextText, { color: palette.onSurface }]}>
              <MaterialCommunityIcons name="account-multiple-outline" size={14} /> {guests}
            </Text>
            <IconButton
              accessibilityLabel="One more guest"
              disabled={readOnly || visit.busy}
              icon="plus"
              onPress={() => changeGuests(1)}
              size={14}
            />
          </View>
        </View>
        {session ? (
          // More actions than fit a phone's width: the row scrolls sideways.
          <ScrollView contentContainerStyle={styles.actionRow} horizontal showsHorizontalScrollIndicator={false}>
            <Button compact icon="clipboard-text-outline" mode="text" onPress={() => setRoundsOpen(true)}>
              Orders ({session.rounds.filter((round) => round.status !== "Cancelled").length})
            </Button>
            {session.rounds.some((round) => round.status !== "Cancelled") && !readOnly ? (
              <Button compact icon="receipt-text-outline" mode="text" onPress={() => setBillOpen(true)}>
                Bill
              </Button>
            ) : null}
            {serviceType?.requires_table && !readOnly ? (
              <>
                <Button compact disabled={visit.busy} mode="text" onPress={() => startTableAction("transfer")}>
                  Move
                </Button>
                <Button compact disabled={visit.busy} mode="text" onPress={() => startTableAction("join")}>
                  Join
                </Button>
              </>
            ) : null}
            <Button compact icon="plus" mode="text" onPress={startNewSale}>
              New sale
            </Button>
          </ScrollView>
        ) : null}
        {session?.preparation_status ? (
          <Text style={[styles.contextMuted, styles.readOnly, { color: palette.onSurfaceMuted }]}>
            Kitchen: {session.preparation_status}
          </Text>
        ) : null}
        {readOnly ? (
          <Text style={[styles.contextMuted, styles.readOnly, { color: palette.warning }]}>
            This visit is {session?.status.toLowerCase()} and can no longer take orders.
          </Text>
        ) : null}
      </View>

      {showTablePicker ? (
        <>
          <TablePicker
            onCancel={
              tableAction ? () => setTableAction(null) : sell.needsTable ? undefined : () => setPickingTable(false)
            }
            onPick={pickTable}
            prompt={
              tableAction?.kind === "transfer"
                ? "Choose a free table to move this visit to"
                : tableAction?.kind === "join"
                  ? "Tap free tables to join them to this visit"
                  : `Choose a table for ${serviceType?.service_type_name ?? "this order"}`
            }
            selected={tableAction ? tableAction.selection : draft.table ? [draft.table] : []}
          />
          {tableAction ? (
            <View style={[styles.confirmBar, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
              <Text style={[styles.contextMuted, { color: palette.onSurface }]}>
                {tableAction.selection.length
                  ? `${tableAction.selection.length} table${tableAction.selection.length === 1 ? "" : "s"} selected`
                  : "No table selected"}
              </Text>
              <Button disabled={!tableAction.selection.length || visit.busy} loading={visit.busy} mode="contained" onPress={() => void saveTables()}>
                {tableAction.kind === "transfer" ? "Move here" : "Save tables"}
              </Button>
            </View>
          ) : null}
        </>
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
          {/* Switching service type, table or customer keeps the current menu (dimmed) until the new one arrives. */}
          <ProgressBar indeterminate style={styles.progress} visible={menu.isStale} />
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
            <View pointerEvents={menu.isStale ? "none" : "auto"} style={[styles.root, menu.isStale && styles.stale]}>
            <FlashList
              contentContainerStyle={styles.grid}
              data={items}
              // Cells are recycled: re-render them when quantities or busy state change.
              extraData={[sell.quantities, sell.pendingItem, sell.busy, readOnly]}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.item_code}
              ListEmptyComponent={
                <RestaurantPlaceholder icon="magnify" title={query ? "No matching items" : "Nothing on this menu"} />
              }
              numColumns={2}
              renderItem={({ item }) => (
                <View style={styles.cell}>
                <MenuItemCard
                  busy={sell.pendingItem === item.item_code}
                  currency={currency}
                  customizable={modifierGroupsFor(item).length > 0}
                  disabled={readOnly || sell.busy}
                  imageUrl={restaurant.profile.hide_images ? null : itemImageUrl(item.image, restaurant.connection.companyUrl)}
                  item={item}
                  onPress={() => tapItem(item)}
                  precision={precision}
                  quantity={sell.quantities.get(item.item_code) ?? 0}
                />
                </View>
              )}
            />
            </View>
          )}
        </>
      )}

      {count && !showTablePicker ? (
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
      {billOpen && session ? (
        <BillSheet
          onClose={() => setBillOpen(false)}
          onSettled={(settlement) => {
            setBillOpen(false);
            setSettled(settlement);
            draftStore.markOrdersChanged();
            void sessionResult.refresh();
          }}
          session={session}
        />
      ) : null}
      {settled ? (
        <Sheet
          description={`${settled.invoice.doctype} ${settled.invoice.name}`}
          footer={
            <>
              <Button disabled={Boolean(receipt.working)} loading={receipt.working === "share"} onPress={() => void receipt.share(settled.invoice)}>
                Share
              </Button>
              <Button
                disabled={Boolean(receipt.working)}
                icon="printer"
                loading={receipt.working === "print"}
                mode="outlined"
                onPress={() => void receipt.print(settled.invoice)}
              >
                Print
              </Button>
              <Button
                mode="contained"
                onPress={() => {
                  setSettled(null);
                  startNewSale();
                }}
              >
                New sale
              </Button>
            </>
          }
          onClose={() => {
            setSettled(null);
            startNewSale();
          }}
          title="Paid"
          visible
        >
          <Text style={[styles.contextText, { color: palette.onSurface }]}>
            {formatMoney(settled.invoice.totals.rounded_total || settled.invoice.totals.grand_total, currency, precision)} received.
            {settled.invoice.totals.change_amount ? ` Change: ${formatMoney(settled.invoice.totals.change_amount, currency, precision)}.` : ""}
          </Text>
          <Text style={[styles.contextMuted, { color: palette.onSurfaceMuted }]}>The tables are free for the next guests.</Text>
          {receipt.error ? <Text style={{ color: palette.error }}>{receipt.error}</Text> : null}
        </Sheet>
      ) : null}
      {showRounds && session ? (
        <RoundsSheet
          busy={visit.busy}
          canCancel={!readOnly && !session.rounds.some((round) => round.status !== "Cancelled")}
          currency={currency}
          onAssignWaiter={() => setWaiterOpen(true)}
          onCancelVisit={cancelVisit}
          onClose={closeRounds}
          onOpenTicket={(name) => {
            closeRounds();
            setTicket(name);
          }}
          precision={precision}
          session={session}
        />
      ) : null}
      {waiterOpen && session ? (
        <Sheet onClose={() => setWaiterOpen(false)} title="Assign waiter" visible>
          {(session.available_waiters ?? []).map((user) => (
            <Button
              disabled={visit.busy}
              icon={user.name === session.waiter ? "check" : undefined}
              key={user.name}
              mode={user.name === session.waiter ? "contained-tonal" : "outlined"}
              onPress={() => {
                setWaiterOpen(false);
                if (user.name !== session.waiter) void visit.setWaiter(user.name);
              }}
            >
              {user.full_name || user.name}
            </Button>
          ))}
        </Sheet>
      ) : null}
      {customerOpen ? (
        <CustomerPickerSheet
          onClose={() => setCustomerOpen(false)}
          onPick={(customer) => {
            setCustomerOpen(false);
            if (session) void visit.setCustomer(customer.customer);
            else sell.setDraftCustomer(customer);
          }}
        />
      ) : null}
      {ticket ? <KitchenTicketSheet name={ticket} onClose={() => setTicket(null)} /> : null}
      {variantsFor ? (
        <VariantPickerSheet
          currency={currency}
          error={variantsFor.error}
          itemName={variantsFor.item.item_name}
          loading={variantsFor.loading}
          onClose={() => {
            variantRequest.current += 1;
            setVariantsFor(null);
          }}
          onPick={(variant) => {
            setVariantsFor(null);
            tapItem({ ...variant, has_variants: false, menu_category: variantsFor.item.menu_category });
          }}
          precision={precision}
          variants={variantsFor.variants}
        />
      ) : null}
      {customizing ? (
        <ModifierPickerSheet
          currency={currency}
          groups={customizing.groups}
          itemName={customizing.item.item_name}
          onClose={() => setCustomizing(null)}
          onConfirm={(choices) => {
            const item = customizing.item;
            setCustomizing(null);
            void sell.addItem(item, choices);
          }}
          precision={precision}
        />
      ) : null}
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
  // FlashList has no column gap: each cell pads half the gap on every side.
  cell: { flex: 1, padding: spacing.sm / 2 },
  confirmBar: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  customerChip: { flexShrink: 1 },
  guests: { alignItems: "center", flexDirection: "row", marginLeft: "auto" },
  shrink: { flexShrink: 1 },
  actionRow: { alignItems: "center", gap: 2, paddingHorizontal: spacing.xs },
  context: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing.xs },
  contextMuted: { flex: 1, fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  contextRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md },
  contextText: { fontFamily: typography.fontFamily.medium, fontSize: typography.size.small },
  grid: { padding: spacing.md - spacing.sm / 2, paddingBottom: 96 },
  readOnly: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  progress: { height: 2 },
  root: { flex: 1 },
  stale: { opacity: 0.5 },
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
