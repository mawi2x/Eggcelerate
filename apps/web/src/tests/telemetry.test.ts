import { describe, expect, it } from "vitest";
import {
  resolvedTelemetryStatus,
  telemetryAgeLabel,
  telemetryReceiptTimestamp,
  telemetryStatusLabel,
} from "../app/features/farm/telemetry";

describe("telemetry freshness presentation", () => {
  const now = Date.parse("2026-09-23T00:00:00Z");

  it("uses server receipt age and preserves stale/offline labels", () => {
    expect(telemetryStatusLabel("fresh", "2026-09-22T23:59:45Z", now)).toBe(
      "Live. Last reading: 15s ago.",
    );
    expect(telemetryStatusLabel("stale", "2026-09-22T23:57:00Z", now)).toBe(
      "Stale. Last reading: 3m ago.",
    );
    expect(telemetryStatusLabel("offline", null, now)).toBe(
      "Offline. Last reading: no recent data.",
    );
  });

  it("does not treat pairing alone as proof of live telemetry", () => {
    expect(resolvedTelemetryStatus({ paired: true })).toBe("offline");
    expect(
      resolvedTelemetryStatus({ paired: true, telemetryStatus: "fresh" }),
    ).toBe("offline");
    expect(resolvedTelemetryStatus({ paired: false })).toBe("offline");
    expect(telemetryAgeLabel("invalid", now)).toBe("unknown age");
  });

  it("requires a recent server receipt before reporting Live", () => {
    expect(
      resolvedTelemetryStatus(
        {
          paired: true,
          telemetryStatus: "fresh",
          telemetryReceivedAt: "2026-09-22T23:59:50Z",
        },
        now,
      ),
    ).toBe("fresh");
    expect(
      resolvedTelemetryStatus(
        {
          paired: true,
          telemetryStatus: "fresh",
          telemetryReceivedAt: "2026-09-22T23:58:50Z",
        },
        now,
      ),
    ).toBe("stale");
    expect(
      resolvedTelemetryStatus(
        {
          paired: true,
          telemetryStatus: "fresh",
          telemetryReceivedAt: "2026-09-22T23:56:00Z",
        },
        now,
      ),
    ).toBe("offline");
  });

  it("prefers receipt time for the displayed server-freshness age", () => {
    const receivedAt = telemetryReceiptTimestamp({
      telemetryReceivedAt: "2026-09-22T23:59:50Z",
      telemetryLastSeenAt: "2026-09-22T23:50:00Z",
    });
    expect(telemetryStatusLabel("fresh", receivedAt, now)).toBe(
      "Live. Last reading: 10s ago.",
    );
  });
});
