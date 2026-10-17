import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";

import { PosCacheStatus } from "@/features/pos/components/PosCacheStatus";
import { useToast } from "@/components/feedback/ToastProvider";
import { PosInvoiceFiltersSheet } from "@/features/pos/components/PosInvoiceFiltersSheet";
import { PosInvoiceListItem } from "@/features/pos/components/PosInvoiceListItem";
import { formatPosCurrency } from "@/features/pos/currency";
import { usePosBootstrap } from "@/features/pos/hooks/usePosBootstrap";
import { usePosHeldInvoices } from "@/features/pos/hooks/usePosHeldInvoices";
import { usePosInvoiceHistory } from "@/features/pos/hooks/usePosInvoiceHistory";
import {
  PosHeldInvoice,
  PosInvoiceHistoryFilters,
  PosInvoiceHistoryRow,
  PosInvoiceListRow,
} from "@/features/pos/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { useNetworkStatus } from "@/services/NetworkStatusProvider";
import { AppPalette, radii, spacing, typography } from "@/theme/tokens";

const initialFilters: PosInvoiceHistoryFilters = {
  currentShift: true,
  customer: "",
  documentType: "Invoice",
  fromDate: "",
  invoice: "",
  paymentMode: "",
  saleType: "",
  status: "",
  toDate: "",
};

function formatPostedAt(row: PosInvoiceHistoryRow) {
  const date = row.posting_date
    ? row.posting_date.split("-").reverse().join("/")
    : "-";
  const time = row.posting_time?.split(".")[0]?.slice(0, 5);
  return time ? `${date} · ${time}` : date;
}

function toListRow(row: PosInvoiceHistoryRow): PosInvoiceListRow {
  return {
    cashier: row.vunapos_session_cashier,
    creditSale: Boolean(row.vunapos_credit_sale),
    currency: row.currency,
    customerId: row.customer,
    customerName: row.customer_name || row.customer || "No customer",
    doctype: row.doctype,
    dueDate: row.due_date,
    invoiceNumber: row.name,
    itemCount: row.total_qty,
    openingEntry: row.vunapos_opening_entry,
    outstandingAmount: row.outstanding_amount,
    payments: row.payments,
    paymentMode: row.payments.length
      ? row.payments.map((payment) => payment.mode_of_payment).join(" · ")
      : row.vunapos_credit_sale
        ? "No deposit"
        : "No payment rows",
    postedAt: formatPostedAt(row),
    status: row.status,
    total: row.rounded_total || row.grand_total,
    workflowEnabled: Boolean(row.workflow_enabled),
    workflowState: row.workflow_state,
  };
}

type DocumentTabProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function DocumentTab({ active, label, onPress }: DocumentTabProps) {
  const { palette } = useAppearance();
  const styles = createStyles(palette);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.documentTab, active && styles.documentTabActive]}
    >
      <Text
        style={[
          styles.documentTabLabel,
          { color: active ? palette.primary : palette.onSurfaceMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
};

function SummaryCard({ label, value }: SummaryCardProps) {
  const { palette } = useAppearance();
  const styles = createStyles(palette);
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}

type HistorySummaryDialogProps = {
  documentLabel: "Invoices" | "Orders";
  onDismiss: () => void;
  summary: {
    credit_outstanding: number;
    credit_sales: number;
    gross_sales: number;
    invoice_count: number;
    outstanding: number;
    returns: number;
  };
  visible: boolean;
  formatCurrency: (amount: number) => string;
};

function HistorySummaryDialog({
  documentLabel,
  formatCurrency,
  onDismiss,
  summary,
  visible,
}: HistorySummaryDialogProps) {
  const { palette } = useAppearance();
  const styles = createStyles(palette);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      transparent
      visible={visible}
    >
      <View accessibilityViewIsModal style={styles.summaryDialogOverlay}>
        <Pressable
          accessibilityLabel="Dismiss sales summary"
          onPress={onDismiss}
          style={styles.summaryDialogScrim}
        />
        <View style={styles.summaryDialog}>
          <View style={styles.summaryDialogHeader}>
            <Text style={styles.summaryDialogTitle}>
              {documentLabel} summary
            </Text>
            <Pressable
              accessibilityLabel="Close sales summary"
              hitSlop={8}
              onPress={onDismiss}
              style={styles.summaryDialogCloseButton}
            >
              <Text style={styles.summaryDialogCloseLabel}>×</Text>
            </Pressable>
          </View>
          <View style={styles.summaryGrid}>
            <SummaryCard
              label={documentLabel}
              value={String(summary.invoice_count)}
            />
            <SummaryCard
              label="Gross sales"
              value={formatCurrency(summary.gross_sales)}
            />
            <SummaryCard
              label="Returns"
              value={formatCurrency(summary.returns)}
            />
            {documentLabel === "Invoices" ? (
              <SummaryCard
                label="Outstanding"
                value={formatCurrency(summary.outstanding)}
              />
            ) : null}
            <SummaryCard
              label="Credit sales"
              value={formatCurrency(summary.credit_sales)}
            />
            {documentLabel === "Invoices" ? (
              <SummaryCard
                label="Credit outstanding"
                value={formatCurrency(summary.credit_outstanding)}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

type PosInvoicesScreenProps = {
  heldRefreshKey?: number;
  /** Retained for call-site compatibility; Home navigation is used instead. */
  onBackToPos?: () => void;
  onOpenInvoice: (invoice: { doctype?: string; name: string }) => void;
  onRestoreHeld: (invoice: PosHeldInvoice) => Promise<void>;
  onCheckoutHeld?: (invoice: PosHeldInvoice) => Promise<void>;
};

function formatModified(value?: string | null) {
  if (!value) return "Modified recently";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

export function PosInvoicesScreen({
  heldRefreshKey = 0,
  onOpenInvoice,
  onRestoreHeld,
  onCheckoutHeld,
}: PosInvoicesScreenProps) {
  const { palette } = useAppearance();
  const toast = useToast();
  const { connectionStatus } = useNetworkStatus();
  const styles = createStyles(palette);
  const [activeTab, setActiveTab] = useState<"history" | "held">("history");
  const [filters, setFilters] =
    useState<PosInvoiceHistoryFilters>(initialFilters);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [draftFilters, setDraftFilters] =
    useState<PosInvoiceHistoryFilters>(initialFilters);
  const [start, setStart] = useState(0);
  const bootstrap = usePosBootstrap({
    manageFreshness: false,
  });
  const lockedOrderType =
    bootstrap.data?.pos_profile.allow_order_type_change === false
      ? bootstrap.data.pos_profile.default_order_type === "Sales Order"
        ? "Order"
        : "Invoice"
      : null;
  function allowedDocumentType(
    documentType: PosInvoiceHistoryFilters["documentType"],
  ) {
    if (lockedOrderType === "Invoice") return "Invoice";
    if (lockedOrderType === "Order") {
      return documentType === "Draft Order" ? "Draft Order" : "Order";
    }
    return documentType;
  }
  const historyFilters =
    filters.documentType === allowedDocumentType(filters.documentType)
      ? filters
      : { ...filters, documentType: allowedDocumentType(filters.documentType) };
  const visibleActiveTab =
    lockedOrderType === "Order" && activeTab === "held"
      ? "history"
      : activeTab;
  const history = usePosInvoiceHistory({
    filters: historyFilters,
    posProfile: bootstrap.data?.pos_profile.name,
    start,
  });
  const held = usePosHeldInvoices({
    enabled: visibleActiveTab === "held",
    posProfile: bootstrap.data?.pos_profile.name,
    refreshKey: heldRefreshKey,
  });
  const currency = bootstrap.data?.pos_profile.currency ?? "KES";
  const currencyPrecision = bootstrap.data?.pos_profile.currency_precision ?? 2;
  const formatCurrency = (amount: number, amountCurrency = currency) =>
    formatPosCurrency(amount, amountCurrency, currencyPrecision);
  const invoiceRows = useMemo(
    () => history.data?.invoices.map(toListRow) ?? [],
    [history.data],
  );
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoringName, setRestoringName] = useState<string | null>(null);
  const isOffline = connectionStatus !== "online";
  const reloadHeld = held.reload;
  const reloadHistory = history.reload;
  const refreshActiveTab = useCallback(async () => {
    if (visibleActiveTab === "held") await reloadHeld();
    else await reloadHistory();
  }, [reloadHeld, reloadHistory, visibleActiveTab]);

  function updateFilter<Key extends keyof PosInvoiceHistoryFilters>(
    field: Key,
    value: PosInvoiceHistoryFilters[Key],
  ) {
    setFilters((current) => {
      const next = {
        ...current,
        [field]: value,
        ...(field === "documentType" ? { status: "" } : {}),
      } as PosInvoiceHistoryFilters;
      return {
        ...next,
        documentType: allowedDocumentType(next.documentType),
      };
    });
    setStart(0);
  }

  function updateDraftFilter<Key extends keyof PosInvoiceHistoryFilters>(
    field: Key,
    value: PosInvoiceHistoryFilters[Key],
  ) {
    setDraftFilters((current) => {
      const next = { ...current, [field]: value } as PosInvoiceHistoryFilters;
      return {
        ...next,
        documentType: allowedDocumentType(next.documentType),
      };
    });
  }

  function openFilterSheet() {
    setDraftFilters(historyFilters);
    setFilterSheetVisible(true);
  }

  function applyFilters() {
    setFilters({
      ...draftFilters,
      documentType: allowedDocumentType(draftFilters.documentType),
    });
    setStart(0);
    setFilterSheetVisible(false);
  }

  function clearFilters() {
    const clearedFilters = {
      ...initialFilters,
      documentType: historyFilters.documentType,
    };
    setDraftFilters(clearedFilters);
    setFilters(clearedFilters);
    setStart(0);
    setFilterSheetVisible(false);
  }

  async function restoreHeld(invoice: PosHeldInvoice) {
    setRestoreError(null);
    setRestoringName(invoice.name);
    try {
      await onRestoreHeld(invoice);
    } catch (error) {
      setRestoreError(
        error instanceof Error
          ? error.message
          : "Could not restore this held invoice.",
      );
    } finally {
      setRestoringName(null);
    }
  }

  async function checkoutHeld(invoice: PosHeldInvoice) {
    if (!onCheckoutHeld) return;
    setRestoreError(null);
    setRestoringName(invoice.name);
    try {
      await onCheckoutHeld(invoice);
    } catch (error) {
      setRestoreError(
        error instanceof Error
          ? error.message
          : "Could not open this draft for checkout.",
      );
    } finally {
      setRestoringName(null);
    }
  }

  const historyError = bootstrap.error ?? history.error;
  const heldError = bootstrap.error ?? held.error ?? restoreError;
  useEffect(() => {
    const message = historyError || heldError;
    if (message) {
      toast.error(message, {
        title: "Could not load invoices",
        dedupeKey: `invoices-error:${message}`,
      });
    }
  }, [heldError, historyError, toast]);
  const activeFilterCount = [
    historyFilters.customer,
    historyFilters.fromDate,
    historyFilters.invoice,
    historyFilters.paymentMode,
    historyFilters.saleType,
    historyFilters.status,
    historyFilters.toDate,
    historyFilters.currentShift ? "" : "currentShift",
  ].filter(Boolean).length;
  const summaryDocumentLabel =
    historyFilters.documentType === "Invoice" ? "Invoices" : "Orders";
  const canViewSummary =
    historyFilters.documentType === "Invoice" ||
    historyFilters.documentType === "Order";
  const showInvoiceTabs = lockedOrderType !== "Order";
  const showOrderTabs = lockedOrderType !== "Invoice";

  const tabs = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.documentTabsScroll}
      testID="sales-document-tabs"
    >
      <View accessibilityRole="tablist" style={styles.documentTabs}>
        {showInvoiceTabs ? (
          <>
            <DocumentTab
              active={
                visibleActiveTab === "history" &&
                historyFilters.documentType === "Invoice"
              }
              label="Invoices history"
              onPress={() => {
                setActiveTab("history");
                updateFilter("documentType", "Invoice");
              }}
            />
            <DocumentTab
              active={visibleActiveTab === "held"}
              label="Draft invoices"
              onPress={() => setActiveTab("held")}
            />
          </>
        ) : null}
        {showOrderTabs ? (
          <>
            <DocumentTab
              active={
                visibleActiveTab === "history" &&
                historyFilters.documentType === "Order"
              }
              label="Orders history"
              onPress={() => {
                setActiveTab("history");
                updateFilter("documentType", "Order");
              }}
            />
            <DocumentTab
              active={
                visibleActiveTab === "history" &&
                historyFilters.documentType === "Draft Order"
              }
              label="Draft orders"
              onPress={() => {
                setActiveTab("history");
                updateFilter("documentType", "Draft Order");
              }}
            />
          </>
        ) : null}
      </View>
    </ScrollView>
  );

  if (visibleActiveTab === "held") {
    const heldError = bootstrap.error ?? held.error ?? restoreError;
    return (
      <FlatList
        contentContainerStyle={styles.content}
        data={held.data ?? []}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyExtractor={(invoice) => `${invoice.doctype}-${invoice.name}`}
        ListEmptyComponent={
          bootstrap.isLoading || held.isLoading ? (
            <Text style={styles.emptyState}>
              {bootstrap.isLoading
                ? "Loading POS workspace…"
                : "Loading held invoices…"}
            </Text>
          ) : heldError ? null : (
            <Text style={styles.emptyState}>
              No draft invoices are currently held.
            </Text>
          )
        }
        ListFooterComponent={
          <PosCacheStatus
            isOffline={isOffline}
            isRefreshing={held.isRefreshing}
            isStale={held.isStale}
            lastUpdated={held.lastUpdated}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>
                Sales history
              </Text>
              <Text style={styles.subtitle}>
                Review draft invoices and continue editing or checkout.
              </Text>
            </View>
            {tabs}
            <View style={styles.heldSummaryRow}>
              <Text style={styles.filterSummary}>
                {held.data?.length
                  ? `${held.data.length} waiting`
                  : "No held invoices"}
              </Text>
              <Pressable
                accessibilityLabel="Refresh held invoices"
                disabled={Boolean(held.isLoading || held.isRefreshing)}
                onPress={() => void held.reload()}
                style={[
                  styles.filtersButton,
                  (held.isLoading || held.isRefreshing) &&
                    styles.paginationButtonDisabled,
                ]}
              >
                <Text style={styles.filtersButtonLabel}>
                  {held.isLoading || held.isRefreshing
                    ? "Refreshing…"
                    : "Refresh"}
                </Text>
              </Pressable>
            </View>
            {heldError ? (
              <View style={styles.errorNotice}>
                <Text style={styles.errorText}>{heldError}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Open ${item.name}`}
            onPress={() =>
              onOpenInvoice({ doctype: item.doctype, name: item.name })
            }
            style={styles.heldInvoiceCard}
          >
            <View style={styles.heldInvoiceMain}>
              <Text numberOfLines={1} style={styles.heldInvoiceName}>
                {item.name}
              </Text>
              <Text numberOfLines={1} style={styles.heldInvoiceCustomer}>
                {item.customer_name || item.customer || "No customer"}
              </Text>
              <Text style={styles.heldInvoiceModified}>
                {formatModified(item.modified)}
              </Text>
            </View>
            <View style={styles.heldInvoiceAside}>
              <Text style={styles.heldInvoiceTotal}>
                {formatCurrency(
                  Number(
                    item.total ?? item.rounded_total ?? item.grand_total ?? 0,
                  ),
                  item.currency || currency,
                )}
              </Text>
              <View style={styles.draftActions}>
                <Pressable
                  accessibilityLabel={`Edit ${item.name}`}
                  disabled={Boolean(restoringName)}
                  onPress={(event) => {
                    event.stopPropagation();
                    void restoreHeld(item);
                  }}
                  style={[
                    styles.restoreButton,
                    restoringName && styles.paginationButtonDisabled,
                  ]}
                >
                  <Text style={styles.restoreButtonLabel}>
                    {restoringName === item.name ? "Opening…" : "Edit"}
                  </Text>
                </Pressable>
                {onCheckoutHeld ? (
                  <Pressable
                    accessibilityLabel={`Checkout ${item.name}`}
                    disabled={Boolean(restoringName)}
                    onPress={(event) => {
                      event.stopPropagation();
                      void checkoutHeld(item);
                    }}
                    style={styles.checkoutDraftButton}
                  >
                    <Text style={styles.checkoutDraftButtonLabel}>Checkout</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
        refreshControl={
          <RefreshControl
            colors={[palette.primary]}
            onRefresh={() => void refreshActiveTab()}
            refreshing={Boolean(held.isRefreshing)}
            tintColor={palette.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <View style={styles.historyPage}>
      <FlatList
        contentContainerStyle={[styles.content, styles.historyContent]}
        data={invoiceRows}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyExtractor={(invoice) => invoice.invoiceNumber}
        ListEmptyComponent={
          bootstrap.isLoading || history.isLoading ? (
            <Text style={styles.emptyState}>
              {bootstrap.isLoading
                ? "Loading POS workspace…"
                : "Loading invoice history…"}
            </Text>
          ) : historyError ? null : (
            <Text style={styles.emptyState}>
              No {historyFilters.documentType === "Invoice" ? "invoices" : "orders"}{" "}
              match these filters.
            </Text>
          )
        }
        ListFooterComponent={
          history.data ? (
            <PosCacheStatus
              isOffline={isOffline}
              isRefreshing={history.isRefreshing}
              isStale={history.isStale}
              lastUpdated={history.lastUpdated}
            />
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>
                Sales history
              </Text>
              <Text style={styles.subtitle}>
                {historyFilters.documentType === "Draft Order"
                  ? "Review Sales Orders awaiting workflow approval."
                  : "Review completed sales from this POS workspace."}
              </Text>
            </View>
            {tabs}

            <View style={styles.filterActionRow}>
              {canViewSummary && history.data ? (
                <View style={styles.summaryActionRow}>
                  <Pressable
                    accessibilityLabel="View sales summary"
                    onPress={() => setSummaryVisible(true)}
                    style={styles.summaryLink}
                  >
                    <Text style={styles.summaryLinkLabel}>View Summary</Text>
                  </Pressable>
                  {activeFilterCount ? (
                    <Text style={styles.filterSummary}>
                      {activeFilterCount} active filter
                      {activeFilterCount === 1 ? "" : "s"}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.filterSummary}>
                  {activeFilterCount
                    ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                    : `All ${summaryDocumentLabel.toLowerCase()} in this shift`}
                </Text>
              )}
              <Pressable
                accessibilityLabel="Open invoice filters"
                onPress={openFilterSheet}
                style={styles.filtersButton}
              >
                <Text style={styles.filtersButtonLabel}>
                  {activeFilterCount
                    ? `Filters (${activeFilterCount})`
                    : "Filters"}
                </Text>
              </Pressable>
            </View>

            {historyError ? (
              <View style={styles.errorNotice}>
                <Text style={styles.errorText}>{historyError}</Text>
              </View>
            ) : null}
            {history.isRefreshing && history.data ? (
              <Text style={styles.refreshingText}>
                Refreshing invoice history…
              </Text>
            ) : null}

          </View>
        }
        renderItem={({ item }) => (
          <PosInvoiceListItem
            compactDraftOrder={historyFilters.documentType === "Draft Order"}
            currencyPrecision={currencyPrecision}
            invoice={item}
            onPress={() =>
              onOpenInvoice({ doctype: item.doctype, name: item.invoiceNumber })
            }
          />
        )}
        refreshControl={
          <RefreshControl
            colors={[palette.primary]}
            onRefresh={() => void refreshActiveTab()}
            refreshing={Boolean(history.isRefreshing)}
            tintColor={palette.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      {history.data ? (
        <View style={styles.stickyPagination} testID="sales-history-pagination">
          <Pressable
            disabled={start === 0}
            onPress={() => setStart((current) => Math.max(0, current - 25))}
            style={[
              styles.stickyPaginationButton,
              start === 0 && styles.paginationButtonDisabled,
            ]}
          >
            <Text style={styles.stickyPaginationLabel}>Previous</Text>
          </Pressable>
          <Pressable
            disabled={!history.data.has_more}
            onPress={() => setStart((current) => current + 25)}
            style={[
              styles.stickyPaginationButton,
              !history.data.has_more && styles.paginationButtonDisabled,
            ]}
          >
            <Text style={styles.stickyPaginationLabel}>Next</Text>
          </Pressable>
        </View>
      ) : null}
      <PosInvoiceFiltersSheet
        documentType={historyFilters.documentType}
        filters={draftFilters}
        onApply={applyFilters}
        onChange={updateDraftFilter}
        onClear={clearFilters}
        onDismiss={() => setFilterSheetVisible(false)}
        paymentModes={
          bootstrap.data?.payment_modes.map(
            (payment) => payment.mode_of_payment,
          ) ?? []
        }
        visible={filterSheetVisible}
      />
      {history.data && canViewSummary ? (
        <HistorySummaryDialog
          documentLabel={summaryDocumentLabel}
          formatCurrency={formatCurrency}
          onDismiss={() => setSummaryVisible(false)}
          summary={history.data.summary}
          visible={summaryVisible}
        />
      ) : null}
    </View>
  );
}

function createStyles(palette: AppPalette) {
  return StyleSheet.create({
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    documentTabs: {
      borderBottomColor: palette.border,
      borderBottomWidth: 1,
      flexDirection: "row",
    },
    documentTabsScroll: { flexGrow: 0 },
    emptyState: {
      color: palette.onSurfaceMuted,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.body,
      paddingTop: spacing.xxl,
      textAlign: "center",
    },
    errorNotice: {
      backgroundColor: palette.errorSurface,
      borderColor: palette.error,
      borderRadius: radii.md,
      borderWidth: 1,
      padding: spacing.sm,
    },
    errorText: {
      color: palette.error,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.small,
      lineHeight: typography.lineHeight.body,
    },
    historyContent: { paddingBottom: spacing.xxxl * 2 },
    historyPage: { flex: 1 },
    documentTab: {
      borderBottomWidth: 2,
      flexShrink: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    documentTabActive: {
      borderBottomColor: palette.primary,
    },
    documentTabLabel: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.small,
    },
    filterActionRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    filterSummary: {
      color: palette.onSurfaceMuted,
      flex: 1,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.small,
    },
    filtersButton: {
      alignItems: "center",
      borderColor: palette.border,
      borderRadius: radii.md,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 38,
      paddingHorizontal: spacing.md,
    },
    filtersButtonLabel: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.small,
    },
    header: {
      gap: spacing.md,
      paddingBottom: spacing.lg,
    },
    heldInvoiceAside: {
      alignItems: "flex-end",
      gap: spacing.sm,
    },
    draftActions: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    checkoutDraftButton: {
      backgroundColor: palette.primary,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    checkoutDraftButtonLabel: {
      color: palette.onPrimary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.tiny,
    },
    heldInvoiceCard: {
      backgroundColor: palette.surfaceContainer,
      borderColor: palette.border,
      borderRadius: radii.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      padding: spacing.md,
    },
    heldInvoiceCustomer: {
      color: palette.onSurfaceMuted,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.small,
    },
    heldInvoiceMain: { flex: 1, gap: 3 },
    heldInvoiceModified: {
      color: palette.onSurfaceMuted,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.tiny,
    },
    heldInvoiceName: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.small,
    },
    heldInvoiceTotal: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.small,
    },
    heldSummaryRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    heading: {
      gap: 4,
    },
    stickyPagination: {
      bottom: spacing.md,
      flexDirection: "row",
      gap: spacing.xs,
      position: "absolute",
      right: spacing.md,
    },
    stickyPaginationButton: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: radii.md,
      borderWidth: 1,
      minHeight: 36,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    paginationButtonDisabled: {
      opacity: 0.4,
    },
    stickyPaginationLabel: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.tiny,
    },
    refreshingText: {
      color: palette.onSurfaceMuted,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.tiny,
    },
    restoreButton: {
      backgroundColor: palette.primary,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    restoreButtonLabel: {
      color: palette.onPrimary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.tiny,
    },
    separator: {
      height: spacing.sm,
    },
    subtitle: {
      color: palette.onSurfaceMuted,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.small,
      lineHeight: typography.lineHeight.body,
    },
    summaryCard: {
      backgroundColor: palette.surfaceContainer,
      borderColor: palette.border,
      borderRadius: radii.md,
      borderWidth: 1,
      flexBasis: "48%",
      flexGrow: 1,
      gap: 2,
      padding: spacing.sm,
    },
    summaryDialog: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.md,
      marginHorizontal: spacing.lg,
      padding: spacing.md,
    },
    summaryActionRow: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.sm,
    },
    summaryDialogCloseButton: {
      alignItems: "center",
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    summaryDialogCloseLabel: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.regular,
      fontSize: 24,
      lineHeight: 28,
    },
    summaryDialogHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    summaryDialogOverlay: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
    },
    summaryDialogScrim: {
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      ...StyleSheet.absoluteFill,
    },
    summaryDialogTitle: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
    },
    summaryLink: {
      paddingVertical: spacing.xs,
    },
    summaryLinkLabel: {
      color: palette.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.small,
    },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    summaryLabel: {
      color: palette.onSurfaceMuted,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.tiny,
    },
    summaryValue: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
    },
    title: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 16,
      lineHeight: typography.lineHeight.body,
    },
  });
}
