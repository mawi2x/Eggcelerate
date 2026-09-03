import { describe, expect, it } from "vitest";
import { createHatchRecordFixtures } from "../app/data/fixtures/hatch-records";
import {
  selectFilteredHatch,
  selectHatchWithPct,
} from "../app/features/trends/selectors";

const history = createHatchRecordFixtures();

describe("selectHatchWithPct", () => {
  it("annotates each record with hatchability pct", () => {
    const result = selectHatchWithPct(history);
    expect(result).toHaveLength(history.length);
    expect(result[0]).toHaveProperty("pct");
  });

  it("leaves input records unmutated", () => {
    const before = history.map((h) => ({ ...h }));
    selectHatchWithPct(history);
    expect(history).toEqual(before);
  });
});

describe("selectFilteredHatch", () => {
  it("returns all rows when species is All and query is blank", () => {
    const withPct = selectHatchWithPct(history);
    expect(
      selectFilteredHatch(withPct, { search: "   ", species: "All" }),
    ).toHaveLength(withPct.length);
  });

  it("filters by species", () => {
    const withPct = selectHatchWithPct(history);
    const species = withPct[0].modeName;
    const result = selectFilteredHatch(withPct, { search: "", species });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((h) => h.modeName === species)).toBe(true);
  });

  it("matches chamber or mode name case-insensitively", () => {
    const withPct = selectHatchWithPct(history);
    const result = selectFilteredHatch(withPct, {
      search: withPct[0].chamber.slice(0, 4).toUpperCase(),
      species: "All",
    });
    expect(result.length).toBeGreaterThan(0);
  });
});
