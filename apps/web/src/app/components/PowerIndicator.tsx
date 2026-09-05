import {
  BatteryCharging,
  BatteryFull,
  BatteryMedium,
  BatteryWarning,
} from "@phosphor-icons/react";
import type { PowerSource } from "../domain/types";

/**
 * Compact power pill: charging, normal battery, or critical.
 */
export function PowerIndicator({
  source,
  battery,
}: {
  source: PowerSource;
  battery: number;
}) {
  const charging = source !== "battery";
  const critical = !charging && battery <= 25;

  const Icon = charging
    ? BatteryCharging
    : critical
      ? BatteryWarning
      : battery > 60
        ? BatteryFull
        : BatteryMedium;
  const color = charging
    ? "var(--status-success-fg)"
    : critical
      ? "var(--status-danger-fg)"
      : "var(--text-strong)";
  const bg = charging
    ? "var(--status-success-bg)"
    : critical
      ? "var(--status-danger-bg)"
      : "var(--surface-tile)";
  const state = charging
    ? "Charging"
    : critical
      ? "Battery critical"
      : "Battery";

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1"
      style={{
        height: "var(--control-height-pill)",
        backgroundColor: bg,
        color,
        fontSize: "var(--type-label)",
        fontWeight: "var(--weight-bold)",
        whiteSpace: "nowrap",
      }}
      title={`${state}: ${battery}%`}
    >
      <Icon size={14} weight="fill" color={color} aria-hidden />
      <span className="sr-only">{state}: </span>
      {battery}%
    </span>
  );
}
