import { act, renderHook } from "@testing-library/react-native";

import { usePolledResource } from "@/features/restaurant/hooks/usePolledResource";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

describe("usePolledResource", () => {
  it("keeps the previous results while a new key loads, then replaces them", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const fetchers: Record<string, () => Promise<string>> = { a: () => first.promise, b: () => second.promise };
    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) => usePolledResource(key, fetchers[key], { intervalMs: 0, keepPreviousData: true }),
      { initialProps: { key: "a" } },
    );
    await act(async () => first.resolve("menu A"));
    expect(result.current).toMatchObject({ data: "menu A", isStale: false, isLoading: false });

    await rerender({ key: "b" });
    expect(result.current).toMatchObject({ data: "menu A", isStale: true, isLoading: true });

    await act(async () => second.resolve("menu B"));
    expect(result.current).toMatchObject({ data: "menu B", isStale: false, isLoading: false });
  });

  it("shows the error instead of the previous results when a switch fails", async () => {
    const fetchers: Record<string, () => Promise<string>> = {
      a: async () => "menu A",
      b: async () => {
        throw new Error("Table R1 does not belong to restaurant Java");
      },
    };
    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) => usePolledResource(key, fetchers[key], { intervalMs: 0, keepPreviousData: true }),
      { initialProps: { key: "a" } },
    );
    await act(async () => undefined);
    await rerender({ key: "b" });
    await act(async () => undefined);
    expect(result.current).toMatchObject({
      data: null,
      isStale: false,
      isLoading: false,
      error: "Table R1 does not belong to restaurant Java",
    });
  });

  it("blanks by default when the key changes", async () => {
    const pending = deferred<string>();
    const fetchers: Record<string, () => Promise<string>> = { a: async () => "A", b: () => pending.promise };
    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) => usePolledResource(key, fetchers[key], { intervalMs: 0 }),
      { initialProps: { key: "a" } },
    );
    await act(async () => undefined);
    expect(result.current.data).toBe("A");
    await rerender({ key: "b" });
    expect(result.current).toMatchObject({ data: null, isLoading: true });
  });

  it("ignores a late reply for an old key", async () => {
    const slow = deferred<string>();
    const fetchers: Record<string, () => Promise<string>> = { a: () => slow.promise, b: async () => "B" };
    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) => usePolledResource(key, fetchers[key], { intervalMs: 0, keepPreviousData: true }),
      { initialProps: { key: "a" } },
    );
    await rerender({ key: "b" });
    await act(async () => undefined);
    expect(result.current.data).toBe("B");
    await act(async () => slow.resolve("late A"));
    expect(result.current.data).toBe("B");
  });
});
