import { describe, expect, it } from "vitest";
import { LiveMonitorTab } from "../app/components/detail/LiveMonitorTab";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { createModeFixtures } from "../app/data/fixtures/modes";
import { computeCandling } from "../app/domain/candling";
import { render } from "./render";

describe("live monitor telemetry confidence", () => {
  it.each(["stale", "offline"] as const)(
    "does not claim actuator states while telemetry is %s",
    async (telemetryStatus) => {
      const modes = createModeFixtures();
      const mode = modes[0];
      if (!mode) throw new Error("Mode fixtures are missing.");
      const unit = createIncubatorFixtures(modes)[0];
      if (!unit) throw new Error("Incubator fixtures are missing.");
      const mounted = await render(
        <LiveMonitorTab
          unit={{
            ...unit,
            telemetryStatus,
            telemetryReceivedAt:
              telemetryStatus === "stale" ? new Date().toISOString() : null,
          }}
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

      try {
        for (const label of [
          "Heating element",
          "Mist maker",
          "Circulation fan",
        ]) {
          const labelNode = [...mounted.container.querySelectorAll("p")].find(
            (node) => node.textContent === label,
          );
          const tile = labelNode?.parentElement?.parentElement;
          expect(tile?.querySelectorAll("p")[1]?.textContent).toBe(
            "Unavailable",
          );
        }
        const telemetryLabel = [
          ...mounted.container.querySelectorAll("p"),
        ].find((node) => node.textContent === "Telemetry");
        expect(telemetryLabel?.parentElement?.textContent).toContain(
          telemetryStatus === "stale" ? "Stale" : "Offline",
        );
      } finally {
        await mounted.unmount();
      }
    },
  );
});
