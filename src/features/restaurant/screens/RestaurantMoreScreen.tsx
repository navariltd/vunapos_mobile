import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { ComponentProps, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { appUpdateConfig } from "@/config/updateConfig";
import { useAppUpdate } from "@/features/appUpdates/AppUpdateProvider";
import { useAppSession } from "@/features/auth/AppSessionProvider";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import { useNow } from "@/features/restaurant/hooks/useNow";
import { useSignedInUser } from "@/features/restaurant/hooks/useSignedInUser";
import { profileIdentity } from "@/features/restaurant/logic/profileIdentity";
import { restaurantRoleLabel } from "@/features/restaurant/logic/restaurantRoles";
import { timeSince } from "@/features/restaurant/logic/timeLabels";
import type { AppearancePreference } from "@/services/appearanceStore";
import { useAppearance } from "@/theme/AppearanceProvider";
import type { AppPalette } from "@/theme/tokens";
import { radii, spacing, typography } from "@/theme/tokens";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const APPEARANCE_OPTIONS: { icon: IconName; label: string; value: AppearancePreference }[] = [
  { icon: "brightness-6", label: "System", value: "system" },
  { icon: "white-balance-sunny", label: "Light", value: "light" },
  { icon: "weather-night", label: "Dark", value: "dark" },
];

/** Who is signed in, their workplace and shift, appearance, app version, and sign out. */
export function RestaurantMoreScreen() {
  const { palette, preference, setPreference } = useAppearance();
  const { signOut } = useAppSession();
  const restaurant = useRestaurant();
  const userId = useSignedInUser();
  const identity = profileIdentity(userId);
  const now = useNow();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const shiftOpen = restaurant.needsShift && restaurant.shiftReady;
  const shiftLabel = !restaurant.needsShift ? "Not required" : shiftOpen ? "Open" : "Not open";
  const shiftSince = shiftOpen ? timeSince(restaurant.shift?.opened_at, now) : null;
  const roles = restaurantRoleLabel(restaurant.roles).split(" · ");
  const version = Constants.expoConfig?.version ?? "—";

  async function confirmSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: palette.background }}>
      {/* Who is signed in */}
      <View style={[styles.card, styles.hero, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
          <Text style={[styles.avatarText, { color: palette.onPrimary }]}>{identity.initials}</Text>
        </View>
        <View style={styles.heroCopy}>
          <Text numberOfLines={1} style={[styles.heroName, { color: palette.onSurface }]}>
            {identity.name}
          </Text>
          {userId ? (
            <Text numberOfLines={1} style={[styles.muted, { color: palette.onSurfaceMuted }]}>
              {userId}
            </Text>
          ) : null}
          <View style={styles.chips}>
            {roles.map((role) => (
              <View key={role} style={[styles.chip, { backgroundColor: palette.surfaceContainerHigh }]}>
                <Text style={[styles.chipText, { color: palette.onSurface }]}>{role}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Shift */}
      <SectionLabel palette={palette}>SHIFT</SectionLabel>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.shiftRow}>
          <View style={[styles.iconWell, { backgroundColor: shiftOpen ? palette.success + "22" : palette.surfaceContainer }]}>
            <MaterialCommunityIcons
              color={shiftOpen ? palette.success : palette.onSurfaceMuted}
              name="cash-register"
              size={20}
            />
          </View>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: palette.onSurface }]}>Shift {shiftLabel.toLowerCase()}</Text>
            <Text numberOfLines={1} style={[styles.muted, { color: palette.onSurfaceMuted }]}>
              {shiftOpen
                ? [shiftSince, restaurant.shift?.opening_entry].filter(Boolean).join(" · ")
                : restaurant.needsShift
                  ? "Open a shift to start selling"
                  : "Kitchen staff work without a shift"}
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: shiftOpen ? palette.success : palette.disabled }]} />
        </View>
        {shiftOpen ? (
          <ActionRow
            icon="lock-clock"
            label="Close shift"
            onPress={() => router.navigate("/(restaurant)/close-shift")}
            palette={palette}
          />
        ) : null}
      </View>

      {/* Workplace */}
      <SectionLabel palette={palette}>WORKPLACE</SectionLabel>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <InfoRow
          icon="silverware-fork-knife"
          label="Restaurant"
          palette={palette}
          value={restaurant.settings.restaurant_name || restaurant.settings.restaurant}
        />
        <InfoRow icon="store-marker-outline" label="Branch" palette={palette} value={restaurant.settings.branch} />
        <InfoRow icon="tablet-cellphone" label="POS Profile" last palette={palette} value={restaurant.posProfile} />
      </View>

      {/* Appearance */}
      <SectionLabel palette={palette}>APPEARANCE</SectionLabel>
      <View style={styles.optionRow}>
        {APPEARANCE_OPTIONS.map((option) => {
          const selected = option.value === preference;
          const color = selected ? palette.onPrimary : palette.onSurface;
          return (
            <Pressable
              accessibilityLabel={`${option.label} appearance`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => void setPreference(option.value)}
              style={[
                styles.option,
                {
                  backgroundColor: selected ? palette.primary : palette.surface,
                  borderColor: selected ? palette.primary : palette.border,
                },
              ]}
            >
              <MaterialCommunityIcons color={color} name={option.icon} size={20} />
              <Text style={[styles.optionLabel, { color }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* App */}
      <SectionLabel palette={palette}>APP</SectionLabel>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <InfoRow icon="information-outline" label="Version" last={!showUpdates()} palette={palette} value={version} />
        {showUpdates() ? <UpdateRow palette={palette} /> : null}
      </View>

      {/* Account */}
      <SectionLabel palette={palette}>ACCOUNT</SectionLabel>
      {confirmingSignOut ? (
        <View style={[styles.card, styles.confirm, { backgroundColor: palette.errorSurface, borderColor: palette.error }]}>
          <Text style={[styles.rowTitle, { color: palette.onError }]}>Sign out?</Text>
          <Text style={[styles.muted, { color: palette.onError }]}>
            Your saved workspace data will be cleared from this device.
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityLabel="Cancel signing out"
              disabled={signingOut}
              onPress={() => setConfirmingSignOut(false)}
              style={[styles.confirmButton, { borderColor: palette.error }]}
            >
              <Text style={[styles.optionLabel, { color: palette.onError }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Confirm signing out"
              disabled={signingOut}
              onPress={() => void confirmSignOut()}
              style={[styles.confirmButton, { backgroundColor: palette.error, borderColor: palette.error }]}
            >
              <Text style={[styles.optionLabel, { color: palette.surface }]}>{signingOut ? "Signing out…" : "Sign out"}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityLabel="Sign out"
          onPress={() => setConfirmingSignOut(true)}
          style={[styles.signOut, { backgroundColor: palette.surface, borderColor: palette.error }]}
        >
          <MaterialCommunityIcons color={palette.error} name="logout-variant" size={18} />
          <Text style={[styles.optionLabel, { color: palette.error }]}>Sign out</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

/** Android builds check the release service; preview builds may turn it off. */
function showUpdates() {
  return Platform.OS === "android" && appUpdateConfig.enabled;
}

function SectionLabel({ children, palette }: { children: string; palette: AppPalette }) {
  return <Text style={[styles.sectionLabel, { color: palette.onSurfaceMuted }]}>{children}</Text>;
}

function InfoRow({
  icon,
  label,
  value,
  last = false,
  palette,
}: {
  icon: IconName;
  label: string;
  value: string | null | undefined;
  last?: boolean;
  palette: AppPalette;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !last && { borderBottomColor: palette.borderSubtle, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <MaterialCommunityIcons color={palette.onSurfaceMuted} name={icon} size={18} />
      <Text style={[styles.infoLabel, { color: palette.onSurfaceMuted }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.infoValue, { color: palette.onSurface }]}>
        {value || "—"}
      </Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  palette,
  tint,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  palette: AppPalette;
  tint?: string;
  disabled?: boolean;
}) {
  const color = tint ?? palette.onSurface;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { borderTopColor: palette.borderSubtle, backgroundColor: pressed ? palette.surfaceContainer : "transparent" },
      ]}
    >
      <MaterialCommunityIcons color={color} name={icon} size={18} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <MaterialCommunityIcons color={palette.onSurfaceMuted} name="chevron-right" size={20} />
    </Pressable>
  );
}

function UpdateRow({ palette }: { palette: AppPalette }) {
  const { availableRelease, checkForUpdates, installUpdate, status } = useAppUpdate();
  const ready = Boolean(availableRelease) && status === "ready";
  const label = ready
    ? `Install version ${availableRelease?.versionName}`
    : status === "checking"
      ? "Checking for updates…"
      : "Check for updates";
  return (
    <ActionRow
      disabled={status === "checking"}
      icon={ready ? "download" : "update"}
      label={label}
      onPress={() => void (ready ? installUpdate() : checkForUpdates({ force: true }))}
      palette={palette}
      tint={ready ? palette.success : undefined}
    />
  );
}

const styles = StyleSheet.create({
  actionLabel: { flex: 1, fontFamily: typography.fontFamily.medium, fontSize: typography.size.body },
  actionRow: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  avatar: { alignItems: "center", borderRadius: radii.pill, height: 56, justifyContent: "center", width: 56 },
  avatarText: { fontFamily: typography.fontFamily.semibold, fontSize: 20 },
  card: { borderRadius: radii.lg, borderWidth: 1, overflow: "hidden" },
  chip: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontFamily: typography.fontFamily.medium, fontSize: typography.size.tiny },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  confirm: { gap: spacing.xs, padding: spacing.md },
  confirmActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  confirmButton: {
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  content: { gap: spacing.xs, padding: spacing.md, paddingBottom: spacing.xxl },
  hero: { alignItems: "center", flexDirection: "row", gap: spacing.md, padding: spacing.md },
  heroCopy: { flex: 1, minWidth: 0 },
  heroName: { fontFamily: typography.fontFamily.semibold, fontSize: 18 },
  iconWell: { alignItems: "center", borderRadius: radii.md, height: 40, justifyContent: "center", width: 40 },
  infoLabel: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  infoValue: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.small,
    textAlign: "right",
  },
  muted: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  option: {
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    justifyContent: "center",
    minHeight: 64,
    padding: spacing.xs,
  },
  optionLabel: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.small },
  optionRow: { flexDirection: "row", gap: spacing.sm },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
  sectionLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.tiny,
    letterSpacing: 0.6,
    marginLeft: 4,
    marginTop: spacing.md,
  },
  shiftRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  signOut: {
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 50,
  },
  statusDot: { borderRadius: radii.pill, height: 10, width: 10 },
});
