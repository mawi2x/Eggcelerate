import { Thermometer, Droplets, ChevronRight } from "lucide-react";
import { Lock, EggCrack, Egg, WifiSlash, Bird, CheckCircle } from "@phosphor-icons/react";
import { ExclamationIcon } from "./icons";
import { StatusIconBadge, statusIconBadgeGlyphSize } from "./StatusIconBadge";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { SegmentedBattery } from "./SegmentedBattery";
import { cn } from "./ui/utils";
import { getWaterStatusInfo, readingStateColors } from "./statusPresentation";
import { conditionDisplayLabels } from "../domain/cycle";
import { rangeState, waterState } from "../domain/incubator";
import type { Incubator, Mode, ReadingState } from "../domain/types";

interface Props {
  unit: Incubator;
  mode: Mode;
  onOpen: (id: string) => void;
  cta?: string;
  /** Opens the final harvest flow (hatch day and later). */
  onHarvest?: (unit: Incubator) => void;
  /** Active / selected visual highlight state (e.g. mobile active chamber). */
  highlighted?: boolean;
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
// Farmer-friendly lifecycle status pill, derived from the shared cycle phase.
function LockFillIcon({ size = 15, color = "#FFFFFF" }: { size?: number | string; color?: string }) {
  return <Lock size={size} color={color} weight="fill" />;
}

function EggCrackFillIcon({ size = 15, color = "#FFFFFF" }: { size?: number | string; color?: string }) {
  return <EggCrack size={size} color={color} weight="fill" />;
}

function EggFillIcon({ size = 15, color = "#FFFFFF" }: { size?: number | string; color?: string }) {
  return <Egg size={size} color={color} weight="fill" />;
}

function WifiSlashIcon({ size = 15, color = "#FFFFFF" }: { size?: number | string; color?: string }) {
  return <WifiSlash size={size} color={color} weight="fill" />;
}

function CheckFillIcon({ size = 15, color = "#FFFFFF" }: { size?: number | string; color?: string }) {
  return <CheckCircle size={size} color={color} weight="fill" />;
}

function BirdFillIcon({ size = 15, color = "#FFFFFF" }: { size?: number | string; color?: string }) {
  return <Bird size={size} color={color} weight="fill" />;
}

function ExclamationFillIcon({ size = 15, color = "#FFFFFF" }: { size?: number | string; color?: string }) {
  return <ExclamationIcon size={size} color={color} />;
}

function operationalStatus(unit: Incubator): {
  label: string; bg: string; fg: string; Icon?: React.ComponentType<{ size?: number | string; color?: string; strokeWidth?: number | string }>; dot?: boolean;
} {
  if (!unit.paired || unit.connectionState !== "connected") {
    const label = unit.connectionState === "connecting"
      ? "Connecting"
      : unit.connectionState === "connection_failed"
      ? "Connection Failed"
      : "Offline";
    return { label, bg: "#FCE8E6", fg: "#C5221F", Icon: WifiSlashIcon };
  }
  if (unit.cyclePhase === "completed") return { label: "Completed", bg: "#D1FAE5", fg: "#065F46", Icon: CheckFillIcon };
  if (unit.cyclePhase === "stopped_early") return { label: "Stopped Early", bg: "#FEE2E2", fg: "#991B1B", Icon: ExclamationFillIcon };
  if (unit.cyclePhase === "awaiting_finish") return { label: "Awaiting Finish", bg: "#FFF4D6", fg: "#9A6700", Icon: EggCrackFillIcon };
  if (unit.cyclePhase === "hatching") return { label: "Hatching", bg: "#E8F0FE", fg: "#1967D2", Icon: BirdFillIcon };
  if (unit.cyclePhase === "lockdown") return { label: "Lockdown", bg: "var(--brand-primary-soft)", fg: "var(--brand-primary)", Icon: LockFillIcon };
  if (unit.cyclePhase === "ready") return { label: "Ready", bg: "#F1F3F4", fg: "#5F6368", dot: true };
  return { label: "Incubating", bg: "#E6F4EA", fg: "#137333", Icon: EggFillIcon };
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

export function IncubatorCard({ unit, mode, onOpen, cta = "Configure", onHarvest, highlighted = false }: Props) {
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
      className={cn(
        "group cursor-pointer overflow-hidden border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        highlighted
          ? "border-[var(--nav-hover-border)] bg-[var(--nav-hover-bg)] shadow-md"
          : "border-[var(--border-default)] bg-[var(--surface-subtle)] hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] shadow-[0_2px_12px_rgba(0,0,0,0.04)]",
      )}
      style={{ borderRadius: 16 }}
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
        {/* Header — name and mode on the left; power and urgent severity pill on the right. */}
        <div className="mb-3 min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h3 className="flex min-w-0 items-center gap-1" style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)", fontWeight: "var(--weight-semibold)", lineHeight: "var(--leading-snug)", color: "var(--text-primary)" }}>
              <span className="min-w-0" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>{unit.name}</span>
              <ChevronRight
                size={14}
                className={cn(
                  "shrink-0 transition-opacity duration-200",
                  highlighted ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                style={{ color: "#C27B4A" }}
                aria-hidden
              />
            </h3>
            <div className="shrink-0">
              <SegmentedBattery battery={unit.batteryPct} charging={unit.powerSource !== "battery"} showLabel />
            </div>
          </div>
          <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2">
            <p className="min-w-0 truncate" style={{ color: ready ? "#9CA3AF" : "#6E6259", fontFamily: "var(--font-body)", fontSize: "var(--type-body-sm)", fontWeight: "var(--weight-medium)", lineHeight: "var(--leading-normal)" }}>
              {ready ? "Unassigned" : mode.name}
            </p>
            {unit.conditionSeverity !== "info" && (
              <span
                className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5"
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

        {/* Footer — full-width status oval containing the status icon, label, and configure button. */}
        <div
          className="mt-4 flex items-center justify-between gap-2 rounded-full p-1.5"
          style={{
            backgroundColor: status.bg,
            border: `1px solid ${status.fg}22`,
          }}
        >
          <div className="flex min-w-0 items-center gap-2 pl-1.5">
            {status.Icon ? (
              <StatusIconBadge
                size="sm"
                backgroundColor={status.fg}
                icon={<status.Icon size={statusIconBadgeGlyphSize("sm")} color="var(--status-icon-badge-fg)" strokeWidth={3} />}
              />
            ) : (
              <span className="ml-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: status.fg }} />
            )}
            <span
              style={{
                color: status.fg,
                fontFamily: "var(--font-body)",
                fontSize: 14,
                fontWeight: 700,
                lineHeight: "var(--leading-normal)",
              }}
            >
              {status.label}
            </span>
          </div>

          {cycleEnded ? (
            /* Hatch day reached — harvest & reset ends the overtime run. */
            <Button
              type="button"
              onClick={(e) => { e.stopPropagation(); onHarvest?.(unit); }}
              className="cursor-pointer rounded-full shadow-sm transition-colors hover:brightness-110"
              style={{ backgroundColor: RUST, color: "#FFFFFF", height: 32, fontFamily: "var(--font-body)", fontSize: "var(--type-caption)", fontWeight: "var(--weight-bold)", lineHeight: "var(--leading-normal)", paddingLeft: 12, paddingRight: 12 }}
            >
              Finish Cycle
            </Button>
          ) : (
            <Button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpen(unit.id); }}
              className="cursor-pointer rounded-full shadow-sm transition-colors hover:bg-[#FFF5F2]"
              style={{
                backgroundColor: "#FFFFFF",
                color: CTA,
                height: 32,
                border: "1px solid rgba(0,0,0,0.12)",
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: 700,
                lineHeight: "var(--leading-normal)",
                paddingLeft: 12,
                paddingRight: 10,
              }}
            >
              {ready ? "Start Setup" : cta} <ChevronRight size={15} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
