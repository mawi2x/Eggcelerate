import { Thermometer, Droplets, Waves, ChevronRight, Egg, Lock, Check, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { SegmentedBattery } from "./SegmentedBattery";
import { Incubator, Mode, ReadingState, rangeState, waterState, getWaterStatusInfo, readingStateColors } from "../data/mockData";

interface Props {
  unit: Incubator;
  mode: Mode;
  onOpen: (id: string) => void;
  cta?: string;
}

// Design tokens.
const CARD = "#F9F6F0";
const BORDER = "#E8E2D5";
const TILE = "#F2EEE5";
const MUTED = "#5A4838";
const RUST = "#AD3A1D";
const CTA = "#C85A32";

const tileBg: Record<string, string> = { ok: TILE, warning: "#FFFBEB", critical: "#FEF2F2" };
const tileBorder: Record<string, string> = { ok: BORDER, warning: "#FCD34D", critical: "#FCA5A5" };

// Farmer-friendly operational status pill, derived from pairing + unit status.
function operationalStatus(unit: Incubator, incubationDays: number): {
  label: string; bg: string; fg: string; Icon?: React.ComponentType<{ size?: number | string; color?: string; strokeWidth?: number | string }>; dot?: boolean;
} {
  if (!unit.paired || unit.status === "alert") return { label: "Offline", bg: "#FCE8E6", fg: "#C5221F", Icon: TriangleAlert };
  if (unit.dayOfIncubation >= incubationDays) return { label: "Completed", bg: "#D1FAE5", fg: "#065F46", Icon: Check };
  if (unit.status === "warning") return { label: "Lockdown", bg: "#FEF7E0", fg: "#B06000", Icon: Lock };
  if (unit.dayOfIncubation === 0) return { label: "Ready", bg: "#F1F3F4", fg: "#5F6368", dot: true };
  return { label: "Incubating", bg: "#E6F4EA", fg: "#137333", Icon: Egg };
}

function Trend({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.05) return <span style={{ color: MUTED, fontSize: 13 }}>→ Stable</span>;
  return (
    <span style={{ color: MUTED, fontSize: 13 }}>
      {delta > 0 ? "↗" : "↘"} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

function Reading({ icon, label, value, unit, delta, state, subtext }: {
  icon: React.ReactNode; label: string; value: number; unit: string;
  delta?: number; state: ReadingState; subtext?: React.ReactNode;
}) {
  const alert = state !== "ok";
  const valueColor = readingStateColors[state];
  return (
    <div
      className="min-w-0 overflow-hidden rounded-2xl"
      style={{ backgroundColor: tileBg[state], border: `1px solid ${tileBorder[state]}`, padding: 8 }}
    >
      <div style={{ color: alert ? valueColor : "#78716C", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-1">
        <span className="shrink-0 flex items-center" style={{ color: alert ? valueColor : MUTED }}>
          {icon}
        </span>
        <span
          className="shrink-0 tracking-tight"
          style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 20, fontWeight: 800, color: valueColor, whiteSpace: "nowrap" }}
        >
          {value}
        </span>
        <span className="whitespace-nowrap" style={{ color: alert ? valueColor : MUTED, fontSize: 12 }}>
          {unit}
        </span>
      </div>
      <div className="mt-0.5 flex items-center" style={{ height: 18 }}>
        {delta !== undefined ? (
          <Trend delta={delta} />
        ) : subtext ? (
          <div className="truncate whitespace-nowrap" style={{ fontSize: 11 }}>
            {subtext}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function IncubatorCard({ unit, mode, onOpen, cta = "Configure" }: Props) {
  const tempSt = rangeState(unit.temp, mode.targetTemp);
  const humSt = rangeState(unit.humidity, mode.targetHumidity);
  const waterSt = waterState(unit.waterLevel);
  const waterInfo = getWaterStatusInfo(unit.waterLevel);
  const progress = Math.round((unit.dayOfIncubation / mode.incubationDays) * 100);
  const status = operationalStatus(unit, mode.incubationDays);

  return (
    <Card
      className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ backgroundColor: CARD, borderColor: BORDER, borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
      tabIndex={0}
      onClick={() => onOpen(unit.id)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(unit.id); }}
    >
      <CardContent className="px-5 pb-5 pt-3">
        {/* Header — name and mode on the left; power indicator alone on the right. */}
        <div className="mb-3 min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h3 className="min-w-0 truncate" style={{ fontSize: 18, fontWeight: 800, color: "#2D241E" }}>
              {unit.name}
            </h3>
            <div className="shrink-0">
              <SegmentedBattery battery={unit.batteryPct} charging={unit.powerSource !== "battery"} showLabel />
            </div>
          </div>
          <p className="min-w-0 truncate" style={{ color: "#6E6259", fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginTop: 2 }}>
            {mode.name}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Reading icon={<Thermometer size={15} />} label="TEMP" value={unit.temp} unit="°C" delta={unit.tempTrend} state={tempSt} />
          <Reading icon={<Droplets size={15} />} label="HUMIDITY" value={unit.humidity} unit="%" delta={unit.humidityTrend} state={humSt} />
          <Reading
            icon={<Waves size={15} />}
            label="WATER"
            value={unit.waterLevel}
            unit="%"
            state={waterSt}
            subtext={
              <span style={{ color: waterInfo.color, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                {waterInfo.label}
              </span>
            }
          />
        </div>

        {/* Cycle progress — the day count gets its own high-visibility row. */}
        <div style={{ marginTop: 12 }}>
          <div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}>
            <span className="whitespace-nowrap" style={{ fontSize: 13, fontWeight: 700, color: "#2D241E" }}>
              Day {unit.dayOfIncubation} of {mode.incubationDays}
            </span>
            <span className="whitespace-nowrap" style={{ fontSize: 12, fontWeight: 500, color: MUTED }}>
              {progress}% Complete
            </span>
          </div>
          <div
            className="w-full overflow-hidden rounded-full"
            style={{ height: 6, backgroundColor: BORDER }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Incubation progress: day ${unit.dayOfIncubation} of ${mode.incubationDays}`}
          >
            <div style={{ width: `${progress}%`, height: "100%", backgroundColor: RUST, borderRadius: 9999 }} />
          </div>
        </div>

        {/* Footer — status badge left, action button right. */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <span
            className="inline-flex shrink-0 items-center rounded-full"
            style={{ backgroundColor: status.bg, color: status.fg, fontSize: 12, fontWeight: 700, padding: "6px 12px", gap: 6 }}
          >
            {status.Icon ? (
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: status.fg }}
              >
                <status.Icon size={10} color="#FFFFFF" strokeWidth={3} />
              </span>
            ) : (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: status.fg }} />
            )}
            {status.label}
          </span>
          <Button
            onClick={(e) => { e.stopPropagation(); onOpen(unit.id); }}
            className="rounded-xl transition-colors hover:bg-[#FFF5F2]"
            style={{
              backgroundColor: "transparent",
              color: CTA,
              height: 36,
              border: `1px solid ${CTA}`,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {cta} <ChevronRight size={16} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
