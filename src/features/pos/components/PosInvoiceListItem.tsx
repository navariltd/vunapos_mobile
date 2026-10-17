import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { formatPosCurrency } from "@/features/pos/currency";
import { getPosStatusPresentation, PosStatusTone } from "@/features/pos/status";
import { PosInvoiceListRow } from "@/features/pos/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { AppPalette, radii, spacing, typography } from "@/theme/tokens";

type PosInvoiceListItemProps = {
  compactSalesOrder?: boolean;
  currencyPrecision?: number;
  invoice: PosInvoiceListRow;
  onPress: () => void;
};

function createStatusStyles(
  palette: AppPalette,
): Record<PosStatusTone, { backgroundColor: string; color: string }> {
  return {
    neutral: {
      backgroundColor: palette.surfaceContainerHigh,
      color: palette.onSurface,
    },
    workflow: { backgroundColor: palette.primary, color: palette.onPrimary },
    error: { backgroundColor: palette.errorSurface, color: palette.error },
    success: { backgroundColor: palette.surfaceContainer, color: palette.success },
    warning: {
      backgroundColor: palette.warningSurface,
      color: palette.warning,
    },
  };
}

function paymentReference(
  transactionReference?: string,
  paymentRequest?: string,
) {
  return transactionReference || paymentRequest || null;
}

function formatDueDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatCompactPostedAt(value: string) {
  return value.replace(" · ", " ");
}

export function PosInvoiceListItem({
  compactSalesOrder = false,
  currencyPrecision = 2,
  invoice,
  onPress,
}: PosInvoiceListItemProps) {
  const { palette } = useAppearance();
  const styles = createStyles(palette);
  const status = getPosStatusPresentation({
    status: invoice.status,
    workflowEnabled: invoice.workflowEnabled,
    workflowState: invoice.workflowState,
  });
  const statusStyle = createStatusStyles(palette)[status.tone];
  const isSalesOrder = invoice.doctype === "Sales Order";
  const formatCurrency = (amount: number, currency = invoice.currency) =>
    formatPosCurrency(amount, currency, currencyPrecision);

  if (compactSalesOrder) {
    return (
      <Pressable
        accessibilityLabel={`Open ${invoice.invoiceNumber}`}
        onPress={onPress}
        style={[styles.card, styles.compactSalesOrderCard]}
      >
        <View style={styles.compactHeader}>
          <Text numberOfLines={1} style={styles.compactOrderNumber}>
            {invoice.invoiceNumber}
          </Text>
          <Text style={styles.metadata}>
            {formatCompactPostedAt(invoice.postedAt)}
          </Text>
        </View>

        <Text numberOfLines={1} style={styles.customer}>
          {invoice.customerName}
        </Text>

        <View style={styles.compactStatusRow}>
          <Text style={styles.compactStatusLabel}>Status:</Text>
          <Text style={styles.compactStatusValue}>{status.label}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>
            {formatCurrency(invoice.total, invoice.currency)}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityLabel={`Open ${invoice.invoiceNumber}`}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.titleRow}>
        <View style={styles.titleGroup}>
          <Text numberOfLines={1} style={styles.invoiceNumber}>
            {invoice.invoiceNumber}
          </Text>
          <Text numberOfLines={1} style={styles.customer}>
            {invoice.customerName}
          </Text>
          {invoice.customerId ? (
            <Text numberOfLines={1} style={styles.customerId}>
              {invoice.customerId}
            </Text>
          ) : null}
        </View>
        <View style={styles.badges}>
          {invoice.creditSale ? (
            <View style={styles.creditSaleBadge}>
              <Text style={styles.creditSaleLabel}>Credit sale</Text>
            </View>
          ) : null}
          <View style={[styles.status, statusStyle]}>
            <Text style={[styles.statusLabel, { color: statusStyle.color }]}>
              {status.label}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.metadataRow}>
        <Text style={styles.metadata}>{invoice.postedAt}</Text>
        <Text style={styles.metadata}>
          {invoice.itemCount} {invoice.itemCount === 1 ? "item" : "items"}
        </Text>
      </View>

      {invoice.creditSale && invoice.dueDate ? (
        <Text style={styles.dueDate}>Due {formatDueDate(invoice.dueDate)}</Text>
      ) : null}

      <View style={styles.auditRow}>
        <Text numberOfLines={1} style={styles.auditValue}>
          Cashier: {invoice.cashier || "Not recorded"}
        </Text>
        <Text numberOfLines={1} style={styles.auditValue}>
          Shift: {invoice.openingEntry || "No shift"}
        </Text>
      </View>

      <View style={styles.paymentLines}>
        {invoice.payments.length ? (
          invoice.payments.map((payment, index) => {
            const reference = paymentReference(
              payment.transaction_reference,
              payment.ke_payment_request,
            );
            return (
              <View
                key={`${payment.mode_of_payment}-${reference || index}`}
                style={styles.paymentLine}
              >
                <Text numberOfLines={1} style={styles.paymentMode}>
                  {payment.mode_of_payment}
                  {reference ? ` · ${reference}` : ""}
                </Text>
                <Text style={styles.paymentAmount}>
                  {formatCurrency(payment.amount, invoice.currency)}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.paymentMode}>{invoice.paymentMode}</Text>
        )}
      </View>

      <View style={styles.totalRow}>
        <View>
          <Text style={styles.totalLabel}>Total</Text>
          {!isSalesOrder && invoice.outstandingAmount > 0 ? (
            <Text style={styles.outstanding}>
              Outstanding{" "}
              {formatCurrency(invoice.outstandingAmount, invoice.currency)}
            </Text>
          ) : null}
        </View>
        <Text style={styles.total}>
          {formatCurrency(invoice.total, invoice.currency)}
        </Text>
      </View>
    </Pressable>
  );
}

function createStyles(palette: AppPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: radii.md,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    compactSalesOrderCard: {
      gap: spacing.xs,
    },
    compactHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    compactOrderNumber: {
      color: palette.onSurface,
      flex: 1,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      minWidth: 0,
    },
    compactStatusLabel: {
      color: palette.onSurfaceMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.tiny,
    },
    compactStatusRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    compactStatusValue: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.small,
    },
    auditRow: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    badges: {
      alignItems: "flex-end",
      gap: 4,
    },
    auditValue: {
      color: palette.onSurfaceMuted,
      flex: 1,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.tiny,
    },
    customer: {
      color: palette.onSurfaceMuted,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.small,
    },
    customerId: {
      color: palette.onSurfaceMuted,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.tiny,
    },
    creditSaleBadge: {
      backgroundColor: palette.surfaceContainerHigh,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    creditSaleLabel: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.tiny,
    },
    dueDate: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.tiny,
    },
    invoiceNumber: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
    },
    metadata: {
      color: palette.onSurfaceMuted,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.tiny,
    },
    metadataRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    paymentMode: {
      color: palette.onSurfaceMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.small,
    },
    paymentAmount: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.small,
    },
    paymentLine: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    paymentLines: {
      gap: 4,
    },
    outstanding: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.tiny,
      marginTop: 2,
    },
    status: {
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    statusLabel: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.tiny,
    },
    titleGroup: {
      flex: 1,
      gap: 2,
    },
    titleRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.sm,
    },
    total: {
      color: palette.onSurface,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 15,
    },
    totalLabel: {
      color: palette.onSurfaceMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.tiny,
    },
    totalRow: {
      alignItems: "center",
      borderTopColor: palette.border,
      borderTopWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: spacing.sm,
    },
  });
}
