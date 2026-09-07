import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Mobile typography + component-sizing contract.
// Plan: docs/refine/mobile-typography-and-component-sizing-plan.md
// Style follows the repo's existing file-content contract tests (jsdom
// cannot evaluate media queries, so we assert the authored source).

const css = () =>
  fs.readFileSync(path.resolve("src/styles/theme.css"), "utf-8");
const src = (f: string) => fs.readFileSync(path.resolve(f), "utf-8");

describe("mobile typography tokens", () => {
  it("defines a control-value role decoupled from body copy", () => {
    expect(css()).toContain("--type-control-value: 0.875rem");
  });

  it("uses blanket phone decrease: every mobile token steps below desktop", () => {
    const c = css();
    const phone = c.match(
      /@media\s*\(\s*max-width:\s*39\.9375rem\s*\)\s*\{[\s\S]*?:root\s*\{([\s\S]*?)\}\s*\}/,
    );
    expect(phone).not.toBeNull();
    const block = phone?.[1] ?? "";
    expect(block).toContain("--type-page-title: 1.25rem");
    expect(block).toContain("--type-panel-title: 1.125rem");
    expect(block).toContain("--type-heading-lg: 1.125rem");
    expect(block).toContain("--type-heading-md: 1rem");
    expect(block).toContain("--type-heading-sm: 0.875rem");
    expect(block).toContain("--type-body-lg: 0.8125rem");
    expect(block).toContain("--type-body: 0.75rem");
    expect(block).toContain("--type-control-value: 0.75rem");
    expect(block).toContain("--type-body-sm: 0.6875rem");
    expect(block).toContain("--type-caption: 0.625rem");
    expect(block).toContain("--type-label: 0.5625rem");
    expect(block).toContain("--type-label-compact: 0.5rem");
    expect(block).toContain("--type-label-micro: 0.5rem");
    expect(c).not.toContain("max-width: 25rem");
  });
  it("keeps mobile visual controls compact and leaves hit areas explicit", () => {
    const c = css();
    expect(c).toContain("--control-height-default: 2.25rem");
    expect(c).toContain("--control-height-toolbar: 2.5rem");
    expect(c).toContain("--control-size-icon: 2.25rem");
    expect(c).toContain("--control-segment-height: 2.25rem");
    expect(c).toContain("--control-hit-area-icon: 2.75rem");
    expect(c).toContain("--type-filter-value: var(--type-control-value)");
    expect(c).toContain("--type-filter-value: 0.75rem");
    expect(c).toContain("--type-filter-value: 0.625rem");
    expect(c).toContain("--type-filter-label: var(--type-label)");
    expect(c).toContain("--type-filter-label: 0.625rem");
    expect(c).toMatch(
      /@media\s*\(\s*min-width:\s*48rem\s*\)\s*and\s*\(\s*max-width:\s*63\.9375rem\s*\)[\s\S]*--type-filter-value:\s*0\.75rem/,
    );
    expect(c).toMatch(
      /@media\s*\(\s*max-width:\s*47\.9375rem\s*\)[\s\S]*--type-filter-value:\s*0\.625rem[\s\S]*--type-filter-label:\s*0\.625rem/,
    );
    expect(c).not.toMatch(
      /@media\s*\(\s*max-width:\s*47\.9375rem\s*\)\s*\{[\s\S]*--control-(?:height-default|height-toolbar|size-icon|segment-height):/,
    );
  });

  it("routes @layer base element sizes through the same type roles", () => {
    const c = css();
    const base = c.slice(c.indexOf("@layer base"));
    expect(base).toContain("font-size: var(--type-page-title)");
    expect(base).toContain("font-size: var(--type-heading-lg)");
    expect(base).toContain("font-size: var(--type-control-value)");
    // No parallel --text-* size scale remains in base element defaults.
    expect(base).not.toMatch(/var\(--text-(2xl|xl|lg|base)\)/);
  });
});

describe("mobile form primitives", () => {
  it("Input uses the control-value role without lying Tailwind classes", () => {
    const s = src("src/app/components/ui/input.tsx");
    expect(s).toContain("var(--type-control-value)");
    expect(s).not.toContain("text-base");
    expect(s).not.toContain("md:text-sm");
  });

  it("SelectTrigger uses control values and compact mobile filter geometry", () => {
    const s = src("src/app/components/ui/select.tsx");
    expect(s).toContain("var(--type-control-value)");
    expect(s).toContain(
      '"h-[var(--control-height-default)] px-3 py-2 text-sm md:h-[var(--control-height-toolbar)]"',
    );
    expect(s).toContain('fontSize: "var(--type-filter-value)"');
    expect(s).toContain("size === \"filter\"");
  });
  it("every focusable text entry surface uses control-value (blanket decrease)", () => {
    // Blanket decrease: control-value is 12px on phones (below the 16px iOS
    // focus-zoom floor by request). Surfaces must still share the role var —
    // raw body/body-sm pins are the bug, not the floor.
    const form = src("src/app/components/auth/FormInput.tsx");
    expect(form).toContain("var(--type-control-value)");
    expect(form).not.toMatch(/fontSize: "var\(--type-body\)"/);
    const journal = src("src/app/components/detail/CandlingJournalTab.tsx");
    for (const m of journal.matchAll(
      /<(input|textarea)[\s\S]*?\/>|<(textarea)[\s\S]*?<\/textarea>/g,
    )) {
      const tag = m[0];
      if (/type="(file|hidden)"/.test(tag)) continue;
      if (/<(input|textarea)[\s\S]*fontSize/.test(tag)) {
        expect(tag).toContain("var(--type-control-value)");
      }
    }
  });

  it("Typography documents why micro variants do not exist", () => {
    const s = src("src/app/components/ui/typography.tsx");
    expect(s).toContain("no `labelCompact`/`labelMicro` variants on");
    expect(s).toContain("purpose. The only approved");
    expect(s).not.toMatch(/variant\?:.*labelMicro/);
  });
});

describe("mobile touch targets", () => {
  it("FilterBar scroll arrows are 44px targets with 16px glyphs", () => {
    const s = src("src/app/components/ui/filter-bar.tsx");
    expect(s).toContain("min-h-[44px]");
    expect(s).toContain("min-w-[44px]");
    expect(s).toContain("ChevronLeft size={16}");
    expect(s).toContain("ChevronRight size={16}");
    expect(s).not.toMatch(/h-7 w-5 items-center/);
  });

  it("ViewToggle sizes each button from the icon token, not group padding", () => {
    const s = src("src/app/components/ViewToggle.tsx");
    expect(s).toContain("h-[var(--control-size-icon)]");
    expect(s).toContain("w-[var(--control-size-icon)]");
  });

  it("shared checkbox keeps a 44px target around its compact visual mark", () => {
    const s = src("src/app/components/ui/checkbox.tsx");
    expect(s).toContain("size-11");
    expect(s).toContain("before:size-4");
  });

  it("keeps secondary dot navigation compact instead of expanding its layout row", () => {
    const overview = src("src/app/components/screens/OverviewScreen.tsx");
    const incubators = src("src/app/components/screens/IncubatorsScreen.tsx");
    const candling = src("src/app/components/screens/CandlingLogsScreen.tsx");
    expect(overview).toContain("h-1.5 cursor-pointer");
    expect(incubators).toContain("h-3 w-2 cursor-pointer");
    expect(candling).toContain("h-3 w-2 cursor-pointer");
    expect(overview).not.toContain("h-6 w-6 cursor-pointer");
    expect(overview).not.toContain("h-11 w-11 cursor-pointer");
    expect(incubators).not.toContain("h-6 w-6 cursor-pointer");
    expect(incubators).not.toContain("h-11 w-11 cursor-pointer");
    expect(candling).not.toContain("h-6 w-6 cursor-pointer");
    expect(candling).not.toContain("h-11 w-11 cursor-pointer");
  });

  it("sort actions use compact mobile geometry and shared target contract", () => {
    const incubators = src("src/app/components/screens/IncubatorsScreen.tsx");
    const candling = src("src/app/components/screens/CandlingLogsScreen.tsx");
    const trends = src("src/app/components/screens/TrendsScreen.tsx");
    const compactSortButton =
      "h-[34px] w-[34px]";
    expect(incubators).toContain(compactSortButton);
    expect(candling).toContain(compactSortButton);
    expect(incubators).toContain(
      "md:h-[var(--control-height-toolbar)] md:w-[var(--control-height-toolbar)]",
    );
    expect(candling).toContain(
      "md:h-[var(--control-height-toolbar)] md:w-[var(--control-height-toolbar)]",
    );
    expect(trends).toContain("md:min-h-[var(--control-height-compact)]");
    expect(trends).toContain('fontSize: "var(--type-body-sm)"');
  });

  it("Overview count badges use the 11px label minimum, not 10px", () => {
    const s = src("src/app/components/screens/OverviewScreen.tsx");
    expect(s).not.toContain("text-[10px]");
  });
});

describe("mobile micro-text source guard", () => {
  // SVG illustration geometry (GaugeDial, WaterDroplet computed <text>
  // sizes, Timeline node/phase-band measurements) and numeric
  // chart-library props are allowed exceptions — they are geometry, not
  // DOM text, and cannot consume CSS vars without extra plumbing. This
  // guard only matches literal DOM-text forms, so those files pass
  // regardless; no file allowlist needed unless a literal appears there.
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      return /\.tsx?$|\.css$/.test(e.name) ? [p] : [];
    });

  it("introduces no DOM text below 9px and no 9px DOM literals outside tokens", () => {
    const offenders: string[] = [];
    for (const f of walk(path.resolve("src"))) {
      if (/\.test\.[jt]sx?$/.test(f)) continue;
      const s = fs.readFileSync(f, "utf-8");
      if (
        /fontSize:\s*[0-8](?![\d.])/.test(s) ||
        /fontSize=\{[0-8](?![\d.])/.test(s) ||
        /text-\[[0-8]px\]/.test(s)
      ) {
        offenders.push(path.relative(path.resolve("src"), f));
      }
    }
    expect(offenders).toEqual([]);
  });
});
