import { act, useState } from "react";
import { describe, expect, it } from "vitest";
import { AppSidebar } from "../app/components/AppSidebar";
import { DeviceSettingsTab } from "../app/components/detail/DeviceSettingsTab";
import { HelpWidget } from "../app/components/HelpWidget";
import { initialAccount } from "../app/data/account";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { createModeFixtures } from "../app/data/fixtures/modes";
import type { ConnectionState } from "../app/domain/cycle";
import { render, waitFor } from "./render";

describe("connection presentation", () => {
  it.each([
    [true, "offline", "Connection Lost", "var(--status-danger-fg)"],
    [true, "connection_failed", "Connection Lost", "var(--status-danger-fg)"],
    [true, "connecting", "Connecting", "var(--status-warning-fg)"],
    [true, "connected", "Connected and Paired", "var(--status-success-fg)"],
    [false, "connected", "Not paired", "var(--text-muted)"],
    [false, "connecting", "Connecting", "var(--status-warning-fg)"],
  ] as const)(
    "renders pairing %s and state %s consistently",
    async (paired, connectionState: ConnectionState, label, color) => {
      const modes = createModeFixtures();
      const unit = createIncubatorFixtures(modes)[0];
      const mounted = await render(
        <DeviceSettingsTab
          unit={{ ...unit, paired, connectionState }}
          modes={modes}
          candling={[]}
          isReady={false}
          cycleEnded={false}
          turningStopped={false}
          isUpdating={false}
          isRequestingTurn={false}
          onUpdate={async () => true}
          onStopCycle={async () => true}
          onTurnClick={async () => true}
        />,
      );
      try {
        const device = Array.from(
          mounted.container.querySelectorAll("button"),
        ).find((b) => b.textContent?.includes("Device & connection"));
        await act(async () => device?.click());
        const status = Array.from(mounted.container.querySelectorAll("p")).find(
          (p) => p.textContent?.includes(label),
        );
        expect(status).toBeDefined();
        expect(status?.style.color).toBe(color);
        expect(status?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
          "true",
        );
        expect(status?.querySelector("svg")?.innerHTML).not.toBe("");
        const reconnect = status?.querySelector("button");
        expect(Boolean(reconnect)).toBe(
          !paired || connectionState !== "connected",
        );
      } finally {
        await mounted.unmount();
      }
    },
  );
});

describe("mobile help", () => {
  it("opens from More using keyboard and returns focus after Escape", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 393,
    });
    function Shell() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <AppSidebar
            active="overview"
            onNavigate={() => {}}
            alertCount={0}
            account={initialAccount}
            collapsed={false}
            onToggleCollapsed={() => {}}
            onSignOut={() => {}}
            onHelp={() => setOpen(true)}
          />
          <HelpWidget open={open} onOpenChange={setOpen} />
        </>
      );
    }
    const mounted = await render(<Shell />);
    try {
      const more = document.getElementById(
        "mobile-more-trigger",
      ) as HTMLButtonElement;
      more.focus();
      await act(async () => more.click());
      const menu = document.getElementById("mobile-more-menu");
      expect(document.activeElement?.textContent).toBe("Alerts");
      await act(async () =>
        menu?.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      expect(document.activeElement?.textContent).toBe("Settings");
      await act(async () =>
        menu?.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      expect(document.activeElement?.textContent).toBe("Help");
      await act(async () =>
        (document.activeElement as HTMLButtonElement).click(),
      );
      await waitFor(() => document.querySelector('[role="dialog"]') !== null);
      expect(document.getElementById("mobile-more-menu")).toBeNull();
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog?.contains(document.activeElement)).toBe(true);
      const question = dialog?.querySelector<HTMLButtonElement>(
        'button[aria-controls="help-answer-1"]',
      );
      await act(async () => question?.click());
      expect(question?.getAttribute("aria-expanded")).toBe("true");
      expect(document.getElementById("help-answer-1")?.hidden).toBe(false);
      await act(async () =>
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      await waitFor(() => document.querySelector('[role="dialog"]') === null);
      await waitFor(() => document.activeElement === more);
      expect(document.activeElement).toBe(more);
    } finally {
      await mounted.unmount();
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalWidth,
      });
    }
  });
});
