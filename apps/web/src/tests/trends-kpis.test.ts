import { describe, expect, it } from "vitest";
import { createHatchRecordFixtures } from "../app/data/fixtures/hatch-records";
import {
  selectHatchKpis,
  selectHatchSpeciesSummaries,
  selectHatchSummary,
  selectHatchWithPct,
} from "../app/features/trends/selectors";

const history = createHatchRecordFixtures();

describe("selectHatchKpis", () => {
  it("counts cycles and sums hatched eggs", () => {
    const kpis = selectHatchKpis(selectHatchWithPct(history));
    expect(kpis.cycles).toBe(history.length);
    expect(kpis.hatched).toBe(history.reduce((s, h) => s + h.hatchedEggs, 0));
  });

  it("returns null avgRate for empty history", () => {
    expect(selectHatchKpis([])).toEqual({
      cycles: 0,
      hatched: 0,
      avgRate: null,
    });
  });
});

describe("hatch history summaries", () => {
  it("weights hatchability by fertile eggs rather than averaging percentages", () => {
    const records = [
      { ...history[0], totalEggs: 12, fertileEggs: 10, hatchedEggs: 10 },
      { ...history[1], totalEggs: 100, fertileEggs: 90, hatchedEggs: 45 },
    ];
    expect(selectHatchSummary(records)).toEqual({
      cycles: 2,
      totalEggs: 112,
      hatched: 55,
      unhatched: 57,
      ratedCycles: 2,
      ratedHatched: 55,
      ratedFertileEggs: 100,
      avgRate: 55,
    });
  });

  it("keeps unrated cycles in totals without inflating hatchability", () => {
    const records = [
      { ...history[0], totalEggs: 12, fertileEggs: 10, hatchedEggs: 8 },
      { ...history[1], totalEggs: 20, fertileEggs: null, hatchedEggs: 15 },
      { ...history[2], totalEggs: 5, fertileEggs: 0, hatchedEggs: 0 },
    ];
    expect(selectHatchSummary(records)).toMatchObject({
      cycles: 3,
      totalEggs: 37,
      hatched: 23,
      unhatched: 14,
      ratedCycles: 1,
      ratedHatched: 8,
      ratedFertileEggs: 10,
      avgRate: 80,
    });
    expect(selectHatchKpis(selectHatchWithPct(records)).avgRate).toBe(80);
  });

  it("returns an unavailable rate for empty or entirely unrated history", () => {
    expect(selectHatchSummary([])).toMatchObject({
      cycles: 0,
      totalEggs: 0,
      hatched: 0,
      unhatched: 0,
      ratedCycles: 0,
      avgRate: null,
    });
    for (const fertileEggs of [null, 0, 1, 1.5]) {
      expect(
        selectHatchSummary([{ ...history[0], fertileEggs, hatchedEggs: 2 }])
          .avgRate,
      ).toBeNull();
    }
  });

  it("includes a known cycle with no chicks as a zero percent result", () => {
    expect(
      selectHatchSummary([{ ...history[0], fertileEggs: 10, hatchedEggs: 0 }]),
    ).toMatchObject({ ratedCycles: 1, avgRate: 0 });
  });

  it("groups species with weighted rates and keeps unknown species rates visible", () => {
    const records = [
      { ...history[0], modeName: "Quail", fertileEggs: 10, hatchedEggs: 10 },
      {
        ...history[1],
        modeName: "Quail",
        totalEggs: 100,
        fertileEggs: 90,
        hatchedEggs: 45,
      },
      { ...history[2], modeName: "Duck", fertileEggs: null, hatchedEggs: 5 },
    ];
    const before = records.map((record) => ({ ...record }));
    const result = selectHatchSpeciesSummaries(records);
    expect(result.map((group) => group.species)).toEqual(["Duck", "Quail"]);
    expect(result[0]).toMatchObject({ cycles: 1, hatched: 5, avgRate: null });
    expect(result[1]).toMatchObject({ cycles: 2, hatched: 55, avgRate: 55 });
    expect(records).toEqual(before);
    expect(selectHatchSpeciesSummaries([])).toEqual([]);
  });
});
