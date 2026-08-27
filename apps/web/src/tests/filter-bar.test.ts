import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
describe("filter-bar primitive", () => {
  it("filter-bar.tsx exists and uses semantic tokens not hardcoded hex", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/ui/filter-bar.tsx"), "utf-8");
    expect(s).toContain("var(--brand-primary)");
    expect(s).toContain("var(--type-label)");
    expect(s).toContain("var(--weight-bold)");
    expect(s).toContain("var(--tracking-label)");
    expect(s).toContain("rounded-full");
    expect(s).toContain("aria-pressed");
    expect(s).not.toMatch(/#F5EDD8|#5C4636|#A84323/);
    expect(s).not.toMatch(/fontSize:\s*11[^r]/);
    expect(s).not.toMatch(/fontSize:\s*13[^r]/);
  });
  it("theme has required tokens", () => {
    const css = fs.readFileSync(path.resolve("src/styles/theme.css"), "utf-8");
    expect(css).toContain("--type-label: 0.6875rem");
    expect(css).toContain("--tracking-label: 0.05em");
    expect(css).toContain("--brand-primary: #AD3A1D");
  });
  it("AlertsScreen uses FilterBar not hardcoded pill styles", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/screens/AlertsScreen.tsx"), "utf-8");
    expect(s).toContain("FilterBar");
    expect(s).toContain('ariaLabel="Alert filter"');
    expect(s).not.toMatch(/backgroundColor: active \? RUST : "#F5EDD8"/);
    expect(s).not.toMatch(/"#5C4636"/);
    const barSlice = s.slice(Math.max(0, s.indexOf("FilterBar") - 200), s.indexOf("FilterBar") + 800);
    expect(barSlice).not.toMatch(/fontSize: "var\(--type-body-sm\)"/);
  });
  it("IncubatorsScreen uses FilterBar not inline 11 raw", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/screens/IncubatorsScreen.tsx"), "utf-8");
    expect(s).toContain("FilterBar");
    expect(s).toContain('ariaLabel="Incubator status filter"');
    expect(s).not.toMatch(/fontSize: 11,/);
    expect(s.match(/FilterBar/g)?.length).toBeGreaterThanOrEqual(1);
  });
  it("TrendsScreen horizon uses FilterBar not rounded-xl", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/screens/TrendsScreen.tsx"), "utf-8");
    expect(s).toContain("FilterBar");
    expect(s).toContain('ariaLabel="Time horizon"');
    // horizon section should not contain rounded-xl after migration
    const horizon = s.slice(s.indexOf('ariaLabel="Time horizon"') - 500, s.indexOf('ariaLabel="Time horizon"') + 500);
    expect(horizon).not.toContain("rounded-xl");
  });
  it("no remaining hardcoded pill styles in filter bars", () => {
    const files = [
      "src/app/components/screens/AlertsScreen.tsx",
      "src/app/components/screens/IncubatorsScreen.tsx",
      "src/app/components/screens/TrendsScreen.tsx",
    ];
    for (const f of files) {
      const s = fs.readFileSync(path.resolve(f), "utf-8");
      if (s.includes("FilterBar")) {
        expect(s).not.toMatch(/"#F5EDD8"/);
        expect(s).not.toMatch(/"#5C4636"/);
        // bar should not contain raw fontSize: 11 number (tokenized)
        const barSlice = s.slice(s.indexOf("FilterBar") - 200, s.indexOf("FilterBar") + 800);
        expect(barSlice).not.toMatch(/fontSize:\s*11[^r]/);
      }
    }
  });
  it("FilterBar has focus ring and aria-pressed", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/ui/filter-bar.tsx"), "utf-8");
    expect(s).toContain("focus-visible:ring-2");
    expect(s).toContain("aria-pressed");
    expect(s).toContain('role="group"');
  });
});
