import { describe, expect, it } from "vitest";
import { createHatchRecordFixtures } from "../app/data/fixtures/hatch-records";
import {
  selectFilteredHatch,
  selectHatchWithPct,
  selectSortedHatch,
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

describe("selectSortedHatch", () => {
  const records = selectHatchWithPct([
    {
      ...history[0],
      id: "older",
      endDate: "2026-05-01",
      fertileEggs: 10,
      hatchedEggs: 9,
    },
    {
      ...history[0],
      id: "newer",
      endDate: "2026-06-01",
      fertileEggs: 10,
      hatchedEggs: 5,
    },
    { ...history[0], id: "unknown", endDate: "2026-07-01", fertileEggs: null },
  ]);
  it("orders by cycle completion date without mutating the input", () => {
    expect(selectSortedHatch(records, "newest").map((r) => r.id)).toEqual([
      "unknown",
      "newer",
      "older",
    ]);
    expect(selectSortedHatch(records, "oldest").map((r) => r.id)).toEqual([
      "older",
      "newer",
      "unknown",
    ]);
    expect(records.map((r) => r.id)).toEqual(["older", "newer", "unknown"]);
  });
  it("keeps unavailable hatchability last in either percentage direction", () => {
    expect(selectSortedHatch(records, "highest").map((r) => r.id)).toEqual([
      "older",
      "newer",
      "unknown",
    ]);
    expect(selectSortedHatch(records, "lowest").map((r) => r.id)).toEqual([
      "newer",
      "older",
      "unknown",
    ]);
  });
  it("breaks ties deterministically and keeps invalid dates last", () => {
    const tied = [
      { ...records[0], id: "b" },
      { ...records[0], id: "a" },
      { ...records[0], id: "invalid", endDate: "invalid" },
    ];
    expect(selectSortedHatch(tied, "newest").map((r) => r.id)).toEqual([
      "a",
      "b",
      "invalid",
    ]);
    expect(selectSortedHatch(tied, "oldest").map((r) => r.id)).toEqual([
      "a",
      "b",
      "invalid",
    ]);
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
