import type { Incubator, TelemetryStatus } from "../../domain/types";

/** Devices publish on a 15-second cadence; polling is deliberately bounded. */
export const TELEMETRY_POLL_INTERVAL_MS = 15_000;
export const TELEMETRY_REFRESH_ENABLED =
  import.meta.env.VITE_LIVE_REFRESH_ENABLED !== "false";

export function resolvedTelemetryStatus(
  unit: Pick<Incubator, "paired" | "telemetryStatus" | "telemetryLastSeenAt">,
  now = Date.now(),
): TelemetryStatus {
  if (unit.telemetryStatus !== undefined && unit.telemetryLastSeenAt) {
    const age = now - Date.parse(unit.telemetryLastSeenAt);
    if (age > 180_000) return "offline";
    if (age > 45_000 && unit.telemetryStatus === "fresh") return "stale";
  }
  return unit.telemetryStatus ?? "offline";
}

export function telemetryAgeLabel(
  lastSeenAt: string | null | undefined,
  now = Date.now(),
): string {
  if (!lastSeenAt) return "no recent data";
  const timestamp = Date.parse(lastSeenAt);
  if (!Number.isFinite(timestamp)) return "unknown age";
  const ageSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (ageSeconds < 10) return "just now";
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  const ageMinutes = Math.floor(ageSeconds / 60);
  if (ageMinutes < 60) return `${ageMinutes}m ago`;
  const ageHours = Math.floor(ageMinutes / 60);
  return `${ageHours}h ago`;
}

export function telemetryStatusLabel(
  status: TelemetryStatus,
  lastSeenAt: string | null | undefined,
  now = Date.now(),
): string {
  const label =
    status === "fresh" ? "Live" : status === "stale" ? "Stale" : "Offline";
  return `${label} · ${telemetryAgeLabel(lastSeenAt, now)}`;
}
