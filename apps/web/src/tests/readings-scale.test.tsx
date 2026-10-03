import { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { RawReadingsDialog } from "../app/components/RawReadingsDialog";
import { ApiRepository } from "../app/data/repositories/api-repository";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import type { Reading } from "../app/domain/types";
import { readingQueryOptions } from "../app/features/farm/use-incubator-readings";
import {
  aggregateReadings,
  mergeChartReadings,
} from "../app/features/trends/chart-data";
import { AppProviders } from "../app/providers/AppProviders";
import { render, waitFor } from "./render";

const end = Date.parse("2026-10-03T00:00:00Z");
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
  });

describe("bounded chart readings", () => {
  it("retains brief extremes at dense cadence and breaks empty compare buckets", () => {
    const raw: Reading[] = Array.from({ length: 86400 }, (_, i) => ({
      ts: end - 86400000 + i * 1000,
      time: "",
      temp: i === 85000 ? 50 : 37.5,
      humidity: i === 85000 ? 10 : 57,
    })).filter((p) => p.ts < end - 12 * 3600000 || p.ts >= end - 11 * 3600000);
    const chart = aggregateReadings(raw, end - 86400000, end);
    expect(chart.length).toBeLessThanOrEqual(600);
    expect(chart.reduce((sum, p) => sum + (p.sampleCount ?? 0), 0)).toBe(82800);
    expect(Math.max(...chart.map((p) => p.tempMax ?? 0))).toBe(50);
    expect(Math.min(...chart.map((p) => p.humidityMin ?? 100))).toBe(10);
    const merged = mergeChartReadings(
      ["a", "b"],
      { a: chart, b: [chart[0]] },
      "temp",
    );
    expect(merged.some((p) => p.a === null)).toBe(true);
    expect(
      merged.some((p) => p.b === undefined && typeof p.a === "number"),
    ).toBe(true);
  });
  it("uses bounded chart transport and slower historical polling", async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
            ok: true,
            data: [
              {
                observed_at: "2026-10-02T12:00:00Z",
                temperature_c: 37.5,
                humidity_pct: 57,
                temperature_min: 35,
                temperature_max: 50,
                humidity_min: 10,
                humidity_max: 60,
                sample_count: 50,
                bucket_seconds: 145,
                water_not_ok_count: 1,
              },
            ],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    const repository = new ApiRepository({
      baseUrl: "http://127.0.0.1:8000",
      fetchImpl,
    });
    const options = readingQueryOptions(repository, "chamber-1", "7d");
    expect(options.refetchInterval).toBe(300000);
    const result = await repository.listReadings({
      incubatorId: "chamber-1",
      window: "7d",
      resolution: "chart",
    });
    expect(fetchImpl.mock.calls[0][0]).toContain("/readings/chart?window=7d");
    expect(result.ok && result.data[0].tempMax).toBe(50);
  });
});

describe("complete raw export", () => {
  it("bounds a full-cycle preview and preserves its CSV after chamber rename", async () => {
    const repository = new InMemoryEggcelerateRepository({
      now: () => new Date(end),
    });
    const preview = await repository.previewRawReadings({
      incubatorIds: ["chamber-12", "chamber-1"],
      window: "full",
      end: new Date(end + 1).toISOString(),
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.data.total).toBeGreaterThan(200);
    expect(preview.data.rows).toHaveLength(200);
    await repository.updateIncubatorProfile("chamber-12", {
      name: "Changed later",
    });
    const csv = await repository.exportRawReadings(preview.data.scopeToken);
    expect(csv.ok).toBe(true);
    if (!csv.ok) return;
    const text = await readBlob(csv.data);
    expect(text.trim().split("\n")).toHaveLength(preview.data.total + 1);
    expect(text).not.toContain("Changed later");
    expect(text).toContain(
      "Chamber ID,Chamber,Timestamp (UTC),Received (UTC),Temperature (C),Humidity (%),Water OK",
    );
  });
  it("waits for raw preview, limits table rows, and downloads the complete scope", async () => {
    const repository = new InMemoryEggcelerateRepository();
    const exporter = vi.spyOn(repository, "exportRawReadings");
    const create = vi.fn(() => "blob:export-test");
    const oldCreate = URL.createObjectURL,
      oldRevoke = URL.revokeObjectURL;
    URL.createObjectURL = create;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const mounted = await render(
      <AppProviders repository={repository} queryClient={client}>
        <RawReadingsDialog
          ids={["chamber-12", "chamber-1"]}
          window="full"
          onClose={() => {}}
        />
      </AppProviders>,
    );
    try {
      await waitFor(
        () => document.body.querySelectorAll("tbody tr").length === 200,
      );
      expect(document.body.textContent).toContain(
        "CSV includes every sample in this scope",
      );
      const button = Array.from(document.body.querySelectorAll("button")).find(
        (p) => p.textContent === "Export complete CSV",
      );
      await act(async () => button?.click());
      await waitFor(() => exporter.mock.calls.length === 1);
      expect(create).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
    } finally {
      await mounted.unmount();
      client.clear();
      click.mockRestore();
      URL.createObjectURL = oldCreate;
      URL.revokeObjectURL = oldRevoke;
    }
  });
});
