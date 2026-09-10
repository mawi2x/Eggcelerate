import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Semantic sections and consistent record components.
// Guards the semantic-sections-standardization plan: labelled sections,
// one explicit named control per record, no container-as-button regressions.
// Asserted from source because jsdom cannot evaluate AT semantics.

const src = (p: string) => fs.readFileSync(path.resolve(p), "utf-8");

describe("labelled page sections", () => {
  it("Overview sections link to their visible headings", () => {
    const s = src("src/app/components/screens/OverviewScreen.tsx");
    expect(s).toContain('aria-labelledby="active-incubators-title"');
    expect(s).toContain('id="active-incubators-title"');
    expect(s).toContain('aria-labelledby="conditions-to-check-title"');
    expect(s).toContain('id="conditions-to-check-title"');
  });

  it("Settings panels render labelled sections, not one generic wrapper", () => {
    const s = src("src/app/components/screens/SettingsScreen.tsx");
    for (const id of ["modes", "notifications", "account", "hardware"]) {
      expect(s).toContain(`aria-labelledby="settings-panel-${id}"`);
      // Section mounts with its panel so the labelledby target always exists.
      expect(s).toContain(`{category === "${id}" && (`);
    }
    const tokens = src("src/app/components/settings/tokens.tsx");
    expect(tokens).toContain("id?: string");
  });

  it("DeviceSettings content names the active sub-tab", () => {
    const s = src("src/app/components/detail/DeviceSettingsTab.tsx");
    expect(s).toContain('id="device-settings-mode-title"');
    expect(s).toContain('id="device-settings-turning-title"');
    expect(s).toContain('id="device-settings-device-title"');
    expect(s).toContain("aria-labelledby={");
  });

  it("notification rule groups link to their headings", () => {
    const s = src("src/app/components/settings/NotificationsPanel.tsx");
    expect(s).toContain("aria-labelledby={`notification-rule-");
    expect(s).toContain("<GroupLabel id={`notification-rule-");
  });

  it("Hardware preference groups are headed sections", () => {
    const s = src("src/app/components/settings/HardwarePanel.tsx");
    for (const id of ["sampling", "calibration", "display"]) {
      expect(s).toContain(`aria-labelledby="hardware-group-${id}"`);
      expect(s).toContain(`id="hardware-group-${id}"`);
    }
  });

  it("Trends chart keeps labelledby and describes instead of duplicating", () => {
    const s = src("src/app/components/screens/TrendsScreen.tsx");
    expect(s).toContain('aria-labelledby="environmental-chart-title"');
    expect(s).toContain('aria-describedby="environmental-chart-desc"');
    expect(s).toContain('id="environmental-chart-desc"');
    expect(s).toContain('aria-label="Chart metric"');
    expect(s).toContain('aria-label="Hatch history"');
    expect(s).toContain('aria-label="Filter hatch history"');
  });

  it("Alerts feed is a labelled section with heading groups", () => {
    const s = src("src/app/components/screens/AlertsScreen.tsx");
    expect(s).toContain('aria-label="Notifications"');
    expect(s).toContain("sr-only");
    expect(s).not.toContain('role="status"');
  });

  it("monitor cards expose labelled sections", () => {
    const s = src("src/app/components/detail/LiveMonitorTab.tsx");
    expect(s).toContain('titleId="incubation-timeline-title"');
    expect(s).toContain('titleId="chamber-status-title"');
  });
});

describe("one open-record pattern, no container buttons", () => {
  it("IncubatorCard uses named actions, not a button container", () => {
    const s = src("src/app/components/IncubatorCard.tsx");
    expect(s).not.toContain('role="button"');
    expect(s).not.toContain("stopPropagation");
    expect(s).not.toContain("click to view");
    expect(s).toContain("aria-label={`Finish cycle for");
  });

  it("Incubators list rows are plain rows with a named open control", () => {
    const s = src("src/app/components/screens/IncubatorsScreen.tsx");
    expect(s).not.toContain('role="button"');
    expect(s).toMatch(/aria-label=\{`Configure /);
    expect(s).not.toContain("click to open details");
    expect(s).toContain('<section aria-label="Chamber list">');
  });

  it("Overview cards and rows use explicit named open controls", () => {
    const s = src("src/app/components/screens/OverviewScreen.tsx");
    expect(s).not.toContain("click to view");
    expect(s).toContain("aria-label={`Open details for");
    expect(s).toContain("id={`mini-card-");
  });

  it("mode actions name their record", () => {
    const s = src("src/app/components/settings/ModeLibraryPanel.tsx");
    expect(s).toContain("aria-label={`Duplicate");
    expect(s).toContain("aria-label={`Delete");
    expect(s).toContain("aria-label={`Share or export");
    expect(s).not.toContain('aria-label="Edit mode"');
    expect(s).not.toContain('aria-label="Duplicate mode"');
    expect(s).toContain("id={`mode-card-");
  });

  it("journal cards carry no container-click crutch", () => {
    const s = src("src/app/components/screens/CandlingLogsScreen.tsx");
    expect(s).not.toContain("stopPropagation");
  });

  it("shell landmarks match across breakpoints", () => {
    const header = src("src/app/components/PageHeader.tsx");
    expect(header.match(/<header[\s>]/g)?.length).toBe(2);
    const sidebar = src("src/app/components/AppSidebar.tsx");
    expect(sidebar).not.toContain("<aside");
    expect(sidebar.match(/aria-label="Primary navigation"/g)?.length).toBe(3);
  });
});
