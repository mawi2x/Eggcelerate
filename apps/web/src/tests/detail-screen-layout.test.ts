import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("detail screen layout", () => {
  it("keeps the detail tab navigation left-aligned at every breakpoint", () => {
    const source = fs.readFileSync(
      path.resolve("src/app/components/screens/DetailScreen.tsx"),
      "utf-8",
    );
    const subTabNav = source.slice(
      source.indexOf("function SubTabNav"),
      source.indexOf("export function DetailScreen"),
    );

    expect(subTabNav).toContain("justify-start");
    expect(subTabNav).toContain("overflow-x-auto overflow-y-hidden");
    expect(subTabNav).not.toContain("lg:justify-end");
  });
  it("uses phone-sized detail padding and touch-sized calendar navigation", () => {
    const settings = fs.readFileSync(
      path.resolve("src/app/components/detail/DeviceSettingsTab.tsx"),
      "utf-8",
    );
    const calendar = fs.readFileSync(
      path.resolve("src/app/components/detail/IncubationCalendar.tsx"),
      "utf-8",
    );

    expect(settings).toContain(
      'className="min-w-0 flex-1 rounded-2xl p-4 md:p-6"',
    );
    expect(settings).not.toContain("padding: 24");
    expect(calendar).toContain(
      "h-[var(--control-hit-area-icon)] w-[var(--control-hit-area-icon)]",
    );
    expect(calendar).toContain(
      "md:h-[var(--control-size-icon)] md:w-[var(--control-size-icon)]",
    );
  });
});
