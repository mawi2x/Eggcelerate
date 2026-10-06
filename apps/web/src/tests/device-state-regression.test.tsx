import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { Timeline } from "../app/components/detail/Timeline";
import { IncubatorCard } from "../app/components/IncubatorCard";
import { HardwarePanel } from "../app/components/settings/HardwarePanel";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { modeFixtures } from "../app/data/fixtures/modes";
import type { Incubator } from "../app/domain/types";
import { render } from "./render";

const base = createIncubatorFixtures(modeFixtures)[0];
const mode = modeFixtures[0];

describe("device controls after the React upgrade", () => {
  it.each([
    ["ready", "Ready"],
    ["incubating", "Incubating"],
    ["lockdown", "Lockdown"],
    ["hatching", "Hatching"],
    ["awaiting_finish", "Awaiting Finish"],
    ["completed", "Completed"],
    ["stopped_early", "Stopped Early"],
  ] as const)("keeps the %s card actionable", async (cyclePhase, label) => {
    const unit: Incubator = {
      ...base,
      cyclePhase,
      paired: true,
      connectionState: "connected",
      conditionSeverity: cyclePhase === "ready" ? "info" : "warning",
      dayOfIncubation:
        cyclePhase === "ready"
          ? 0
          : cyclePhase === "incubating"
            ? 5
            : mode.incubationDays,
      tempTrend: 0,
      humidityTrend: -0.5,
      waterOk: false,
    };
    const onOpen = vi.fn();
    const onHarvest = vi.fn();
    const mounted = await render(
      <IncubatorCard
        unit={unit}
        mode={mode}
        onOpen={onOpen}
        onHarvest={onHarvest}
        highlighted
      />,
    );
    try {
      expect(mounted.container.textContent).toContain(label);
      await act(async () =>
        mounted.container
          .querySelector<HTMLButtonElement>(
            `button[aria-label="Open details for ${unit.name}"]`,
          )
          ?.click(),
      );
      expect(onOpen).toHaveBeenCalledWith(unit.id);
      const finish = mounted.container.querySelector<HTMLButtonElement>(
        `button[aria-label="Finish cycle for ${unit.name}"]`,
      );
      const action =
        finish ??
        mounted.container.querySelector<HTMLButtonElement>(
          `button[aria-label="${cyclePhase === "ready" ? "Start setup for" : "Configure"} ${unit.name}"]`,
        );
      expect(action).not.toBeNull();
      await act(async () => action?.click());
      if (finish) expect(onHarvest).toHaveBeenCalledWith(unit);
      else expect(onOpen).toHaveBeenCalledTimes(2);
    } finally {
      await mounted.unmount();
    }
  });

  it.each(["connecting", "connection_failed", "offline"] as const)(
    "identifies %s devices without blocking details",
    async (connectionState) => {
      const unit = {
        ...base,
        paired: false,
        connectionState,
        conditionSeverity: "critical" as const,
        tempTrend: 0.5,
      };
      const open = vi.fn();
      const mounted = await render(
        <IncubatorCard unit={unit} mode={mode} onOpen={open} />,
      );
      try {
        expect(mounted.container.textContent).toContain(
          connectionState === "connecting"
            ? "Connecting"
            : connectionState === "connection_failed"
              ? "Connection Failed"
              : "Offline",
        );
        await act(async () =>
          mounted.container
            .querySelector<HTMLButtonElement>(
              `button[aria-label="Open details for ${unit.name}"]`,
            )
            ?.click(),
        );
        expect(open).toHaveBeenCalledWith(unit.id);
      } finally {
        await mounted.unmount();
      }
    },
  );

  it("reports online, connecting, offline, mains and battery devices and changes tabs", async () => {
    const units: Incubator[] = [
      {
        ...base,
        id: "online",
        name: "Online chamber",
        paired: true,
        connectionState: "connected",
        powerSource: "grid",
      },
      {
        ...base,
        id: "connecting",
        name: "Connecting chamber",
        paired: true,
        connectionState: "connecting",
        powerSource: "battery",
        batteryPct: 42,
      },
      {
        ...base,
        id: "offline",
        name: "Offline chamber",
        paired: false,
        connectionState: "offline",
      },
    ];
    const change = vi.fn();
    const onOpenUnit = vi.fn();
    const mounted = await render(
      <HardwarePanel
        units={units}
        view="devices"
        onViewChange={change}
        onOpenUnit={onOpenUnit}
      />,
    );
    try {
      expect(mounted.container.textContent).toContain("1 of 3 online");
      for (const text of ["Online", "Connecting", "Offline", "Mains", "42%"])
        expect(mounted.container.textContent).toContain(text);
      await act(async () =>
        mounted.container
          .querySelector<HTMLButtonElement>("#hardware-preferences-tab")
          ?.click(),
      );
      expect(change).toHaveBeenCalledWith("preferences");
      await act(async () =>
        mounted.container
          .querySelector<HTMLButtonElement>("#hardware-devices-tab")
          ?.click(),
      );
      expect(change).toHaveBeenLastCalledWith("devices");
      await mounted.rerender(
        <HardwarePanel
          units={[]}
          view="devices"
          onViewChange={change}
          onOpenUnit={onOpenUnit}
        />,
      );
      expect(mounted.container.textContent).toContain("No devices paired yet");
      expect(mounted.container.textContent).not.toContain("1 of 3 online");
    } finally {
      await mounted.unmount();
    }
  });

  it.each([
    [0, "Ready"],
    [18, "Lockdown"],
    [21, "Hatch Day!"],
    [25, "4 days past hatch"],
  ] as const)(
    "labels day %i and keeps journal checkpoints usable",
    async (currentDay, label) => {
      const select = vi.fn();
      const mounted = await render(
        <Timeline
          currentDay={currentDay}
          totalDays={21}
          candling={[
            { day: 7, label: "First candling" },
            { day: 14, label: "Second candling" },
            { day: 18, label: "Lockdown" },
          ]}
          candled={{ 7: true }}
          onSelectMilestone={select}
        />,
      );
      try {
        expect(mounted.container.textContent).toContain(label);
        await act(async () =>
          mounted.container
            .querySelector<HTMLButtonElement>(
              'button[aria-label="First candling, Day 7"]',
            )
            ?.click(),
        );
        expect(select).toHaveBeenCalledWith(7);
      } finally {
        await mounted.unmount();
      }
    },
  );
});
