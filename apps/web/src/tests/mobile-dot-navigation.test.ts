import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const screens = [
  "src/app/components/screens/IncubatorsScreen.tsx",
  "src/app/components/screens/CandlingLogsScreen.tsx",
];

describe("mobile dot navigation contracts", () => {
  for (const screen of screens) {
    it(`${path.basename(screen)} moves focus to the selected card`, () => {
      const source = fs.readFileSync(path.resolve(screen), "utf-8");

      expect(source).toContain("querySelector<HTMLElement>");
      expect(source).toMatch(/\?\.focus\(\{\s*preventScroll: true/);
      expect(source).toContain("setActiveCardIndex(index)");
    });

    it(`${path.basename(screen)} contains the fixed track at narrow or zoomed viewports`, () => {
      const source = fs.readFileSync(path.resolve(screen), "utf-8");

      expect(source).toContain(
        "max-h-[calc(100dvh-var(--mobile-bottom-nav-clearance)-1rem)]",
      );
      expect(source).toContain("max-[20rem]:hidden");
      expect(source).toContain("overflow-y-auto");
      expect(source).toContain("m-0");
      expect(source).toContain("min-w-0");
    });

    it(`${path.basename(screen)} exposes text alternatives for dot status`, () => {
      const source = fs.readFileSync(path.resolve(screen), "utf-8");

      expect(source).toContain("aria-label={`Scroll to ${");
      expect(source).toContain("title={`${");
    });
  }
});
