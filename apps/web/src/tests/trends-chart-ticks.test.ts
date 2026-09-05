import { describe, expect, it } from "vitest";
import {
  dedupeTickLabels,
  formatXTick,
  formatYTick,
  pickTimeTicks,
  yTickDecimals,
} from "../app/features/trends/chart-ticks";

// Mobile chart-tick contract:
// docs/refine/trends-mobile-chart-and-filter-plan.md
// Pre-fix behavior: raw recharts floats ("38.4" vs "38.05") and
// hour+minute 24h labels repeating the same wall time ("11:21 PM" ×3).

describe("yTickDecimals", () => {
  it("uses 1 decimal for temperature-scale spans", () => {
    expect(yTickDecimals(1.4)).toBe(1);
    expect(yTickDecimals(2)).toBe(1);
  });

  it("uses 2 decimals for sub-half spans and 0 beyond 2", () => {
    expect(yTickDecimals(0.4)).toBe(2);
    expect(yTickDecimals(40)).toBe(0);
    expect(yTickDecimals(0)).toBe(0);
  });
});

describe("formatYTick", () => {
  it("renders uniform 1-decimal labels including trailing .0", () => {
    expect(formatYTick(38.4, 1.4)).toBe("38.4");
    expect(formatYTick(38.06, 1.4)).toBe("38.1");
    expect(formatYTick(38, 1.4)).toBe("38.0");
    expect(formatYTick(37.7, 1.4)).toBe("37.7");
  });

  it("renders integers for humidity-scale spans", () => {
    expect(formatYTick(65.4, 40)).toBe("65");
  });
});

describe("formatXTick", () => {
  it("renders hour-only labels on the 24h range (no repeated :mm)", () => {
    const ts = new Date(2026, 8, 5, 13, 28).getTime();
    expect(formatXTick(ts, "24h")).not.toContain(":");
  });

  it("renders short dates on longer ranges", () => {
    const ts = new Date(2026, 8, 5, 13, 28).getTime();
    expect(formatXTick(ts, "7d")).toContain("Sep");
  });
});

describe("pickTimeTicks", () => {
  it("returns evenly spaced timestamps including both ends", () => {
    const data = [10, 20, 30, 40, 50, 60, 70];
    expect(pickTimeTicks(data, 3)).toEqual([10, 40, 70]);
  });

  it("returns all data when fewer points than requested", () => {
    expect(pickTimeTicks([5, 9], 5)).toEqual([5, 9]);
  });

  it("returns empty for empty data", () => {
    expect(pickTimeTicks([], 3)).toEqual([]);
  });
});

describe("dedupeTickLabels", () => {
  it("blanks consecutive repeats and keeps the first", () => {
    expect(dedupeTickLabels(["1 PM", "1 PM", "2 PM"])).toEqual([
      "1 PM",
      "",
      "2 PM",
    ]);
  });

  it("leaves distinct labels untouched", () => {
    expect(dedupeTickLabels(["11 PM", "11 AM", "11 PM"])).toEqual([
      "11 PM",
      "11 AM",
      "11 PM",
    ]);
  });
});
