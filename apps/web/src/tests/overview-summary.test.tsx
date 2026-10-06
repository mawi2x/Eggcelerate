import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { OverviewScreen } from "../app/components/screens/OverviewScreen";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { createModeFixtures } from "../app/data/fixtures/modes";
import type { AlertEntry } from "../app/domain/types";
import { render } from "./render";

const modes = createModeFixtures();
const base = createIncubatorFixtures(modes)[0];
describe("overview daily summary", () => {
  it("uses actual chamber and unread notification counts and opens the due hatch first", async () => {
    const units = [
      {
        ...base,
        name: "Urgent chamber",
        status: "alert" as const,
        totalEggsLoaded: 12,
      },
      {
        ...base,
        id: "due",
        name: "Due chamber",
        dayOfIncubation: modes[0].incubationDays,
        modeId: modes[0].id,
        totalEggsLoaded: 20,
      },
      {
        ...base,
        id: "idle",
        name: "Idle chamber",
        cyclePhase: "ready" as const,
        status: "optimal" as const,
        totalEggsLoaded: 0,
      },
    ];
    const alerts: AlertEntry[] = ["critical", "warning", "critical"].map(
      (severity, index) => ({
        id: `alert-${index}`,
        severity: severity as AlertEntry["severity"],
        title: "Alert",
        unit: base.name,
        message: "Check chamber",
        timestamp: "2026-10-04T00:00:00Z",
        acknowledged: index === 2,
      }),
    );
    const open = vi.fn();
    const mounted = await render(
      <OverviewScreen
        units={units}
        modes={modes}
        alerts={alerts}
        onOpenUnit={open}
        onManageAll={vi.fn()}
      />,
    );
    try {
      const summary = mounted.container.querySelector(
        'section[aria-labelledby="overview-today-title"]',
      );
      const stats = [...(summary?.querySelectorAll("dl > div") ?? [])].map(
        (node) => node.textContent,
      );
      expect(stats).toEqual([
        "INCUBATORS32 running and 1 idle",
        "EGGS32Across 3 chambers",
        "NEXT HATCHNowDue chamber",
        "ALERTS21 critical",
      ]);
      expect(summary?.textContent).toContain("1 hatch is due");
      await act(async () =>
        summary?.querySelector<HTMLButtonElement>("button")?.click(),
      );
      expect(open).toHaveBeenCalledWith("due");
    } finally {
      await mounted.unmount();
    }
  });
  it("shows no upcoming hatch for idle or empty farms and keeps Start checks useful", async () => {
    const manage = vi.fn();
    const idle = {
      ...base,
      cyclePhase: "ready" as const,
      status: "optimal" as const,
    };
    const mounted = await render(
      <OverviewScreen
        units={[idle]}
        modes={modes}
        onOpenUnit={vi.fn()}
        onManageAll={manage}
      />,
    );
    try {
      expect(mounted.container.textContent).toContain("No active cycles");
      await act(async () =>
        mounted.container
          .querySelector<HTMLButtonElement>(
            'section[aria-labelledby="overview-today-title"] button',
          )
          ?.click(),
      );
      expect(manage).toHaveBeenCalledOnce();
      await mounted.rerender(
        <OverviewScreen
          units={[]}
          modes={modes}
          onOpenUnit={vi.fn()}
          onManageAll={manage}
        />,
      );
      expect(mounted.container.textContent).toContain("0 running and 0 idle");
      expect(mounted.container.textContent).toContain("0 hatches are due");
      expect(mounted.container.textContent).toContain("Across 0 chambers");
    } finally {
      await mounted.unmount();
    }
  });
});
