import { describe, it, expect } from "vitest";
import {
  calculateFertilityRate,
  calculateHatchabilityRate,
  getKnownFertileEggs,
  validateHarvestCounts,
} from "../app/domain/fertility";

describe("calculations", () => {
  it("fertility null when eggs 0", () => expect(calculateFertilityRate(10, 0)).toBeNull());
  it("fertility null when fertile negative", () => expect(calculateFertilityRate(-1, 10)).toBeNull());
  it("fertility null when fertile exceeds eggs set", () => expect(calculateFertilityRate(11, 10)).toBeNull());
  it("hatchability null when fertile null", () => expect(calculateHatchabilityRate(10, null)).toBeNull());
  it("hatchability null when fertile 0", () => expect(calculateHatchabilityRate(10, 0)).toBeNull());
  it("hatchability null when hatched is negative", () => expect(calculateHatchabilityRate(-1, 10)).toBeNull());
  it("hatchability null when hatched exceeds fertile", () => expect(calculateHatchabilityRate(11, 10)).toBeNull());
  it("rounds to 1 decimal 3/7=42.9", () => expect(calculateFertilityRate(3, 7)).toBeCloseTo(42.9, 1));
  it("hatchability 9/10 fertile =90.0", () => expect(calculateHatchabilityRate(9, 10)).toBeCloseTo(90.0, 1));
  it("getKnownFertile uses fertileEggs before log", () => {
    const unit = { fertileEggs: 12, candlingLog: [{ fertile: 5, date: "2026-06-01" }] } as unknown as Parameters<typeof getKnownFertileEggs>[0];
    expect(getKnownFertileEggs(unit)).toBe(12);
  });
});

describe("harvest validation", () => {
  const invalidHarvest = {
    chamber: "Test Chamber",
    modeName: "Broiler",
    cycleDays: 21,
    totalEggs: 12,
    fertileEggs: 8,
    hatchedEggs: 9,
  };

  it("rejects a hatched count above the known fertile count", () => {
    expect(validateHarvestCounts(invalidHarvest)).toMatch(/fertile/i);
  });

});
