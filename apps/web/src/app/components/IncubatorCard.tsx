import { Thermometer, Droplets, ChevronRight, Egg, Check, TriangleAlert, Bird, LockKeyhole, Clock } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { SegmentedBattery } from "./SegmentedBattery";
import { Incubator, Mode, ReadingState, rangeState, waterState, getWaterStatusInfo, readingStateColors } from "../data/mockData";
import { conditionDisplayLabels } from "../domain/cycle";

interface Props {
  unit: Incubator;
  mode: Mode;
  onOpen: (id: string) => void;
  cta?: string;
  /** Opens the final harvest flow (hatch day and later). */
  onHarvest?: (unit: Incubator) => void;
}

// Design tokens.
const BORDER = "var(--border-default)";
const TILE = "#F2EEE5";
const MUTED = "var(--text-secondary)";
const RUST = "var(--brand-primary)";
const CTA = "var(--brand-primary)";

const tileBg: Record<string, string> = { ok: TILE, warning: "#FFFBEB", critical: "#FEF2F2" };
const tileBorder: Record<string, string> = { ok: BORDER, warning: "#FCD34D", critical: "#FCA5A5" };

// Farmer-friendly lifecycle status pill, derived from the shared cycle phase.
function operationalStatus(unit: Incubator): {
  label: string; bg: string; fg: string; Icon?: React.ComponentType<{ size?: number | string; color?: string; strokeWidth?: number | string }>; dot?: boolean;
} {
  if (!unit.paired || unit.connectionState !== "connected") {
    const label = unit.connectionState === "connecting"
      ? "Connecting"
      : unit.connectionState === "connection_failed"
      ? "Connection Failed"
      : "Offline";
    return { label, bg: "#FCE8E6", fg: "#C5221F", Icon: TriangleAlert };
  }
  if (unit.cyclePhase === "completed") return { label: "Completed", bg: "#D1FAE5", fg: "#065F46", Icon: Check };
  if (unit.cyclePhase === "stopped_early") return { label: "Stopped Early", bg: "#FEE2E2", fg: "#991B1B", Icon: TriangleAlert };
  if (unit.cyclePhase === "awaiting_finish") return { label: "Awaiting Finish", bg: "#FFF4D6", fg: "#9A6700", Icon: Clock };
  if (unit.cyclePhase === "hatching") return { label: "Hatching", bg: "#E8F0FE", fg: "#1967D2", Icon: Bird };
  if (unit.cyclePhase === "lockdown") return { label: "Lockdown", bg: "var(--brand-primary-soft)", fg: "var(--brand-primary)", Icon: LockKeyhole };
  if (unit.cyclePhase === "ready") return { label: "Ready", bg: "#F1F3F4", fg: "#5F6368", dot: true };
  return { label: "Incubating", bg: "#E6F4EA", fg: "#137333", Icon: Egg };
}

