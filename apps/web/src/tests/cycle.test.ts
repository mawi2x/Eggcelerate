import { describe, it, expect } from "vitest";
import { cyclePhaseFromDay } from "../app/domain/cycle";
describe("harness jsdom check", () => {
  it("jsdom document exists", () => {
    expect(document).toBeDefined();
    expect(cyclePhaseFromDay({ dayOfIncubation: 0, incubationDays: 21, lockdownDay: 18 })).toBe("ready");
  });
});
