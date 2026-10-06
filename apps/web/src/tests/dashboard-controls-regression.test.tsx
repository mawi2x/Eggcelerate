import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "../app/components/AppSidebar";
import { IncubatorsScreen } from "../app/components/screens/IncubatorsScreen";
import { OverviewScreen } from "../app/components/screens/OverviewScreen";
import { initialAccount } from "../app/data/account";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { createModeFixtures } from "../app/data/fixtures/modes";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import {
  AppProviders,
  createAppQueryClient,
} from "../app/providers/AppProviders";
import { render, waitFor } from "./render";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
afterEach(() => vi.restoreAllMocks());
const modeFixtures = createModeFixtures();
const base = createIncubatorFixtures(modeFixtures)[0];
function button(container: ParentNode, label: string) {
  const found = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (item) =>
      item.textContent?.includes(label) ||
      item.getAttribute("aria-label") === label,
  );
  if (!found) throw new Error(`Missing button ${label}`);
  return found;
}
async function fill(container: ParentNode, selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`Missing input ${selector}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("dashboard control regression", () => {
  it("keeps condition tabs synchronized with a swiped carousel", async () => {
    const mounted = await render(
      <OverviewScreen
        units={[base]}
        modes={modeFixtures}
        onOpenUnit={vi.fn()}
        onManageAll={vi.fn()}
      />,
    );
    try {
      const carousel = mounted.container.querySelector(
        "#condition-temp-panel",
      )?.parentElement;
      if (!carousel) throw new Error("Missing condition carousel");
      Object.defineProperty(carousel, "clientWidth", { value: 393 });
      await act(async () => {
        carousel.scrollLeft = 393;
        carousel.dispatchEvent(new Event("scroll"));
      });
      expect(
        button(mounted.container, "Humidity").getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        button(mounted.container, "Show humidity conditions").getAttribute(
          "aria-current",
        ),
      ).toBe("true");
      expect(
        button(mounted.container, "Show temperature conditions").getAttribute(
          "aria-current",
        ),
      ).toBeNull();

      await act(async () => {
        carousel.scrollLeft = 0;
        carousel.dispatchEvent(new Event("scroll"));
      });
      expect(
        button(mounted.container, "Temperature").getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        button(mounted.container, "Show temperature conditions").getAttribute(
          "aria-current",
        ),
      ).toBe("true");

      await act(async () => {
        button(mounted.container, "Show humidity conditions").click();
      });
      expect(
        button(mounted.container, "Humidity").getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        button(mounted.container, "Show humidity conditions").getAttribute(
          "aria-current",
        ),
      ).toBe("true");
    } finally {
      await mounted.unmount();
    }
  });
  it("shows idle chambers with safe conditions and their setup shortcuts", async () => {
    const open = vi.fn();
    const units = [1, 2].map((index) => ({
      ...base,
      id: `ready-${index}`,
      name: `Ready ${index}`,
      cyclePhase: "ready" as const,
      status: "optimal" as const,
      dayOfIncubation: 0,
      temp: 37.6,
      humidity: 57,
      paired: true,
    }));
    const mounted = await render(
      <OverviewScreen
        units={units}
        modes={modeFixtures}
        onOpenUnit={open}
        onManageAll={vi.fn()}
      />,
    );
    try {
      expect(mounted.container.textContent).toContain("2 idle");
      expect(mounted.container.textContent).toContain(
        "All temperatures within target",
      );
      expect(mounted.container.textContent).toContain(
        "All humidity levels within target",
      );
      expect(mounted.container.textContent).toContain(
        "0 chambers need attention",
      );
      await act(async () => button(mounted.container, "Ready 1").click());
      expect(open).toHaveBeenCalledWith("ready-1");
    } finally {
      await mounted.unmount();
    }
  });
  it("supports desktop collapse, hover/focus feedback and sign-out", async () => {
    const toggle = vi.fn();
    const help = vi.fn();
    const signOut = vi.fn();
    const props = {
      active: "overview" as const,
      onNavigate: vi.fn(),
      alertCount: 0,
      account: initialAccount,
      collapsed: false,
      onToggleCollapsed: toggle,
      onSignOut: signOut,
      onHelp: help,
    };
    const mounted = await render(<AppSidebar {...props} />);
    try {
      const control = mounted.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Collapse sidebar"]',
      );
      if (!control) throw new Error("Missing sidebar collapse");
      await act(async () => {
        control.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        control.focus();
      });
      await act(async () => {
        control.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
        control.blur();
        button(mounted.container, "Collapse sidebar").click();
      });
      expect(toggle).toHaveBeenCalled();
      await act(async () => button(mounted.container, "Sign out").click());
      expect(signOut).toHaveBeenCalled();
      await mounted.rerender(
        <AppSidebar {...props} collapsed alertCount={3} />,
      );
      expect(
        mounted.container.querySelector('button[aria-label="Expand sidebar"]'),
      ).not.toBeNull();
      await act(async () =>
        button(mounted.container, "Expand sidebar").dispatchEvent(
          new MouseEvent("mouseover", { bubbles: true }),
        ),
      );
      await act(async () =>
        button(mounted.container, "Expand sidebar").dispatchEvent(
          new MouseEvent("mouseout", { bubbles: true }),
        ),
      );
    } finally {
      await mounted.unmount();
    }
  });

  it.each([
    [0, "Now"],
    [20, "~24 Hours"],
    [21, "Now"],
    [18, "3 Days"],
  ] as const)(
    "shows the next hatch and condition shortcuts at day %i",
    async (day, expected) => {
      const units = [
        {
          ...base,
          id: "high",
          name: "High chamber",
          dayOfIncubation: day,
          temp: 40,
          humidity: 80,
          paired: true,
          status: "alert" as const,
          cyclePhase: "incubating" as const,
        },
        {
          ...base,
          id: "low",
          name: "Low chamber",
          dayOfIncubation: day,
          temp: 30,
          humidity: 30,
          paired: false,
          totalEggsLoaded: undefined,
          modeId: "missing",
          status: "warning" as const,
          cyclePhase: "ready" as const,
        },
      ];
      const open = vi.fn();
      const manage = vi.fn();
      const mounted = await render(
        <OverviewScreen
          units={units}
          modes={modeFixtures}
          onOpenUnit={open}
          onManageAll={manage}
        />,
      );
      try {
        expect(mounted.container.textContent).toContain(
          day === 0 ? "21 Days" : expected,
        );
        expect(mounted.container.textContent).toContain("High chamber");
        await act(async () => button(mounted.container, "Humidity").click());
        expect(mounted.container.textContent).toContain("Low chamber");
        const chamberControl = [
          ...mounted.container.querySelectorAll<HTMLButtonElement>("button"),
        ].find((item) => item.textContent?.includes("High chamber"));
        await act(async () => chamberControl?.click());
        expect(open).toHaveBeenCalledWith("high");
        await act(async () => button(mounted.container, "View all").click());
        expect(manage).toHaveBeenCalled();
        await mounted.rerender(
          <OverviewScreen
            units={[]}
            modes={modeFixtures}
            onOpenUnit={open}
            onManageAll={manage}
          />,
        );
        expect(mounted.container.textContent).toContain("0 running and 0 idle");
      } finally {
        await mounted.unmount();
      }
    },
  );

  it("validates pairing fields, keeps failed writes open and closes only after confirmation", async () => {
    const add = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const client = createAppQueryClient();
    const mounted = await render(
      <AppProviders
        repository={new InMemoryEggcelerateRepository()}
        queryClient={client}
      >
        <IncubatorsScreen
          units={[base]}
          modes={modeFixtures}
          onOpenUnit={vi.fn()}
          onAddIncubator={add}
          isAddingIncubator={false}
        />
      </AppProviders>,
    );
    try {
      await act(async () => button(mounted.container, "Add incubator").click());
      await waitFor(() => Boolean(document.querySelector("#deviceId")));
      await act(async () => button(document, "Connect Incubator").click());
      expect(add).not.toHaveBeenCalled();
      await fill(document, "#name", "New chamber");
      await fill(document, "#deviceId", "X");
      await act(async () => button(document, "Connect Incubator").click());
      expect(add).not.toHaveBeenCalled();
      await fill(document, "#deviceId", base.deviceId);
      await act(async () => button(document, "Connect Incubator").click());
      expect(add).not.toHaveBeenCalled();
      await fill(document, "#deviceId", "UNKNOWN");
      await act(async () => button(document, "Connect Incubator").click());
      expect(document.body.textContent).toContain(
        "Could not find an incubator",
      );
      await fill(document, "#deviceId", "egg-9999");
      await act(async () => button(document, "Connect Incubator").click());
      expect(add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New chamber",
          deviceId: "EGG-9999",
          telemetryStatus: "offline",
        }),
      );
      expect(document.querySelector("#deviceId")).not.toBeNull();
      await act(async () => button(document, "Connect Incubator").click());
      await waitFor(() => document.querySelector("#deviceId") === null);
      expect(add).toHaveBeenCalledTimes(2);
    } finally {
      await mounted.unmount();
      client.clear();
    }
  });
});
