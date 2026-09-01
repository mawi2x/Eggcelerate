import {
  BatteryCharging,
  BatteryFull,
  BatteryHigh,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
} from "@phosphor-icons/react";

const CHARGING = "var(--status-success-fg)";
const NEUTRAL = "#44403C";
const LOW = "var(--status-danger-fg)";

function getBatteryIcon(battery: number, charging: boolean) {
  if (charging) return BatteryCharging;
  if (battery <= 15) return BatteryWarning;
  if (battery <= 30) return BatteryLow;
  if (battery <= 60) return BatteryMedium;
  if (battery <= 85) return BatteryHigh;
  return BatteryFull;
}

/**
 * Clean Phosphor filled battery icon with percentage level text.
 */
export function SegmentedBattery({
  battery,
  charging = false,
  showLabel = false,
}: {
  battery: number;
  charging?: boolean;
  showLabel?: boolean;
}) {
  const low = !charging && battery <= 25;
  const color = charging ? CHARGING : low ? LOW : NEUTRAL;
  const BatteryIcon = getBatteryIcon(battery, charging);
  const description = charging
    ? `Charging ${battery}%`
    : low
      ? `Low battery ${battery}%`
      : `Battery ${battery}%`;

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5"
      title={description}
      role="img"
      aria-label={description}
    >
      <BatteryIcon size={20} weight="fill" color={color} aria-hidden="true" />
      {showLabel && (
        <span
          className="whitespace-nowrap"
          style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "var(--font-body)" }}
        >
          {battery}%
        </span>
      )}
    </span>
  );
}
