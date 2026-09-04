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
