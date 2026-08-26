import fs from "fs";
import { describe, it, expect } from "vitest";
describe("Trends/Detail batch", () => {
  it("Trends chart title uses heading-md", () => {
    const s = fs.readFileSync("src/app/components/screens/TrendsScreen.tsx","utf-8");
    expect(s).toContain("var(--type-heading-md)");
  });
  it("Calendar 8px fixed", () => {
    const s = fs.readFileSync("src/app/components/detail/IncubationCalendar.tsx","utf-8");
    expect(s).not.toMatch(/fontSize:\s*8[^r]/);
    expect(s).toContain("var(--type-label)");
  });
});
