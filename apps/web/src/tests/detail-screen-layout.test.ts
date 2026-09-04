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
    expect(subTabNav).not.toContain("lg:justify-end");
  });
});
