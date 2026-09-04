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
