import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { useInvoiceReceipt } from '@/features/pos/hooks/useInvoiceReceipt';
import { useAppearance } from '@/theme/AppearanceProvider';
import { AppPalette, radii, spacing, typography } from '@/theme/tokens';

type PosInvoiceReceiptActionsProps = {
  invoiceDoctype: string;
  invoiceName: string;
};

export function PosInvoiceReceiptActions({ invoiceDoctype, invoiceName }: PosInvoiceReceiptActionsProps) {
  const { palette } = useAppearance();
  const styles = createStyles(palette);
  const { activeAction, error, isWorking, printReceipt, shareReceipt } = useInvoiceReceipt();
  const request = { invoiceDoctype, invoiceName };

  return (
    <View style={styles.content}>
      <View style={styles.actions}>
        <Pressable accessibilityLabel="Print receipt" disabled={isWorking} onPress={() => void printReceipt(request)} style={[styles.action, isWorking && styles.actionDisabled]}>
          <MaterialCommunityIcons color={palette.onSurface} name="printer-outline" size={18} />
          {activeAction === 'print' ? (
            <ActivityIndicator color={palette.onSurface} size="small" testID="receipt-print-loading" />
          ) : (
            <Text style={styles.actionLabel}>Print receipt</Text>
          )}
        </Pressable>
        <Pressable accessibilityLabel="Share receipt" disabled={isWorking} onPress={() => void shareReceipt(request)} style={[styles.action, isWorking && styles.actionDisabled]}>
          <MaterialCommunityIcons color={palette.onSurface} name="share-variant-outline" size={18} />
          {activeAction === 'share' ? (
            <ActivityIndicator color={palette.onSurface} size="small" testID="receipt-share-loading" />
          ) : (
            <Text style={styles.actionLabel}>Share</Text>
          )}
        </Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function createStyles(palette: AppPalette) {
  return StyleSheet.create({
  action: { alignItems: 'center', borderColor: palette.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', minHeight: 42, paddingHorizontal: spacing.sm },
  actionDisabled: { opacity: 0.5 },
  actionLabel: { color: palette.onSurface, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.tiny },
  actions: { flexDirection: 'row', gap: spacing.sm },
  content: { gap: spacing.xs },
  error: { color: palette.error, fontFamily: typography.fontFamily.regular, fontSize: typography.size.tiny, lineHeight: typography.lineHeight.body },
  });
}
