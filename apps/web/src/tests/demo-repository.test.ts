import { describe, expect, it } from "vitest";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import { resolvedTelemetryStatus } from "../app/features/farm/telemetry";

describe("interactive mock demo", () => {
  it("starts with three connected chambers covering the three built-in modes", async () => {
    const now = new Date("2026-10-15T04:00:00Z");
    const repository = new InMemoryEggcelerateRepository({
      fixtureSet: "demo",
      now: () => now,
    });
    const units = await repository.listIncubators();
    const modes = await repository.listModes();
    expect(units.ok && units.data).toHaveLength(3);
    expect(modes.ok && modes.data.map((mode) => mode.name)).toEqual([
      "Chicken",
      "Duck",
      "Quail",
    ]);
    if (!units.ok) throw new Error("Demo chambers unavailable");
    expect(units.data.map((unit) => unit.modeId)).toEqual([
      "broiler",
      "duck",
      "quail",
    ]);
    for (const unit of units.data) {
      expect(unit.paired).toBe(true);
      expect(unit.connectionState).toBe("connected");
      expect(resolvedTelemetryStatus(unit, now.getTime())).toBe("fresh");
    }
  });

  it("refreshes simulated receipts on later polls without changing strict freshness rules", async () => {
    let now = new Date("2026-10-15T04:00:00Z");
    const repository = new InMemoryEggcelerateRepository({
      fixtureSet: "demo",
      now: () => now,
    });
    const initial = await repository.getIncubator("chamber-1");
    now = new Date(now.getTime() + 10 * 60_000);
    // An old snapshot must still expire normally, even for a demo chamber.
    expect(
      initial.ok && resolvedTelemetryStatus(initial.data, now.getTime()),
    ).toBe("offline");
    const polled = await repository.listIncubators();
    if (!polled.ok) throw new Error("Demo poll failed");
    for (const unit of polled.data) {
      expect(resolvedTelemetryStatus(unit, now.getTime())).toBe("fresh");
      expect(unit.telemetryReceivedAt).toBe(now.toISOString());
      expect(unit.outputStates?.receivedAt).toBe(now.toISOString());
    }
    now = new Date(now.getTime() + 10 * 60_000);
    const detail = await repository.getIncubator("chamber-1");
    expect(
      detail.ok && resolvedTelemetryStatus(detail.data, now.getTime()),
    ).toBe("fresh");
  });

  it("keeps demo alerts and hatch history within the visible chambers and modes", async () => {
    const repository = new InMemoryEggcelerateRepository({
      fixtureSet: "demo",
    });
    const units = await repository.listIncubators();
    const alerts = await repository.listAlerts();
    const history = await repository.listHatchRecords();
    if (!units.ok || !alerts.ok || !history.ok)
      throw new Error("Demo unavailable");
    const names = units.data.map((unit) => unit.name);
    for (const alert of alerts.data) {
      expect(names).toContain(alert.unit);
      expect(alert.title).not.toMatch(/battery|grid power/i);
    }
    expect(history.data.length).toBeGreaterThan(0);
    for (const record of history.data) {
      expect(names).toContain(record.chamber);
      expect(["Chicken", "Duck", "Quail"]).toContain(record.modeName);
    }
  });
});
