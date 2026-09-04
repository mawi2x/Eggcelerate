import { describe, expect, it } from "vitest";
import { createHatchRecordFixtures } from "../app/data/fixtures/hatch-records";
import {
  selectHatchKpis,
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
