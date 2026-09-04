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
    // Either direct token use or shared Typography primitive with the same roles
    expect(s).toMatch(/var\(--type-page-title\)|variant="pageTitle"|variant='pageTitle'/);
    expect(s).toMatch(/var\(--type-body\)|variant="body"|<Typography/);
    expect(s).toContain("Typography");
    expect(s).not.toMatch(/fontSize:\s*24[^r]/); // no raw 24px
  });
  it("PanelHeader and SectionCard route through Typography", () => {
    const panel = fs.readFileSync(
      "src/app/components/settings/tokens.tsx",
      "utf-8",
    );
    expect(panel).toContain("Typography");
    expect(panel).toMatch(/variant="panelTitle"/);
    expect(panel).toMatch(/variant="bodySmall"|variant="body"/);
    expect(panel).not.toMatch(/fontSize:\s*"var\(--type-panel-title\)"|fontSize:\s*22[^r]/);

    const card = fs.readFileSync(
      "src/app/components/detail/primitives.tsx",
      "utf-8",
    );
    expect(card).toContain("Typography");
    expect(card).toMatch(/variant="headingSmall"/);
    expect(card).toMatch(/variant="caption"/);
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
  it("type scale steps down the two largest tokens below sm", () => {
    const css = fs.readFileSync("src/styles/theme.css", "utf-8");
    expect(css).toMatch(
      /@media\s*\(\s*max-width:\s*39\.9375rem\s*\)[\s\S]*?--type-page-title:\s*1\.25rem/,
    );
    expect(css).toMatch(
      /@media\s*\(\s*max-width:\s*39\.9375rem\s*\)[\s\S]*?--type-panel-title:\s*1\.125rem/,
    );
  });
});