function Trend({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.05) return <span style={{ color: MUTED, fontFamily: "var(--font-body)", fontSize: "var(--type-caption)", fontWeight: "var(--weight-regular)", lineHeight: "var(--leading-normal)" }}>→ Stable</span>;
  return (
    <span style={{ color: MUTED, fontFamily: "var(--font-body)", fontSize: "var(--type-caption)", fontWeight: "var(--weight-regular)", lineHeight: "var(--leading-normal)" }}>
      {delta > 0 ? "↗" : "↘"} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

// Uniform 3-line metric box shared by TEMP / HUMIDITY / WATER. Fixed line
// heights keep the Line 2 and Line 3 baselines aligned across all three tiles.
function Reading({ icon, label, value, unit, delta, state, subtext, valueColor, valueSize = 18, subtextSize = 12 }: {
  icon?: React.ReactNode; label: string; value: number | string; unit?: string;
  delta?: number; state: ReadingState; subtext?: React.ReactNode; valueColor?: string;
  valueSize?: number; subtextSize?: number;
}) {
  const alert = state !== "ok";
  const color = valueColor ?? readingStateColors[state];
  return (
    <div
      className="min-w-0 overflow-hidden rounded-2xl"
      style={{ backgroundColor: tileBg[state], border: `1px solid ${tileBorder[state]}`, padding: 12, overflow: "hidden" }}
    >
      <div style={{ color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: "var(--type-label)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-label)", lineHeight: "var(--leading-snug)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div className="flex min-w-0 items-center gap-1" style={{ height: 22, marginTop: 2 }}>
        {icon && (
          <span className="shrink-0 flex items-center" style={{ color: alert ? color : MUTED }}>
            {icon}
          </span>
        )}
        <span
          className="min-w-0 overflow-hidden tracking-tight"
          style={{ fontFamily: "var(--font-display)", fontSize: valueSize === 16 ? "var(--type-heading-sm)" : "var(--type-heading-md)", fontWeight: "var(--weight-bold)", lineHeight: "var(--leading-tight)", color, whiteSpace: "nowrap", textOverflow: "clip" }}
        >
          {value}
        </span>
        {unit && (
          <span className="whitespace-nowrap" style={{ color: alert ? color : MUTED, fontFamily: "var(--font-body)", fontSize: "var(--type-caption)", fontWeight: "var(--weight-regular)", lineHeight: "var(--leading-normal)" }}>
            {unit}
          </span>
        )}
      </div>
      <div className="flex items-center" style={{ height: 16, marginTop: 2 }}>
        {delta !== undefined ? (
          <Trend delta={delta} />
        ) : subtext ? (
          <div className="overflow-hidden whitespace-nowrap" style={{ fontFamily: "var(--font-body)", fontSize: subtextSize === 11 ? "var(--type-label)" : "var(--type-caption)", fontWeight: "var(--weight-regular)", lineHeight: "var(--leading-normal)", textOverflow: "clip" }}>
            {subtext}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function IncubatorCard({ unit, mode, onOpen, cta = "Configure", onHarvest }: Props) {
  const tempSt = rangeState(unit.temp, mode.targetTemp);
  const humSt = rangeState(unit.humidity, mode.targetHumidity);
  const waterSt = waterState(unit.waterOk);
  const waterInfo = getWaterStatusInfo(unit.waterOk);
  const progress = mode.incubationDays > 0
    ? Math.min(100, Math.max(0, Math.round((unit.dayOfIncubation / mode.incubationDays) * 100)))
    : 0;
  const status = operationalStatus(unit);
  const ready = status.dot === true;

  // Hatch day reached — overtime keeps running automatically until harvest.
  const cycleEnded = !ready && unit.dayOfIncubation >= mode.incubationDays;

  return (
    <Card
      className="group cursor-pointer overflow-hidden border border-[var(--border-default)] bg-[var(--surface-subtle)] transition-colors duration-200 hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
      tabIndex={0}
      role="button"
      aria-label={`Open details for ${unit.name} — click to view`}
      onClick={() => onOpen(unit.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(unit.id);
        }
      }}
    >
      <CardContent className="flex h-full flex-col px-5 pb-5 pt-3">
        {/* Header — name and mode on the left; power indicator alone on the right. */}
        <div className="mb-3 min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h3 className="flex min-w-0 items-center gap-1" style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)", fontWeight: "var(--weight-semibold)", lineHeight: "var(--leading-snug)", color: "var(--text-primary)" }}>
              <span className="min-w-0" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>{unit.name}</span>
              <ChevronRight size={14} className="shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ color: "#C27B4A" }} aria-hidden />
            </h3>
            <div className="shrink-0">
              <SegmentedBattery battery={unit.batteryPct} charging={unit.powerSource !== "battery"} showLabel />
            </div>
          </div>
          <p className="min-w-0" style={{ color: ready ? "#9CA3AF" : "#6E6259", fontFamily: "var(--font-body)", fontSize: "var(--type-body-sm)", fontWeight: "var(--weight-medium)", lineHeight: "var(--leading-normal)", whiteSpace: "normal", wordBreak: "break-word", marginTop: 2 }}>
            {ready ? "Unassigned" : mode.name}
          </p>
        </div>

        {ready ? (
          /* Ready chamber — no cycle running yet, prompt the farmer to set up. */
          <div
            className="flex flex-1 flex-col items-center justify-center rounded-2xl px-4 py-5 text-center"
            style={{ backgroundColor: "#F9F6F0" }}
          >
            <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)", fontWeight: "var(--weight-bold)", lineHeight: "var(--leading-snug)", color: "var(--text-primary)" }}>Incubator Ready</p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--type-caption)", fontWeight: "var(--weight-regular)", color: "#6E6259", lineHeight: "var(--leading-normal)", marginTop: 4 }}>
              Load eggs and choose a mode to begin incubation.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Reading icon={<Thermometer size={15} />} label="TEMP" value={unit.temp} unit="°C" delta={unit.tempTrend} state={tempSt} />
              <Reading icon={<Droplets size={15} />} label="HUMIDITY" value={unit.humidity} unit="%" delta={unit.humidityTrend} state={humSt} />
              <Reading
                label="WATER"
                value={unit.waterOk ? "Good" : "Low"}
                state={waterSt}
                valueColor={waterInfo.color}
                valueSize={16}
                subtextSize={11}
                subtext={
                  <span style={{ color: waterInfo.color }}>
                    {unit.waterOk ? "Sufficient" : "Refill"}
                  </span>
                }
              />
            </div>

            {/* Cycle progress — the day count gets its own high-visibility row. */}
            <div style={{ marginTop: 12 }}>
              <div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}>
                <span className="whitespace-nowrap" style={{ fontFamily: "var(--font-body)", fontSize: "var(--type-body-sm)", fontWeight: "var(--weight-bold)", lineHeight: "var(--leading-normal)", color: "var(--text-primary)" }}>
                  Day {unit.dayOfIncubation} of {mode.incubationDays}
                </span>
                <span className="whitespace-nowrap" style={{ fontFamily: "var(--font-body)", fontSize: "var(--type-caption)", fontWeight: "var(--weight-medium)", lineHeight: "var(--leading-normal)", color: MUTED }}>
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
          </>
        )}

        {/* Footer — status badge left, action button right. */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              className="inline-flex shrink-0 items-center rounded-full"
              style={{ backgroundColor: status.bg, color: status.fg, fontFamily: "var(--font-body)", fontSize: "var(--type-caption)", fontWeight: "var(--weight-bold)", lineHeight: "var(--leading-normal)", padding: "6px 12px", gap: 6 }}
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
            {unit.conditionSeverity !== "info" && (
              <span
                className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1"
                style={{
                  backgroundColor: unit.conditionSeverity === "critical" ? "#FEE2E2" : "#FEF3C7",
                  color: unit.conditionSeverity === "critical" ? "#991B1B" : "#92400E",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-label)",
                  fontWeight: "var(--weight-bold)",
                  letterSpacing: "var(--tracking-label)",
                  lineHeight: "var(--leading-snug)",
                  textTransform: "uppercase",
                }}
              >
                {conditionDisplayLabels[unit.conditionSeverity]}
              </span>
            )}
          </div>
          {cycleEnded ? (
            /* Hatch day reached — harvest & reset ends the overtime run. */
            <Button
              onClick={(e) => { e.stopPropagation(); onHarvest?.(unit); }}
              className="rounded-xl transition-colors"
              style={{ backgroundColor: RUST, color: "#FFFFFF", height: 36, fontFamily: "var(--font-body)", fontSize: "var(--type-caption)", fontWeight: "var(--weight-semibold)", lineHeight: "var(--leading-normal)", paddingLeft: 12, paddingRight: 12 }}
            >
              Finish Cycle
            </Button>
          ) : (
            <Button
              onClick={(e) => { e.stopPropagation(); onOpen(unit.id); }}
              className="rounded-xl transition-colors hover:bg-[#FFF5F2]"
              style={{
                backgroundColor: "transparent",
                color: CTA,
                height: 36,
                border: `1px solid ${CTA}`,
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-body-sm)",
                fontWeight: "var(--weight-medium)",
                lineHeight: "var(--leading-normal)",
              }}
            >
              {ready ? "Start Setup" : cta} <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
