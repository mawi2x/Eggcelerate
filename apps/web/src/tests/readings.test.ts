import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import { readingQueryOptions } from "../app/features/farm/use-incubator-readings";

const fixedNow = () => new Date("2026-09-03T12:00:00.000Z");

describe("repository readings", () => {
  it("returns aligned deterministic windows for comparison charts", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const full = await repository.listReadings({
      incubatorId: "chamber-1",
      window: "full",
    });
    const week = await repository.listReadings({
      incubatorId: "chamber-1",
      window: "7d",
    });
    const day = await repository.listReadings({
      incubatorId: "chamber-1",
      window: "24h",
    });
    const comparison = await repository.listReadings({
      incubatorId: "chamber-2",
      window: "24h",
    });

    expect(
      full.ok && week.ok && day.ok && full.data.length > week.data.length,
    ).toBe(true);
    expect(week.ok && day.ok && week.data.length > day.data.length).toBe(true);
    expect(day.ok && day.data).toHaveLength(13);
    if (!day.ok || !comparison.ok) return;
    const latestDay = day.data[day.data.length - 1];
    const latestComparison = comparison.data[comparison.data.length - 1];
    expect(latestDay?.ts).toBe(fixedNow().getTime());
    expect(latestComparison?.ts).toBe(latestDay?.ts);
  });

  it("returns a structured error for an unknown incubator", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const result = await repository.listReadings({
      incubatorId: "missing",
      window: "24h",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("reuses the TanStack cache for the same incubator and window", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const listReadings = vi.spyOn(repository, "listReadings");
    const queryClient = new QueryClient();
    const options = readingQueryOptions(repository, "chamber-1", "24h");

    await queryClient.fetchQuery(options);
    await queryClient.fetchQuery(options);

    expect(listReadings).toHaveBeenCalledTimes(1);
  });
});

describe("live polling", () => {
  it("refreshes an existing observer, pauses when hidden and resumes", async () => {
    const { QueryObserver, focusManager } = await import(
      "@tanstack/react-query"
    );
    vi.useFakeTimers();
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const fetch = vi.spyOn(repository, "listReadings");
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.mount();
    focusManager.setFocused(true);
    const observer = new QueryObserver(
      client,
      readingQueryOptions(repository, "chamber-1", "24h"),
    );
    const unsubscribe = observer.subscribe(() => {});
    try {
      await vi.advanceTimersByTimeAsync(1);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(fetch).toHaveBeenCalledTimes(2);
      focusManager.setFocused(false);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(fetch).toHaveBeenCalledTimes(2);
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(fetch.mock.calls.length).toBeGreaterThan(2);
    } finally {
      unsubscribe();
      client.unmount();
      client.clear();
      focusManager.setFocused(undefined);
      vi.useRealTimers();
    }
  });
});
