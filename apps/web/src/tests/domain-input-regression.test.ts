import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  accountInitials,
  initialAccount,
  resolveDisplayName,
} from "../app/data/account";
import { modeToDTO, parseModeDTO, toResult } from "../app/data/dto";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { modeFixtures } from "../app/data/fixtures/modes";
import {
  calculateFertilityRate,
  calculateHatchabilityRate,
  getKnownFertileEggs,
  validateHarvestCounts,
} from "../app/domain/fertility";
import { getUnitIssues, isHatchingSoon } from "../app/domain/incubator";
import {
  selectFilteredIncubators,
  selectSortedIncubators,
} from "../app/features/incubators/selectors";

describe("validated farm inputs", () => {
  it("keeps profile labels readable for blank and single-word names", () => {
    expect(accountInitials({ ...initialAccount, accountHolder: "   " })).toBe(
      "?",
    );
    expect(accountInitials({ ...initialAccount, accountHolder: "Mawi" })).toBe(
      "M",
    );
    expect(
      resolveDisplayName({
        ...initialAccount,
        displayName: "   ",
        accountHolder: " Mawi Santos ",
      }),
    ).toBe("Mawi");
    expect(
      resolveDisplayName({
        ...initialAccount,
        displayName: "",
        accountHolder: "",
      }),
    ).toBe("");
  });
  it("keeps legacy chamber names in deterministic order and uses the default mode for missing assignments", () => {
    const modes = [...modeFixtures];
    const base = createIncubatorFixtures(modes)[0];
    const units = [
      "Chamber Zulu",
      "Chamber Alpha",
      "Chamber One",
      "Chamber 1",
    ].map((name, index) => ({
      ...base,
      id: `legacy-${index}`,
      name,
      modeId: "missing",
      cyclePhase: "incubating" as const,
      status: "optimal" as const,
    }));
    expect(
      selectFilteredIncubators(units, modes, {
        search: "Broiler",
        status: "all",
        modeId: "all",
      }),
    ).toHaveLength(4);
    expect(
      selectFilteredIncubators(units, modes, {
        search: "Quail",
        status: "all",
        modeId: "all",
      }),
    ).toHaveLength(0);
    const sorted = selectSortedIncubators(units, modes, {
      sort: "name",
      sortAsc: true,
      prioritizeIssues: true,
    });
    expect(sorted.map((unit) => unit.name)).toEqual([
      "Chamber 1",
      "Chamber One",
      "Chamber Alpha",
      "Chamber Zulu",
    ]);
    expect(
      selectSortedIncubators(units, modes, {
        sort: "progress",
        sortAsc: false,
      }).map((unit) => unit.id),
    ).toEqual(sorted.map((unit) => unit.id));
    expect(units[0].name).toBe("Chamber Zulu");
  });
  it("converts modes and preserves useful validation and unexpected error messages", () => {
    const dto = modeToDTO(modeFixtures[0]);
    expect(dto.default_turn_interval_min).toBe(
      modeFixtures[0].defaultTurnInterval * 60,
    );
    expect(parseModeDTO(dto)).toEqual({ ok: true, data: dto });
    expect(parseModeDTO({ ...dto, incubation_days: 0 })).toMatchObject({
      ok: false,
      error: { code: "validation_error" },
    });
    expect(
      toResult(() => {
        throw new Error("Sensor unavailable");
      }),
    ).toMatchObject({ ok: false, error: { message: "Sensor unavailable" } });
    expect(
      toResult(() => {
        throw "Malformed packet";
      }),
    ).toMatchObject({ ok: false, error: { message: "Malformed packet" } });
    expect(
      toResult(() => {
        throw new z.ZodError([]);
      }),
    ).toMatchObject({ ok: false, error: { message: "Validation failed" } });
  });
  it("identifies low and high readings, power, overdue turns and disconnected devices", () => {
    const base = createIncubatorFixtures(modeFixtures)[0];
    const mode = modeFixtures[0];
    expect(
      getUnitIssues(
        {
          ...base,
          temp: 50,
          humidity: 99,
          waterOk: false,
          powerSource: "battery",
          batteryPct: 10,
          nextTurn: "2000-01-01T00:00:00Z",
          paired: false,
        },
        mode,
      ),
    ).toEqual([
      "temperature high",
      "humidity high",
      "water reservoir low",
      "battery low",
      "turning overdue",
      "device disconnected",
    ]);
    expect(
      getUnitIssues(
        {
          ...base,
          temp: 20,
          humidity: 10,
          waterOk: true,
          powerSource: "grid",
          nextTurn: "2100-01-01T00:00:00Z",
          paired: true,
        },
        mode,
      ),
    ).toEqual(["temperature low", "humidity low"]);
    expect(
      getUnitIssues(
        {
          ...base,
          temp: 37.6,
          humidity: 57,
          waterOk: true,
          powerSource: "battery",
          batteryPct: 80,
          nextTurn: "2100-01-01T00:00:00Z",
          paired: true,
        },
        mode,
      ),
    ).toEqual([]);
    expect(isHatchingSoon(19, 21)).toBe(true);
    expect(isHatchingSoon(5, 21)).toBe(false);
  });
  it.each([
    [{ totalEggs: 0, fertileEggs: null, hatchedEggs: 0 }, "Total eggs"],
    [{ totalEggs: 10, fertileEggs: null, hatchedEggs: -1 }, "Hatched eggs"],
    [{ totalEggs: 10, fertileEggs: null, hatchedEggs: 1.5 }, "Hatched eggs"],
    [{ totalEggs: 10, fertileEggs: -1, hatchedEggs: 0 }, "Fertile eggs"],
    [{ totalEggs: 10, fertileEggs: 11, hatchedEggs: 0 }, "Fertile eggs"],
    [{ totalEggs: 10, fertileEggs: 1.5, hatchedEggs: 0 }, "Fertile eggs"],
    [{ totalEggs: 10, fertileEggs: 5, hatchedEggs: 6 }, "known fertile count"],
  ])("rejects invalid harvest counts %j", (input, message) => {
    expect(validateHarvestCounts(input)).toContain(message);
  });
  it("keeps fertility unknown until a positive observation and chooses the earliest observation", () => {
    const base = createIncubatorFixtures(modeFixtures)[0];
    expect(
      getKnownFertileEggs({ ...base, fertileEggs: undefined, candlingLog: [] }),
    ).toBeNull();
    const entry = base.candlingLog[0];
    expect(
      getKnownFertileEggs({
        ...base,
        fertileEggs: 0,
        candlingLog: [
          { ...entry, date: "2026-10-02", fertile: 7 },
          { ...entry, date: "2026-10-01", fertile: 8 },
          { ...entry, date: "2026-09-30", fertile: 0 },
        ],
      }),
    ).toBe(8);
    expect(calculateFertilityRate(2.5, 10)).toBeNull();
    expect(calculateFertilityRate(-1, 10)).toBeNull();
    expect(calculateHatchabilityRate(-1, 10)).toBeNull();
    expect(calculateHatchabilityRate(2, 1.5)).toBeNull();
  });
});
