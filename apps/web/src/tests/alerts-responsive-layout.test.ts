import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("alerts responsive row layout", () => {
  const source = fs.readFileSync(
    path.resolve("src/app/components/screens/AlertsScreen.tsx"),
    "utf-8",
  );

  it("moves alert metadata below the message on narrow screens", () => {
    expect(source).toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(source).toContain("col-start-2 row-start-2");
    expect(source).toContain("md:col-start-3 md:row-start-1");
  });

  it("keeps compact status labels on one line", () => {
    expect(source).toContain(
      'className="whitespace-nowrap rounded-full px-2.5 py-0.5"',
    );
  });

  it("keeps the Important filter label consistent across viewports", () => {
    const filterStart = source.indexOf("<FilterBar");
    const filterEnd = source.indexOf("/>", filterStart);
    const filter = source.slice(filterStart, filterEnd);
    expect(filter).toContain('label: "Important"');
    expect(filter).not.toContain('mobileLabel: "Urgent"');
    expect(filter).not.toContain('compactMobileLabel: "Urg"');
  });

  it("keeps quick actions visible on touch-sized layouts", () => {
    expect(source).toContain(
      "transition-opacity md:absolute md:inset-0 md:opacity-0",
    );
    expect(source).not.toContain(
      "absolute inset-0 flex items-center justify-end gap-1 opacity-0",
    );
  });

  it("docks day headers flush under the sticky toolbar at every breakpoint", () => {
    expect(source).toContain('className="space-y-0"');
    // Day-header sticky tops must equal the toolbar heights per breakpoint
    // (base/md/lg); any gap shoves the header down over the first row.
    const lines = source.split("\n");
    const toolbarLine =
      lines.find((l) => l.includes("sticky top-0 z-30")) ?? "";
    const dayLine = lines.find((l) => l.includes("sticky top-[")) ?? "";
    const dims = (text: string, prop: string) => {
      const out: Record<string, number> = {};
      for (const m of text.matchAll(/(?:(md|lg):)?(h|top)-\[(\d+)px\]/g)) {
        if (m[2] === prop) out[m[1] || "base"] = Number(m[3]);
      }
      return out;
    };
    const toolbar = dims(toolbarLine, "h");
    const dayTop = dims(dayLine, "top");
    expect(Object.keys(toolbar).sort()).toEqual(["base", "lg", "md"]);
    expect(dayTop).toEqual(toolbar);
    expect(source).not.toContain("toolbarHeight");
    expect(source).not.toContain("ResizeObserver");
  });
});
