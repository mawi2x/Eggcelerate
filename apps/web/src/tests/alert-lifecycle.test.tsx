import { act } from "react";
import { describe, expect, it } from "vitest";
import { AlertsScreen } from "../app/components/screens/AlertsScreen";
import { alertFromDTO } from "../app/data/transport/contracts";
import type { AlertEntry } from "../app/domain/types";
import { render } from "./render";

const base: AlertEntry = {
  id: "episode-active",
  severity: "critical",
  title: "Temperature out of range",
  unit: "Chamber 1",
  message: "50°C",
  timestamp: "2026-10-03T00:00:00Z",
  acknowledged: true,
  conditionState: "active",
};

describe("alert condition lifecycle", () => {
  it("preserves backend recovery independently from acknowledgment", () => {
    const mapped = alertFromDTO({
      id: "episode-1",
      incubator_id: "chamber-1",
      unit_name: "Chamber 1",
      severity: "critical",
      code: "device-offline",
      title: "Device offline",
      message: "No telemetry",
      occurred_at: base.timestamp,
      acknowledged_at: null,
      device_id: "3fe00163-9b97-49a1-ac66-1e414b25e88c",
      condition_state: "resolved",
      resolved_at: "2026-10-03T00:05:00Z",
      resolution_reason: "recovered",
    });
    expect(mapped.conditionState).toBe("resolved");
    expect(mapped.acknowledged).toBe(false);
    expect(mapped.resolvedAt).toBe("2026-10-03T00:05:00Z");
  });

  it("keeps three categories and filters unread independently from condition status", async () => {
    const mounted = await render(
      <AlertsScreen
        alerts={[
          base,
          {
            ...base,
            id: "resolved",
            title: "Past offline",
            conditionState: "resolved",
            resolutionReason: "recovered",
            acknowledged: false,
          },
          {
            ...base,
            id: "local",
            title: "Fetch failed",
            conditionState: undefined,
          },
        ]}
        onAcknowledge={async () => true}
        onDismiss={async () => true}
        onMarkAllRead={async () => true}
        onClearRead={async () => true}
        pendingAlertId={null}
        markingAllRead={false}
        clearingRead={false}
      />,
    );
    try {
      expect(mounted.container.textContent).toContain("Resolved · recovered");
      const categories = mounted.container.querySelector(
        '[aria-label="Alert filter"]',
      );
      const filters = Array.from(categories?.querySelectorAll("button") ?? []);
      expect(filters).toHaveLength(3);
      expect(
        filters.map((button) => button.textContent?.replace(/\d+/g, "").trim()),
      ).toEqual(["All", "Unread", "Important"]);
      expect(mounted.container.textContent).toContain("Active condition");
      expect(mounted.container.textContent).toContain("Read notification");
      const unread = Array.from(
        mounted.container.querySelectorAll("button"),
      ).find((button) => button.textContent?.startsWith("Unread"));
      expect(unread).toBeDefined();
      await act(async () => unread?.click());
      expect(mounted.container.textContent).toContain("Past offline");
      expect(mounted.container.textContent).not.toContain(
        "Temperature out of range",
      );
      expect(mounted.container.textContent).not.toContain("Fetch failed");
    } finally {
      await mounted.unmount();
    }
  });
});
