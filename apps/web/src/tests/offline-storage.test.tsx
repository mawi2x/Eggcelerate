import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { OfflineStorageStatus } from "../app/components/detail/OfflineStorageStatus";
import { ChartTooltip } from "../app/components/trends/ChartTooltip";
import { chartReadingFromDTO } from "../app/data/transport/contracts";
import type { Incubator } from "../app/domain/types";
import { mergeChartReadings } from "../app/features/trends/chart-data";
import { render } from "./render";

vi.mock("../app/data/repositories/app-repository", () => ({ appAuthApiBaseUrl: "/api" }));
const report = { state: "ready", queued: 16, pending: 3, bytes: 1024, untimed: 0, dropped: 2, corrupt: 0, oldest_ms: 1760000000000, error: "" };
const unit = { id: "chamber-1" } as Incubator;

async function mount(reportedAt: string | null, state = "ready") {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(["offline-storage", unit.id], {
    reported_at: reportedAt, last_replay_at: new Date().toISOString(),
    outcomes: { imported: 8, quarantined_time_unknown: 2 }, report: { ...report, state },
  });
  const view = await render(<QueryClientProvider client={client}><OfflineStorageStatus unit={unit} /></QueryClientProvider>);
  return { view, client };
}

describe("local recording status", () => {
  it("shows queue and uncommitted RAM separately", async () => {
    const { view, client } = await mount(new Date().toISOString());
    expect(view.container.textContent).toContain("16 saved readings waiting to upload");
    expect(view.container.textContent).toContain("3 readings");
    expect(view.container.textContent).toContain("discarded before upload confirmation");
    await view.unmount(); client.clear();
  });
  it("does not make an old report current when a historical receipt is recent", async () => {
    const { view, client } = await mount(new Date(Date.now() - 120000).toISOString());
    expect(view.container.textContent).toContain("Device report is out of date");
    expect(view.container.textContent).toContain("Last report: recording locally");
    expect(view.container.textContent).not.toContain("Recording locally.");
    await view.unmount(); client.clear();
  });
  it("does not claim local persistence before initialization", async () => {
    const { view, client } = await mount(new Date().toISOString(), "needs_init");
    expect(view.container.textContent).toContain("Readings are not being saved locally");
    await view.unmount(); client.clear();
  });
  it("carries historical upload labels from DTO through chart tooltip", async () => {
    const point = chartReadingFromDTO({ observed_at: "2026-10-18T10:00:00Z", temperature_c: 37.6, humidity_pct: 57,
      temperature_min: 37.5, temperature_max: 37.7, humidity_min: 55, humidity_max: 58,
      sample_count: 8, backfilled_count: 4, bucket_seconds: 150, water_not_ok_count: 0 });
    const rows = mergeChartReadings([unit.id], { [unit.id]: [point] }, "temp");
    expect(rows[0][`${unit.id}_backfilled`]).toBe(4);
    const view = await render(<ChartTooltip active unit="°C" payload={[{ value: 37.6, dataKey: unit.id, payload: rows[0] }]} />);
    expect(view.container.textContent).toContain("4 historical uploads");
    expect(view.container.textContent).toContain("original reading time");
    await view.unmount();
  });
});
