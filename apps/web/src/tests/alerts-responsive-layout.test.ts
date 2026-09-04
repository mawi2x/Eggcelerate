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
    expect(source).toContain("sm:col-start-3 sm:row-start-1");
  });

  it("keeps compact status labels on one line", () => {
    expect(source).toContain(
      'className="whitespace-nowrap rounded-full px-2.5 py-0.5"',
    );
  });

  it("keeps quick actions visible on touch-sized layouts", () => {
    expect(source).toContain(
      "transition-opacity sm:absolute sm:inset-0 sm:opacity-0",
    );
    expect(source).not.toContain(
      "absolute inset-0 flex items-center justify-end gap-1 opacity-0",
    );
  });
});
