import { render } from "@testing-library/react-native";

jest.mock("@/theme/AppearanceProvider", () => ({
  useAppearance: () => ({
    palette: { onSurfaceMuted: "#777" },
  }),
}));

import { PosCacheStatus } from "@/features/pos/components/PosCacheStatus";

describe("PosCacheStatus", () => {
  it("keeps refresh state in the natural page flow without exposing timestamps", async () => {
    const screen = await render(
      <PosCacheStatus
        isOffline={false}
        isRefreshing
        isStale
        lastUpdated={new Date("2026-09-26T09:30:00Z").getTime()}
      />,
    );

    expect(screen.getByText("Refreshing…")).toBeTruthy();
    expect(screen.queryByText(/Updated/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("reports offline cached-data status without exposing timestamps", async () => {
    const screen = await render(
      <PosCacheStatus
        isOffline
        isStale
        lastUpdated={new Date("2026-09-26T09:30:00Z").getTime()}
      />,
    );

    expect(screen.getByText("Connection unavailable · reconnect to refresh")).toBeTruthy();
    expect(screen.queryByText(/Updated/)).toBeNull();
  });

  it("does not claim saved data is unavailable solely from a connection hint", async () => {
    const screen = await render(
      <PosCacheStatus isOffline isStale lastUpdated={null} />,
    );
    expect(screen.getByText("Connection unavailable · reconnect to refresh")).toBeTruthy();
    expect(screen.queryByText(/saved data unavailable/)).toBeNull();
  });
});
