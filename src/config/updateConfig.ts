/**
 * Public release-manager configuration compiled into every Android build.
 *
 * `EXPO_PUBLIC_*` values are intentionally build-time, non-secret overrides
 * for preview deployments and downstream forks. They are not user settings:
 * a customer ERPNext URL can never change this trusted update origin.
 */
const releaseChannel =
  process.env.EXPO_PUBLIC_VUNAPOS_UPDATE_CHANNEL === "Preview"
    ? "Preview"
    : "Production";

export const appUpdateConfig = {
  enabled: process.env.EXPO_PUBLIC_VUNAPOS_UPDATES_ENABLED !== "false",
  serverUrl:
    process.env.EXPO_PUBLIC_VUNAPOS_UPDATE_SERVER_URL ??
    "https://nl-vms.frappe.cloud",
  channel: releaseChannel,
} as const;

/** Compatibility name for build tooling; identity always comes from Android. */
export const updateConfig = appUpdateConfig;
