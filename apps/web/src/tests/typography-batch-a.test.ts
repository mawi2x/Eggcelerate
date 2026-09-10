import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("Shared KPI batch", () => {
  it("KPI uses panel-title token", () => {
    const s = fs.readFileSync(
      "src/app/components/KpiCard.tsx",
      "utf-8",
    );
    expect(s).toMatch(
      /var\(--type-panel-title\)|text-\(length:--type-panel-title\)/,
    );
    expect(s).toContain("var(--font-display)");
    expect(s).not.toMatch(/fontSize:\s*22[^r]/);
  });
});
