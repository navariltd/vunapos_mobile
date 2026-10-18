import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppUpdate } from "@/features/appUpdates/AppUpdateProvider";
import { useAppearance } from "@/theme/AppearanceProvider";
import { spacing } from "@/theme/tokens";

export function AppUpdateSheet() {
  const { availableRelease, dismissReadyUpdate, error, installUpdate, isCheckoutActive, isReadyUpdateDismissed, status } = useAppUpdate();
  const { palette } = useAppearance();
  const insets = useSafeAreaInsets();
  const visible = status === "ready" && Boolean(availableRelease) && !isCheckoutActive && !isReadyUpdateDismissed;
  if (!availableRelease) return null;

  const notes = availableRelease.releaseNotes
    .split("\n")
    .map((note) => note.replace(/^[\s•*-]+/, "").trim())
    .filter(Boolean);

  return (
    <Modal animationType="slide" onRequestClose={dismissReadyUpdate} transparent visible={visible}>
      <View style={[styles.scrim, { backgroundColor: palette.scrim }]}>
        <Pressable accessibilityLabel="Install update later" onPress={dismissReadyUpdate} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { backgroundColor: palette.surface, borderColor: palette.border, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={[styles.handle, { backgroundColor: palette.border }]} />
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: palette.surfaceContainerHigh }]}>
              <MaterialCommunityIcons color={palette.primary} name="download-circle-outline" size={28} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: palette.onSurface }]}>Update ready</Text>
              <Text style={[styles.subtitle, { color: palette.onSurfaceMuted }]}>VunaPOS {availableRelease.versionName} is ready to install.</Text>
            </View>
          </View>
          {notes.length ? (
            <ScrollView contentContainerStyle={styles.notes} style={styles.notesScroll}>
              <Text style={[styles.notesTitle, { color: palette.onSurfaceMuted }]}>WHAT’S NEW</Text>
              {notes.map((note, index) => (
                <View key={`${note}-${index}`} style={styles.noteRow}>
                  <View style={[styles.bullet, { backgroundColor: palette.primary }]} />
                  <Text style={[styles.note, { color: palette.onSurface }]}>{note}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
          {error ? <Text style={[styles.error, { color: palette.error }]}>{error}</Text> : null}
          <Pressable accessibilityLabel="Install update" onPress={() => void installUpdate()} style={[styles.install, { backgroundColor: palette.primary }]}>
            <MaterialCommunityIcons color={palette.onPrimary} name="download" size={18} />
            <Text style={[styles.installLabel, { color: palette.onPrimary }]}>Install Update</Text>
          </Pressable>
          <Pressable accessibilityLabel="Install update later" onPress={dismissReadyUpdate} style={styles.later}>
            <Text style={[styles.laterLabel, { color: palette.primary }]}>Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  handle: { alignSelf: "center", borderRadius: 4, height: 4, marginBottom: spacing.lg, width: 40 },
  header: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  icon: { alignItems: "center", borderRadius: 18, height: 56, justifyContent: "center", width: 56 },
  copy: { flex: 1 },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 18 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, marginTop: 2 },
  notesScroll: { maxHeight: 150, marginTop: spacing.lg },
  notes: { gap: spacing.sm },
  notesTitle: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.8 },
  noteRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  bullet: { borderRadius: 4, height: 6, marginTop: 7, width: 6 },
  note: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  error: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18, marginTop: spacing.md },
  install: { alignItems: "center", borderRadius: 14, flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginTop: spacing.lg, minHeight: 50 },
  installLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  later: { alignItems: "center", justifyContent: "center", marginTop: spacing.sm, minHeight: 44 },
  laterLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
