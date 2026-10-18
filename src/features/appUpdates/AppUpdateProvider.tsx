import { AppState, AppStateStatus } from "react-native";
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { appUpdateConfig } from "@/config/updateConfig";
import { AppUpdateError, AvailableAppUpdate, checkForAppUpdate } from "@/features/appUpdates/appUpdateApi";
import { getNativeUpdater, NativeUpdateSnapshot } from "@vunapos/updater";
import { useNetworkStatus } from "@/services/NetworkStatusProvider";

export type AppUpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "verifying"
  | "ready"
  | "installing"
  | "error";

type AppUpdateContextValue = {
  availableRelease: AvailableAppUpdate | null;
  checkForUpdates: (options?: { force?: boolean }) => Promise<void>;
  dismissReadyUpdate: () => void;
  error: string | null;
  installUpdate: () => Promise<void>;
  isCheckoutActive: boolean;
  isReadyUpdateDismissed: boolean;
  setCheckoutActive: (active: boolean) => void;
  status: AppUpdateStatus;
};

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 4_000;

const defaultContext: AppUpdateContextValue = {
  availableRelease: null,
  checkForUpdates: async () => undefined,
  dismissReadyUpdate: () => undefined,
  error: null,
  installUpdate: async () => undefined,
  isCheckoutActive: false,
  isReadyUpdateDismissed: false,
  setCheckoutActive: () => undefined,
  status: "idle",
};

const AppUpdateContext = createContext<AppUpdateContextValue>(defaultContext);

function snapshotRelease(snapshot: NativeUpdateSnapshot): AvailableAppUpdate | null {
  const release = snapshot.release;
  if (!release) return null;
  return {
    downloadUrl: release.downloadUrl,
    fileSize: release.fileSize,
    mandatory: false,
    release: release.release,
    releaseNotes: "",
    sha256: release.sha256,
    versionCode: release.versionCode,
    versionName: release.versionName,
  };
}

function statusFromSnapshot(snapshot: NativeUpdateSnapshot): AppUpdateStatus {
  switch (snapshot.status) {
    case "pending":
    case "running":
      return "downloading";
    case "successful":
      return "verifying";
    case "ready":
      return "ready";
    case "failed":
      return "error";
    default:
      return "idle";
  }
}

