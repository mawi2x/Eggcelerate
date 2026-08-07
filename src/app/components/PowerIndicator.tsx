import { BatteryCharging, Battery, AlertTriangle } from "lucide-react";
import { PowerSource } from "../data/mockData";

/**
 * Compact power pill: charging, normal battery, or critical.
 * Incubator cards use `SegmentedBattery` in the header instead; this stays for
 * surfaces that need the level as a labelled pill.
 */
export function PowerIndicator({ source, battery }: { source: PowerSource; battery: number }) {
  const charging = source !== "battery";
  const critical = !charging && battery < 25;

  const Icon = charging ? BatteryCharging : critical ? AlertTriangle : Battery;
  const color = charging ? "#16A34A" : critical ? "#DC2626" : "#3D3228";
  const bg = charging ? "#DCFCE7" : critical ? "#FEE2E2" : "#F2EEE5";
  const state = charging ? "Charging" : critical ? "Battery critical" : "Battery";

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1"
      style={{ height: 24, backgroundColor: bg, color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}
      title={`${state} — ${battery}%`}
    >
      <Icon size={13} strokeWidth={2.6} aria-hidden />
      <span className="sr-only">{state}: </span>
      {battery}%
    </span>
  );
}
