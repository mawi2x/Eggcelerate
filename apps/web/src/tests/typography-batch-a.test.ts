import fs from "fs";
import { describe, it, expect } from "vitest";
describe("Overview batch", () => {
  it("KPI uses panel-title token", () => {
    const s = fs.readFileSync("src/app/components/screens/OverviewScreen.tsx","utf-8");
    expect(s).toContain("var(--type-panel-title)");
    expect(s).toContain("var(--font-display)");
    expect(s).not.toMatch(/fontSize:\s*22[^r]/);
  });
});
