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
});
