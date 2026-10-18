import { fireEvent, render } from "@testing-library/react-native";

const mockUseAppUpdate = jest.fn();
const installUpdate = jest.fn();
const dismissReadyUpdate = jest.fn();

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 20, left: 0, right: 0, top: 0 }),
}));

jest.mock("@/theme/AppearanceProvider", () => ({
  useAppearance: () => ({
    palette: {
      border: "#cccccc",
      error: "#cc2929",
      onPrimary: "#ffffff",
      onSurface: "#171717",
      onSurfaceMuted: "#525252",
      primary: "#16794c",
      scrim: "rgba(0, 0, 0, 0.48)",
      surface: "#ffffff",
      surfaceContainerHigh: "#e9e9e9",
    },
  }),
}));

jest.mock("@/features/appUpdates/AppUpdateProvider", () => ({
  useAppUpdate: () => mockUseAppUpdate(),
}));

import { AppUpdateSheet } from "@/features/appUpdates/AppUpdateSheet";

const release = {
  downloadUrl: "https://releases.example.test/files/vunapos.apk",
  fileSize: 1234,
  mandatory: false,
  release: "MOBILE-REL-101",
  releaseNotes: "Reliable checkout\nPrinter fixes",
  sha256: "a".repeat(64),
  versionCode: 101,
  versionName: "1.0.1",
};

function updateState(overrides: Record<string, unknown> = {}) {
  return {
    availableRelease: release,
    dismissReadyUpdate,
    error: null,
    installUpdate,
    isCheckoutActive: false,
    isReadyUpdateDismissed: false,
    status: "ready",
    ...overrides,
  };
}

describe("AppUpdateSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a verified ready update with release notes and installation controls", async () => {
    mockUseAppUpdate.mockReturnValue(updateState());
    const screen = await render(<AppUpdateSheet />);

    expect(screen.getByText("Update ready")).toBeTruthy();
    expect(screen.getByText("VunaPOS 1.0.1 is ready to install.")).toBeTruthy();
    expect(screen.getByText("Reliable checkout")).toBeTruthy();
    expect(screen.getByText("Printer fixes")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Install update"));
    expect(installUpdate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["while the APK is still downloading", { status: "downloading" }],
    ["while checkout is active", { isCheckoutActive: true }],
    ["after the user selected Later", { isReadyUpdateDismissed: true }],
  ])("does not interrupt the user %s", async (_description, overrides) => {
    mockUseAppUpdate.mockReturnValue(updateState(overrides));
    const screen = await render(<AppUpdateSheet />);

    expect(screen.queryByText("Update ready")).toBeNull();
  });

  it("keeps the verified APK when the user selects Later", async () => {
    mockUseAppUpdate.mockReturnValue(updateState());
    const screen = await render(<AppUpdateSheet />);

    await fireEvent.press(screen.getAllByLabelText("Install update later")[1]!);
    expect(dismissReadyUpdate).toHaveBeenCalledTimes(1);
    expect(installUpdate).not.toHaveBeenCalled();
  });
});
