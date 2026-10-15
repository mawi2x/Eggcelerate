import { describe, expect, it } from "vitest";
import { LiveMonitorTab } from "../app/components/detail/LiveMonitorTab";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { createModeFixtures } from "../app/data/fixtures/modes";
import { computeCandling } from "../app/domain/candling";
import type { Incubator } from "../app/domain/types";
import { render } from "./render";

const modes = createModeFixtures();
const mode = modes[0];

async function mountMonitor(overrides: Partial<Incubator> = {}) {
  const unit = {
    ...createIncubatorFixtures(modes, Date.now(), "demo")[0],
    ...overrides,
  };
  return render(
    <LiveMonitorTab
      unit={unit}
      mode={mode}
      currentDay={unit.dayOfIncubation}
      totalDays={mode.incubationDays}
      candling={computeCandling(mode.incubationDays)}
      effectiveCandled={unit.candled}
      environmentalReadings={[]}
      readingsLoading={false}
      readingsError={null}
      onRetryReadings={() => {}}
      onOpenTrends={() => {}}
      onSelectCandlingDay={() => {}}
    />,
  );
}

function tileValue(container: HTMLElement, label: string) {
  const labelNode = [...container.querySelectorAll("p")].find(
    (node) => node.textContent === label,
  );
  return labelNode?.parentElement?.querySelectorAll("p")[1]?.textContent;
}

describe("live monitor output states", () => {
  it("shows explicit On/Off reports and removes battery and power tiles", async () => {
    const mounted = await mountMonitor({
      batteryPct: 23,
      powerSource: "battery",
      outputStates: {
        heaterOn: true,
        mistOn: false,
        fanOn: true,
        receivedAt: new Date().toISOString(),
      },
    });
    try {
      expect(tileValue(mounted.container, "Heating element")).toBe("On");
      expect(tileValue(mounted.container, "Mist maker")).toBe("Off");
      expect(tileValue(mounted.container, "Circulation fan")).toBe("On");
      expect(tileValue(mounted.container, "Telemetry")).toBe("Live");
      expect(tileValue(mounted.container, "Power")).toBeUndefined();
      expect(tileValue(mounted.container, "Battery")).toBeUndefined();
      expect(mounted.container.textContent).not.toContain("23%");
      expect(mounted.container.textContent).not.toContain("Not reported");
    } finally {
      await mounted.unmount();
    }
  });

  it.each(["stale", "offline"] as const)(
    "does not show saved On/Off reports when telemetry is %s",
    async (telemetryStatus) => {
      const mounted = await mountMonitor({ telemetryStatus });
      try {
        for (const label of [
          "Heating element",
          "Mist maker",
          "Circulation fan",
        ]) {
          expect(tileValue(mounted.container, label)).toBeUndefined();
        }
        expect(tileValue(mounted.container, "Telemetry")).toBe(
          telemetryStatus === "stale" ? "Stale" : "Offline",
        );
        expect(mounted.container.textContent).toContain(
          "Waiting for output status.",
        );
      } finally {
        await mounted.unmount();
      }
    },
  );

  it("does not invent Off when a live device has supplied no output report", async () => {
    const mounted = await mountMonitor({ outputStates: undefined });
    try {
      expect(tileValue(mounted.container, "Heating element")).toBeUndefined();
      expect(tileValue(mounted.container, "Telemetry")).toBe("Live");
      expect(mounted.container.textContent).toContain(
        "Waiting for output status.",
      );
    } finally {
      await mounted.unmount();
    }
  });

  it("expires old output reports independently of fresh sensor readings", async () => {
    const mounted = await mountMonitor({
      outputStates: {
        heaterOn: true,
        mistOn: true,
        fanOn: true,
        receivedAt: new Date(Date.now() - 60_000).toISOString(),
      },
    });
    try {
      expect(tileValue(mounted.container, "Heating element")).toBeUndefined();
      expect(tileValue(mounted.container, "Telemetry")).toBe("Live");
    } finally {
      await mounted.unmount();
    }
  });
});