export function AppUpdateProvider({ children, enabled }: PropsWithChildren<{ enabled: boolean }>) {
  const { isOnline } = useNetworkStatus();
  const [availableRelease, setAvailableRelease] = useState<AvailableAppUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCheckoutActive, setCheckoutActive] = useState(false);
  const [isReadyUpdateDismissed, setReadyUpdateDismissed] = useState(false);
  const [status, setStatus] = useState<AppUpdateStatus>("idle");
  const requestGeneration = useRef(0);
  const checkInFlight = useRef(false);
  const verifyInFlight = useRef(false);
  const availableReleaseId = useRef<string | null>(null);

  const setTrackedAvailableRelease = useCallback((release: AvailableAppUpdate | null) => {
    if (availableReleaseId.current !== (release?.release ?? null)) {
      availableReleaseId.current = release?.release ?? null;
      setReadyUpdateDismissed(false);
    }
    setAvailableRelease((current) => {
      if (!release || current?.release !== release.release) return release;
      return current;
    });
  }, []);

  const reconcile = useCallback(async () => {
    const native = getNativeUpdater();
    if (!native) return;
    const snapshot = await native.getSnapshot();
    const restoredRelease = snapshotRelease(snapshot);
    setTrackedAvailableRelease(restoredRelease);
    setStatus(statusFromSnapshot(snapshot));
    if (snapshot.status === "failed") setError(snapshot.error ?? "The update download failed.");
    if (snapshot.status !== "successful" || verifyInFlight.current) return;

    verifyInFlight.current = true;
    setStatus("verifying");
    try {
      await native.verifyDownloadedUpdate();
      setStatus("ready");
      setError(null);
    } catch (verificationError) {
      await native.clearUpdate();
      setStatus("error");
      setError(verificationError instanceof Error ? verificationError.message : "The downloaded update could not be verified.");
    } finally {
      verifyInFlight.current = false;
    }
  }, [setTrackedAvailableRelease]);

  const checkForUpdates = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    const native = getNativeUpdater();
    if (!enabled || !appUpdateConfig.enabled || !isOnline || !native || checkInFlight.current) return;
    const snapshot = await native.getSnapshot();
    if (!force && snapshot.lastCheckAt && Date.now() - snapshot.lastCheckAt < CHECK_INTERVAL_MS) {
      await reconcile();
      return;
    }
    checkInFlight.current = true;
    const generation = ++requestGeneration.current;
    setStatus("checking");
    setError(null);
    try {
      const installed = await native.getInstalledApplication();
      const release = await checkForAppUpdate({
        applicationId: installed.packageName,
        versionCode: installed.versionCode,
      });
      if (generation !== requestGeneration.current) return;
      await native.setLastCheckAt(Date.now());
      if (!release) {
        // A successful response that no longer advertises a locally saved
        // newer release can mean it was revoked. Do not keep offering it.
        await native.clearUpdate();
        await reconcile();
        return;
      }
      setTrackedAvailableRelease(release);
      const current = await native.enqueueDownload({
        downloadUrl: release.downloadUrl,
        fileSize: release.fileSize,
        release: release.release,
        sha256: release.sha256,
        versionCode: release.versionCode,
        versionName: release.versionName,
      });
      setStatus(statusFromSnapshot(current));
      await reconcile();
    } catch (updateError) {
      if (generation !== requestGeneration.current) return;
      setStatus("error");
      setError(updateError instanceof AppUpdateError || updateError instanceof Error ? updateError.message : "Could not check for updates.");
    } finally {
      checkInFlight.current = false;
    }
  }, [enabled, isOnline, reconcile, setTrackedAvailableRelease]);

  useEffect(() => {
    if (!enabled || !appUpdateConfig.enabled) return;
    const timer = setTimeout(() => void reconcile(), 0);
    return () => clearTimeout(timer);
  }, [enabled, reconcile]);

  useEffect(() => {
    if (!enabled || !appUpdateConfig.enabled || !isOnline) return;
    const timer = setTimeout(() => void checkForUpdates(), 700);
    return () => clearTimeout(timer);
  }, [checkForUpdates, enabled, isOnline]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState !== "active") return;
      void reconcile();
      void checkForUpdates();
    });
    return () => subscription.remove();
  }, [checkForUpdates, reconcile]);

  useEffect(() => {
    if (status !== "downloading" && status !== "verifying") return;
    const interval = setInterval(() => void reconcile(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reconcile, status]);

  const installUpdate = useCallback(async () => {
    const native = getNativeUpdater();
    if (!native || !availableRelease) return;
    if (isCheckoutActive) {
      setError("Finish the current checkout before installing an update.");
      return;
    }
    try {
      setStatus("installing");
      if (!(await native.isInstallPermissionGranted())) {
        setStatus("ready");
        setError("Allow VunaPOS to install updates in Android settings, then choose Install Update again.");
        await native.openInstallPermissionSettings();
        return;
      }
      await native.installVerifiedUpdate();
      // Android owns the confirmation UI. Returning here does not mean the
      // user installed the update, so retain the verified artifact.
      setStatus("ready");
    } catch (installError) {
      setStatus("ready");
      setError(installError instanceof Error ? installError.message : "Android could not open the update installer.");
    }
  }, [availableRelease, isCheckoutActive]);

  const dismissReadyUpdate = useCallback(() => {
    if (availableRelease) setReadyUpdateDismissed(true);
  }, [availableRelease]);

  const value = useMemo(() => ({
    availableRelease,
    checkForUpdates,
    dismissReadyUpdate,
    error,
    installUpdate,
    isCheckoutActive,
    isReadyUpdateDismissed,
    setCheckoutActive,
    status,
  }), [availableRelease, checkForUpdates, dismissReadyUpdate, error, installUpdate, isCheckoutActive, isReadyUpdateDismissed, status]);

  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>;
}

export function useAppUpdate() {
  return useContext(AppUpdateContext);
}

/** Marks checkout screens as an installation-unsafe boundary. */
export function useAppUpdateInstallSafety(active: boolean) {
  const { setCheckoutActive } = useAppUpdate();
  useEffect(() => {
    setCheckoutActive(active);
    return () => setCheckoutActive(false);
  }, [active, setCheckoutActive]);
}
