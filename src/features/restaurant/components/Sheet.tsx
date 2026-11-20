import { PropsWithChildren, ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { IconButton, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/** A bottom sheet for pickers and confirmations: title, scrolling body, fixed footer. */
export function Sheet({
  visible,
  title,
  description,
  footer,
  onClose,
  children,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
}>) {
  const { palette } = useAppearance();
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={[styles.scrim, { backgroundColor: palette.scrim }]} />
        <View style={[styles.panel, { backgroundColor: palette.background, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.header}>
            <View style={styles.titles}>
              <Text style={[styles.title, { color: palette.onSurface }]}>{title}</Text>
              {description ? <Text style={[styles.description, { color: palette.onSurfaceMuted }]}>{description}</Text> : null}
            </View>
            <IconButton accessibilityLabel="Close" icon="close" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  description: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small, lineHeight: typography.lineHeight.compact },
  fill: { flex: 1, justifyContent: "flex-end" },
  footer: { flexDirection: "row", gap: spacing.xs, justifyContent: "flex-end", paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  header: { alignItems: "flex-start", flexDirection: "row", paddingLeft: spacing.md, paddingTop: spacing.xs },
  panel: { borderTopLeftRadius: radii.lg * 1.5, borderTopRightRadius: radii.lg * 1.5, maxHeight: "88%" },
  scrim: { ...StyleSheet.absoluteFill },
  title: { fontFamily: typography.fontFamily.semibold, fontSize: 18 },
  titles: { flex: 1, gap: 2, paddingTop: spacing.sm },
});
