import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("Alerts/Settings batch", () => {
  it("Alerts empty uses page-title", () => {
    const s = fs.readFileSync(
      "src/app/components/screens/AlertsScreen.tsx",
      "utf-8",
    );
    expect(s).toContain("var(--type-page-title)");
  });
  it("Alerts pill uses label token", () => {
    const s = fs.readFileSync(
      "src/app/components/screens/AlertsScreen.tsx",
      "utf-8",
    );
    expect(s).toContain("var(--type-label)");
    expect(s).toContain("var(--tracking-label)");
  });
  it("ModeLibraryPanel table uses body-sm", () => {
    const s = fs.readFileSync(
      "src/app/components/settings/ModeLibraryPanel.tsx",
      "utf-8",
    );
    expect(s).toContain("var(--type-body-sm)");
    expect(s).toContain("var(--font-body)");
  });
});
