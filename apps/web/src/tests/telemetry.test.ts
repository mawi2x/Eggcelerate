import { describe, expect, it } from "vitest";
import {
  resolvedTelemetryStatus,
  telemetryAgeLabel,
  telemetryStatusLabel,
} from "../app/features/farm/telemetry";

describe("telemetry freshness presentation", () => {
  const now = Date.parse("2026-09-23T00:00:00Z");

  it("uses server receipt age and preserves stale/offline labels", () => {
    expect(telemetryStatusLabel("fresh", "2026-09-22T23:59:45Z", now)).toBe(
      "Live · 15s ago",
    );
    expect(telemetryStatusLabel("stale", "2026-09-22T23:57:00Z", now)).toBe(
      "Stale · 3m ago",
    );
    expect(telemetryStatusLabel("offline", null, now)).toBe(
      "Offline · no recent data",
    );
  });

  it("does not treat pairing alone as proof of live telemetry", () => {
    expect(resolvedTelemetryStatus({ paired: true })).toBe("offline");
    expect(
      resolvedTelemetryStatus({ paired: true, telemetryStatus: "fresh" }),
    ).toBe("fresh");
    expect(resolvedTelemetryStatus({ paired: false })).toBe("offline");
    expect(telemetryAgeLabel("invalid", now)).toBe("unknown age");
  });
});
