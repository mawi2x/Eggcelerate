import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { ActiveIncubatorCard } from "../app/components/ActiveIncubatorCard";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { createModeFixtures } from "../app/data/fixtures/modes";
import { render } from "./render";

const mode = createModeFixtures()[0];
const base = createIncubatorFixtures([mode])[0];

describe("active incubator card states", () => {
  it("replaces offline percentages, preserves day counts, and preserves navigation", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const unit = {
      ...base,
      dayOfIncubation: mode.incubationDays + 1,
      telemetryStatus: "offline" as const,
      telemetryReceivedAt: new Date(now - 42 * 60_000).toISOString(),
    };
    const open = vi.fn();
    const mounted = await render(
      <ActiveIncubatorCard unit={unit} mode={mode} onOpen={open} />,
    );
    try {
      expect(mounted.container.textContent).toContain(
        `Day ${mode.incubationDays + 1} of ${mode.incubationDays}`,
      );
      expect(mounted.container.textContent).not.toContain("Overdue");
      expect(mounted.container.textContent).toContain("Last seen 42 min ago");
      expect(mounted.container.textContent).not.toContain("100%");
      expect(
        mounted.container.querySelector(`#mini-card-status-${unit.id}`),
      ).toBeNull();
      expect(
        mounted.container
          .querySelector('svg[role="img"]')
          ?.getAttribute("aria-label"),
      ).toBe("Offline: cycle progress unavailable");
      expect(
        mounted.container.querySelector(`[title="${mode.name}"]`),
      ).not.toBeNull();
      await act(async () => mounted.container.querySelector("button")?.click());
      expect(open).toHaveBeenCalledWith(unit.id);
      await mounted.rerender(
        <ActiveIncubatorCard
          unit={{
            ...unit,
            telemetryReceivedAt: new Date(now).toISOString(),
            telemetryStatus: "fresh",
          }}
          mode={mode}
          onOpen={open}
        />,
      );
      expect(mounted.container.textContent).toContain("100%");
      expect(mounted.container.textContent).not.toContain("Last seen");
      expect(
        mounted.container
          .querySelector(`#mini-card-seen-${unit.id}`)
          ?.getAttribute("style"),
      ).toContain("visibility: hidden");
    } finally {
      await mounted.unmount();
      clock.mockRestore();
    }
  });
  it("does not invent a last-seen age for missing or invalid telemetry", async () => {
    const unit = {
      ...base,
      telemetryStatus: "offline" as const,
      telemetryReceivedAt: null,
      telemetryLastSeenAt: null,
      dayOfIncubation: 2,
    };
    const mounted = await render(
      <ActiveIncubatorCard unit={unit} mode={mode} onOpen={vi.fn()} />,
    );
    try {
      expect(mounted.container.textContent).toContain("Offline");
      expect(mounted.container.textContent).not.toContain("Last seen");
      expect(mounted.container.textContent).toContain(
        `Day 2 of ${mode.incubationDays}`,
      );
      await mounted.rerender(
        <ActiveIncubatorCard
          unit={{ ...unit, telemetryReceivedAt: "invalid" }}
          mode={mode}
          onOpen={vi.fn()}
        />,
      );
      expect(mounted.container.textContent).toContain("Offline");
      expect(mounted.container.textContent).not.toContain("Last seen");
    } finally {
      await mounted.unmount();
    }
  });
});
