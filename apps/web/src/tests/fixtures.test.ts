import { describe, expect, it } from "vitest";
import { createAlertFixtures } from "../app/data/fixtures/alerts";
import {
  createHatchRecordFixtures,
  hatchRecordFixtures,
} from "../app/data/fixtures/hatch-records";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { createModeFixtures, modeFixtures } from "../app/data/fixtures/modes";

describe("fixture factories", () => {
  it("preserves the current fixture counts", () => {
    const modes = createModeFixtures();
    expect(modes).toHaveLength(10);
    expect(createIncubatorFixtures(modes, Date.UTC(2026, 8, 3))).toHaveLength(
      12,
    );
    expect(createAlertFixtures(Date.UTC(2026, 8, 3))).toHaveLength(12);
    expect(createHatchRecordFixtures()).toHaveLength(12);
  });

  it("seeds alerts across today, yesterday, and last week", () => {
    const now = Date.UTC(2026, 8, 3, 12);
    const alerts = createAlertFixtures(now);
    const startOfDay = (value: number | string) => {
      const date = new Date(value);
      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ).getTime();
    };
    const alertsById = new Map(alerts.map((alert) => [alert.id, alert]));
    const daysAgo = (id: string) => {
      const alert = alertsById.get(id);
      if (!alert) throw new Error(`Missing alert fixture: ${id}`);
      return Math.round(
        (startOfDay(now) - startOfDay(alert.timestamp)) / 86_400_000,
      );
    };

    expect(daysAgo("a1")).toBe(0);
    expect(daysAgo("a5")).toBe(0);
    expect(daysAgo("a6")).toBe(1);
    expect(daysAgo("a8")).toBe(1);
    expect(daysAgo("a9")).toBe(7);
    expect(daysAgo("a12")).toBe(7);
  });

  it("returns fresh mutable copies without changing mode seeds", () => {
    const first = createModeFixtures();
    first[0].name = "Changed";
    first[0].targetTemp.min = 1;

    const second = createModeFixtures();
    expect(second[0].name).toBe(modeFixtures[0].name);
    expect(second[0].targetTemp.min).toBe(modeFixtures[0].targetTemp.min);
  });

  it("returns fresh hatch records without changing history seeds", () => {
    const records = createHatchRecordFixtures();
    records[0].hatchedEggs = 0;
    expect(hatchRecordFixtures[0].hatchedEggs).toBe(16);
  });

  it("creates independent nested incubator records", () => {
    const modes = createModeFixtures();
    const first = createIncubatorFixtures(modes, Date.UTC(2026, 8, 3));
    first[0].candlingLog[0].note = "Changed";

    const second = createIncubatorFixtures(modes, Date.UTC(2026, 8, 3));
    expect(second[0].candlingLog[0].note).not.toBe("Changed");
  });
});
