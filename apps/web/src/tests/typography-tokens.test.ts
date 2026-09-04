import fs from "node:fs";
import { describe, expect, it } from "vitest";

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
  it("button/input/label use body token", () => {
    const btn = fs.readFileSync("src/app/components/ui/button.tsx", "utf-8");
    // allow Tailwind text-sm (0.875rem = var(--type-body)) or var(--type-body)
    expect(btn).toMatch(/text-sm|var\(--type-body\)/);
    const input = fs.readFileSync("src/app/components/ui/input.tsx", "utf-8");
    expect(input).toContain("var(--type-body)");
    expect(input).toContain("var(--font-body)");
    const label = fs.readFileSync("src/app/components/ui/label.tsx", "utf-8");
    expect(label).toContain("var(--type-body)");
    expect(label).toContain("var(--font-body)");
    expect(label).toContain("var(--weight-medium)");
    const select = fs.readFileSync("src/app/components/ui/select.tsx", "utf-8");
    expect(select).toContain("var(--type-body)");
    expect(select).toContain("var(--font-body)");
  });
  it("sidebar brand and nav labels use type tokens", () => {
    const sb = fs.readFileSync("src/app/components/AppSidebar.tsx", "utf-8");
    expect(sb).toContain("var(--type-heading-md)");
    expect(sb).toContain("var(--font-display)");
    expect(sb).toContain("var(--type-label)");
    expect(sb).toContain("var(--tracking-label)");
    expect(sb).toContain("var(--weight-bold)");
    expect(sb).not.toMatch(/fontFamily:\s*"Baloo 2, sans-serif"/);
  });
});
