import { AppUpdateError, checkForAppUpdate } from "@/features/appUpdates/appUpdateApi";

const serverUrl = "https://releases.example.test";
const sha256 = "a".repeat(64);

function response(message: unknown, ok = true) {
  return {
    json: async () => ({ message }),
    ok,
  } as Response;
}

function availableRelease(overrides: Record<string, unknown> = {}) {
  return {
    download_url: "https://releases.example.test/files/vunapos-101.apk",
    file_size: 1234,
    mandatory: false,
    release: "MOBILE-REL-00101",
    release_notes: "Reliable checkout\nPrinter fixes",
    sha256,
    update_available: true,
    version_code: 101,
    version_name: "1.0.1",
    ...overrides,
  };
}

describe("checkForAppUpdate", () => {
  const input = {
    applicationId: "ke.co.navari.vunapos",
    channel: "Production",
    serverUrl,
    versionCode: 100,
  };

  it("uses the public Frappe contract and parses a newer trusted release", async () => {
    const fetchMock = jest.fn(async (_url: RequestInfo | URL, _request?: RequestInit) => response(availableRelease()));
    const fetcher = fetchMock as unknown as typeof fetch;

    await expect(checkForAppUpdate({ ...input, fetcher })).resolves.toEqual({
      downloadUrl: "https://releases.example.test/files/vunapos-101.apk",
      fileSize: 1234,
      mandatory: false,
      release: "MOBILE-REL-00101",
      releaseNotes: "Reliable checkout\nPrinter fixes",
      sha256,
      versionCode: 101,
      versionName: "1.0.1",
    });

    const [url, request] = fetchMock.mock.calls[0]!;
    const endpointUrl = typeof url === "string" || url instanceof URL ? url.toString() : url.url;
    const query = new URL(endpointUrl).searchParams;
    expect(new URL(endpointUrl).pathname).toBe("/api/method/mobile_release_manager.api.releases.check_for_updates");
    expect(query.get("application_id")).toBe("ke.co.navari.vunapos");
    expect(query.get("platform")).toBe("Android");
    expect(query.get("version_code")).toBe("100");
    expect(query.get("channel")).toBe("Production");
    expect(request).toMatchObject({ method: "GET" });
  });

  it("returns no update for the server's explicit no-update response", async () => {
    await expect(checkForAppUpdate({ ...input, fetcher: async () => response({ update_available: false }) })).resolves.toBeNull();
  });

  it.each([
    ["a response without the Frappe message wrapper", async () => ({ ok: true, json: async () => ({}) }) as Response],
    ["a non-increasing version", async () => response(availableRelease({ version_code: 100 }))],
    ["an APK outside the trusted origin", async () => response(availableRelease({ download_url: "https://attacker.example/files/update.apk" }))],
    ["an invalid checksum", async () => response(availableRelease({ sha256: "not-a-checksum" }))],
    ["a non-files download path", async () => response(availableRelease({ download_url: "https://releases.example.test/api/file" }))],
  ])("rejects %s", async (_description, fetcher) => {
    await expect(checkForAppUpdate({ ...input, fetcher })).rejects.toBeInstanceOf(AppUpdateError);
  });

  it("turns connectivity failures into a controlled update error", async () => {
    await expect(checkForAppUpdate({
      ...input,
      fetcher: async () => Promise.reject(new Error("offline")),
    })).rejects.toThrow("Could not reach the release server.");
  });

  it("rejects a non-HTTPS configured release server before fetching", async () => {
    const fetcher = jest.fn();
    await expect(checkForAppUpdate({ ...input, fetcher, serverUrl: "http://releases.example.test" })).rejects.toThrow("must use HTTPS");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
