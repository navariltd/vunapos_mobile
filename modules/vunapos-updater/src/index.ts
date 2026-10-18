import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

export type NativeUpdateRelease = {
  downloadUrl: string;
  fileSize: number;
  release: string;
  sha256: string;
  versionCode: number;
  versionName: string;
};

export type NativeUpdateSnapshot = {
  bytesDownloaded: number;
  downloadId: number | null;
  error: string | null;
  fileUri: string | null;
  lastCheckAt: number | null;
  release: NativeUpdateRelease | null;
  status: "idle" | "pending" | "running" | "successful" | "failed" | "ready";
};

export type NativeVerificationResult = {
  fileUri: string;
  packageName: string;
  versionCode: number;
};

type NativeUpdater = {
  clearUpdate(): Promise<void>;
  enqueueDownload(release: NativeUpdateRelease): Promise<NativeUpdateSnapshot>;
  getSnapshot(): Promise<NativeUpdateSnapshot>;
  getInstalledApplication(): Promise<{ packageName: string; versionCode: number; versionName: string }>;
  installVerifiedUpdate(): Promise<void>;
  isInstallPermissionGranted(): Promise<boolean>;
  openInstallPermissionSettings(): Promise<void>;
  setLastCheckAt(timestamp: number): Promise<void>;
  verifyDownloadedUpdate(): Promise<NativeVerificationResult>;
};

let nativeUpdater: NativeUpdater | null = null;

if (Platform.OS === "android") {
  try {
    nativeUpdater = requireNativeModule<NativeUpdater>("VunaPosUpdater");
  } catch {
    // Expo Go and Jest do not load the app's local Android module. Calls use
    // the explicit availability guard so POS operation remains unaffected.
    nativeUpdater = null;
  }
}

export function getNativeUpdater() {
  return nativeUpdater;
}
