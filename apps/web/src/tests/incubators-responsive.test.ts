import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Incubator grid responsive contracts.
// Guards the regression where the Reading tile lost its inner padding:
// layout structure (columns, padding, overflow, bottom clearance) is
// asserted from source because jsdom cannot evaluate viewports.
// True glyph non-overflow at 320px still needs a viewport eyeball.

const screen = () =>
  fs.readFileSync(
    path.resolve("src/app/components/screens/IncubatorsScreen.tsx"),
    "utf-8",
  );
const card = () =>
  fs.readFileSync(
    path.resolve("src/app/components/IncubatorCard.tsx"),
    "utf-8",
  );

describe("incubator grid responsive contracts", () => {
  it("collapses columns 1 -> 2 -> 3 across lg/xl breakpoints", () => {
    expect(screen()).toContain(
      "grid grid-cols-1 gap-2 md:gap-5 lg:grid-cols-2 xl:grid-cols-3",
    );
  });

  it("Reading tile keeps inner padding so labels never sit on the border", () => {
    const s = card();
    const tile = s.slice(s.indexOf("function Reading("));
    // Padding must be a nonzero rem value, not a bare number or zero.
    expect(tile).toMatch(/padding:\s*"0\.\d+rem"/);
    expect(tile).not.toMatch(/padding:\s*0[,}]/);
  });

  it("Reading tile clips overflow instead of squeezing the grid", () => {
    const s = card();
    const tile = s.slice(s.indexOf("function Reading("));
    expect(tile).toContain('className="min-w-0 overflow-hidden rounded-2xl"');
    expect(tile).toContain('whiteSpace: "nowrap"');
  });

  it("stat tiles stay three-up with fixed gaps on all viewports", () => {
    expect(card()).toContain("grid grid-cols-3 gap-2");
  });

  it("content clears the mobile bottom nav with room for the last card", () => {
    const app = fs.readFileSync(path.resolve("src/app/App.tsx"), "utf-8");
    expect(app).toContain("pb-44");
    expect(screen()).toContain("h-16 md:hidden");
  });
});
