import { describe, it, expect } from "vitest";
import fs from "fs";
describe("typography tokens", () => {
  it("theme.css defines type tokens", () => {
    const css = fs.readFileSync("src/styles/theme.css", "utf-8");
    expect(css).toContain("--type-page-title: 1.5rem");
    expect(css).toContain("--type-body: 0.875rem");
    expect(css).toContain("--weight-bold: 700");
    expect(css).toContain("--leading-snug: 1.25");
    expect(css).toContain("--tracking-label: 0.05em");
  });
  it("root is 100% not 16px", () => {
    const css = fs.readFileSync("src/styles/theme.css", "utf-8");
    expect(css).toMatch(/html\s*\{\s*font-size:\s*100%/);
    expect(css).not.toContain("--font-size: 16px");
  });
  it("PageHeader uses type tokens not hardcoded 24/14", () => {
    const s = fs.readFileSync("src/app/components/PageHeader.tsx", "utf-8");
    expect(s).toContain("var(--type-page-title)");
    expect(s).toContain("var(--type-body)");
    expect(s).not.toMatch(/fontSize:\s*24[^r]/); // no raw 24px
  });
});
