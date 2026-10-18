import { appUpdateConfig } from "@/config/updateConfig";

export type AvailableAppUpdate = {
  downloadUrl: string;
  fileSize: number;
  mandatory: boolean;
  release: string;
  releaseNotes: string;
  sha256: string;
  versionCode: number;
  versionName: string;
};

export class AppUpdateError extends Error {}

type CheckForUpdateInput = {
  applicationId: string;
  channel?: string;
  fetcher?: typeof fetch;
  serverUrl?: string;
  timeoutMs?: number;
  versionCode: number;
};

const SHA256 = /^[a-f\d]{64}$/i;

function trustedOrigin(serverUrl: string) {
  const parsed = new URL(serverUrl);
  if (parsed.protocol !== "https:") {
    throw new AppUpdateError("The configured update server must use HTTPS.");
  }
  return parsed.origin;
}

function asPositiveInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new AppUpdateError(`The update server returned an invalid ${field}.`);
  }
  return value;
}

function parseAvailableUpdate(value: unknown, origin: string, installedVersionCode: number): AvailableAppUpdate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppUpdateError("The update server returned an invalid response.");
  }
  const response = value as Record<string, unknown>;
  if (response.update_available === false) return null;
  if (response.update_available !== true) {
    throw new AppUpdateError("The update server did not specify update availability.");
  }
  if (typeof response.release !== "string" || !response.release.trim()) {
    throw new AppUpdateError("The update server returned an invalid release identifier.");
  }
  if (typeof response.version_name !== "string" || !response.version_name.trim()) {
    throw new AppUpdateError("The update server returned an invalid version name.");
  }
  const versionCode = asPositiveInteger(response.version_code, "version code");
  if (versionCode <= installedVersionCode) {
    throw new AppUpdateError("The update server returned a non-increasing version code.");
  }
  const fileSize = asPositiveInteger(response.file_size, "file size");
  if (typeof response.sha256 !== "string" || !SHA256.test(response.sha256)) {
    throw new AppUpdateError("The update server returned an invalid APK checksum.");
  }
  if (typeof response.download_url !== "string") {
    throw new AppUpdateError("The update server did not provide an APK download URL.");
  }
  let downloadUrl: URL;
  try {
    downloadUrl = new URL(response.download_url);
  } catch {
    throw new AppUpdateError("The update server returned an invalid APK download URL.");
  }
  if (
    downloadUrl.protocol !== "https:" ||
    downloadUrl.origin !== origin ||
    !downloadUrl.pathname.startsWith("/files/") ||
    downloadUrl.username ||
    downloadUrl.password
  ) {
    throw new AppUpdateError("The update APK is not hosted by the trusted release server.");
  }
  if (typeof response.release_notes !== "string") {
    throw new AppUpdateError("The update server returned invalid release notes.");
  }
  return {
    downloadUrl: downloadUrl.toString(),
    fileSize,
    mandatory: response.mandatory === true,
    release: response.release,
    releaseNotes: response.release_notes,
    sha256: response.sha256.toLowerCase(),
    versionCode,
    versionName: response.version_name,
  };
}

/** Queries only the public Mobile Release Manager endpoint; no ERP session is used. */
export async function checkForAppUpdate({
  applicationId,
  channel = appUpdateConfig.channel,
  fetcher = fetch,
  serverUrl = appUpdateConfig.serverUrl,
  timeoutMs = 12_000,
  versionCode,
}: CheckForUpdateInput): Promise<AvailableAppUpdate | null> {
  if (!Number.isSafeInteger(versionCode) || versionCode < 0) {
    throw new AppUpdateError("The installed Android version code is invalid.");
  }
  const origin = trustedOrigin(serverUrl);
  const endpoint = new URL(
    "/api/method/mobile_release_manager.api.releases.check_for_updates",
    origin,
  );
  endpoint.search = new URLSearchParams({
    application_id: applicationId,
    channel,
    platform: "Android",
    version_code: String(versionCode),
  }).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(endpoint.toString(), {
      headers: { Accept: "application/json" },
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new AppUpdateError("The release server could not check for updates.");
    }
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || !("message" in payload)) {
      throw new AppUpdateError("The release server returned an invalid response.");
    }
    return parseAvailableUpdate((payload as { message: unknown }).message, origin, versionCode);
  } catch (error) {
    if (error instanceof AppUpdateError) throw error;
    if (controller.signal.aborted) {
      throw new AppUpdateError("The update check timed out.");
    }
    throw new AppUpdateError("Could not reach the release server.");
  } finally {
    clearTimeout(timeout);
  }
}
