import {
  Bird,
  CheckFatIcon,
  Egg,
  EggCrack,
  Lock,
  WifiSlash,
} from "@phosphor-icons/react";
import { ChevronRight, Droplets, Thermometer } from "lucide-react";
import { conditionDisplayLabels } from "../domain/cycle";
import { rangeState, waterState } from "../domain/incubator";
import type { Incubator, Mode, ReadingState } from "../domain/types";
import {
  ChamberCardFooter,
  ChamberCardHeader,
  ChamberCardShell,
} from "./ChamberCardShell";
import { FilledCheckIcon as CheckCircle } from "./icons/CheckIcon";
import { ExclamationIcon } from "./icons/ExclamationIcon";
import { SegmentedBattery } from "./SegmentedBattery";
import { StatusIconBadge, statusIconBadgeGlyphSize } from "./StatusIconBadge";
import { getWaterStatusInfo, readingStateColors } from "./statusPresentation";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";

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
const TILE = "var(--surface-tile)";
const MUTED = "var(--text-secondary)";
const RUST = "var(--brand-primary)";
const CTA = "var(--brand-primary)";

const tileBg: Record<string, string> = {
  ok: TILE,
  warning: "var(--surface-warn-tile)",
  critical: "var(--surface-blush)",
};
const tileBorder: Record<string, string> = {
  ok: BORDER,
  warning: "var(--tile-border-warning)",
  critical: "var(--tile-border-critical)",
};

// Farmer-friendly lifecycle status pill, derived from the shared cycle phase.
// Farmer-friendly lifecycle status pill, derived from the shared cycle phase.
function LockFillIcon({
  size = 15,
  color = "var(--on-brand)",
}: {
  size?: number | string;
  color?: string;
}) {
  return <Lock size={size} color={color} weight="fill" />;
}

function EggCrackFillIcon({
  size = 15,
  color = "var(--on-brand)",
}: {
  size?: number | string;
  color?: string;
}) {
  return <EggCrack size={size} color={color} weight="fill" />;
}

function EggFillIcon({
  size = 15,
  color = "var(--on-brand)",
}: {
  size?: number | string;
  color?: string;
}) {
  return <Egg size={size} color={color} weight="fill" />;
}

function WifiSlashIcon({
  size = 15,
  color = "var(--on-brand)",
}: {
  size?: number | string;
  color?: string;
}) {
  return <WifiSlash size={size} color={color} weight="fill" />;
}

function CheckFillIcon({
  size = 15,
  color = "var(--on-brand)",
}: {
  size?: number | string;
  color?: string;
}) {
  return <CheckCircle size={size} color={color} />;
}

function ReadyCheckIcon({
  size = 15,
  color = "var(--on-brand)",
}: {
  size?: number | string;
  color?: string;
}) {
  return <CheckFatIcon size={size} color={color} weight="fill" />;
}

function BirdFillIcon({
  size = 15,
  color = "var(--on-brand)",
}: {
  size?: number | string;
  color?: string;
}) {
  return <Bird size={size} color={color} weight="fill" />;
}

function ExclamationFillIcon({
  size = 15,
  color = "var(--on-brand)",
}: {
  size?: number | string;
  color?: string;
}) {
  return <ExclamationIcon size={size} color={color} aria-hidden="true" />;
}

function operationalStatus(unit: Incubator): {
  label: string;
  bg: string;
  fg: string;
  Icon?: React.ComponentType<{
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
  }>;
  dot?: boolean;
} {
  if (!unit.paired || unit.connectionState !== "connected") {
    const label =
      unit.connectionState === "connecting"
        ? "Connecting"
        : unit.connectionState === "connection_failed"
          ? "Connection Failed"
          : "Offline";
    return {
      label,
      bg: "var(--status-offline-bg)",
      fg: "var(--status-offline-fg)",
      Icon: WifiSlashIcon,
    };
  }
  if (unit.cyclePhase === "completed")
    return {
      label: "Completed",
      bg: "var(--status-success-pale)",
      fg: "var(--status-success-strong)",
      Icon: CheckFillIcon,
    };
  if (unit.cyclePhase === "stopped_early")
    return {
      label: "Stopped Early",
      bg: "var(--status-danger-bg)",
      fg: "var(--status-danger-strong)",
      Icon: ExclamationFillIcon,
    };
  if (unit.cyclePhase === "awaiting_finish")
    return {
      label: "Awaiting Finish",
      bg: "var(--surface-pending)",
      fg: "var(--text-amber-soft)",
      Icon: EggCrackFillIcon,
    };
  if (unit.cyclePhase === "hatching")
    return {
      label: "Hatching",
      bg: "var(--status-flight-bg)",
      fg: "var(--status-flight-fg)",
      Icon: BirdFillIcon,
    };
  if (unit.cyclePhase === "lockdown")
    return {
      label: "Lockdown",
      bg: "var(--brand-primary-soft)",
      fg: "var(--brand-primary)",
      Icon: LockFillIcon,
    };
  if (unit.cyclePhase === "ready")
    return {
      label: "Ready",
      bg: "var(--status-idle-bg)",
      fg: "var(--status-idle-fg)",
      Icon: ReadyCheckIcon,
      dot: true,
    };
  return {
    label: "Incubating",
    bg: "var(--status-hatch-bg)",
    fg: "var(--status-hatch-fg)",
    Icon: EggFillIcon,
  };
}

function Trend({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.05)
    return (
      <span
        style={{
          color: MUTED,
          fontFamily: "var(--font-body)",
          fontSize: "var(--type-caption)",
          fontWeight: "var(--weight-regular)",
          lineHeight: "var(--leading-normal)",
        }}
      >
        → Stable
      </span>
    );
  return (
    <span
      style={{
        color: MUTED,
        fontFamily: "var(--font-body)",
        fontSize: "var(--type-caption)",
        fontWeight: "var(--weight-regular)",
        lineHeight: "var(--leading-normal)",
      }}
    >
      {delta > 0 ? "↗" : "↘"} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

// Uniform 3-line metric box shared by TEMP / HUMIDITY / WATER. Fixed line
// heights keep the Line 2 and Line 3 baselines aligned across all three tiles.
function Reading({
  icon,
  label,
  value,
  unit,
  delta,
  state,
  subtext,
  valueColor,
  valueSize = 18,
  subtextSize = 12,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number | string;
  unit?: string;
  delta?: number;
  state: ReadingState;
  subtext?: React.ReactNode;
  valueColor?: string;
  valueSize?: number;
  subtextSize?: number;
}) {
  const alert = state !== "ok";
  const color = valueColor ?? readingStateColors[state];
  return (
    <div
      className="min-w-0 overflow-hidden rounded-[var(--radius-dialog)]"
      style={{
        backgroundColor: tileBg[state],
        border: `var(--border-width-hairline) solid ${tileBorder[state]}`,
        padding: "0.75rem",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          color: "var(--text-primary)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--type-label)",
          fontWeight: "var(--weight-bold)",
          letterSpacing: "var(--tracking-label)",
          lineHeight: "var(--leading-snug)",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        className="flex min-w-0 items-center gap-1"
        style={{ height: 22, marginTop: 2 }}
      >
        {icon && (
          <span
            className="shrink-0 flex items-center"
            style={{ color: alert ? color : MUTED }}
          >
            {icon}
          </span>
        )}
        <span
          className="min-w-0 overflow-hidden tracking-tight"
          style={{
            fontFamily: "var(--font-display)",
            fontSize:
              valueSize === 16
                ? "var(--type-heading-sm)"
                : "var(--type-heading-md)",
            fontWeight: "var(--weight-bold)",
            lineHeight: "var(--leading-tight)",
            color,
            whiteSpace: "nowrap",
            textOverflow: "clip",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="whitespace-nowrap"
            style={{
              color: alert ? color : MUTED,
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-regular)",
              lineHeight: "var(--leading-normal)",
            }}
          >
            {unit}
          </span>
        )}
      </div>
      <div
        className="flex items-center"
        style={{
          minHeight: "max(16px, calc(var(--type-caption) * 1.5))",
          marginTop: 2,
        }}
      >
        {delta !== undefined ? (
          <Trend delta={delta} />
        ) : subtext ? (
          <div
            className="overflow-hidden whitespace-nowrap"
            style={{
              fontFamily: "var(--font-body)",
              fontSize:
                subtextSize === 11
                  ? "var(--type-label)"
                  : "var(--type-caption)",
              fontWeight: "var(--weight-regular)",
              lineHeight: "var(--leading-normal)",
              textOverflow: "clip",
            }}
          >
            {subtext}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function IncubatorCard({
  unit,
  mode,
  onOpen,
  cta = "Configure",
  onHarvest,
  highlighted = false,
}: Props) {
  const tempSt = rangeState(unit.temp, mode.targetTemp);
  const humSt = rangeState(unit.humidity, mode.targetHumidity);
  const waterSt = waterState(unit.waterOk);
  const waterInfo = getWaterStatusInfo(unit.waterOk);
  const progress =
    mode.incubationDays > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((unit.dayOfIncubation / mode.incubationDays) * 100),
          ),
        )
      : 0;
  const status = operationalStatus(unit);
  const ready = status.dot === true;

  // Hatch day reached — overtime keeps running automatically until harvest.
  const cycleEnded = !ready && unit.dayOfIncubation >= mode.incubationDays;

  return (
    <ChamberCardShell
      labelledBy={`incubator-card-${unit.id}`}
      highlighted={highlighted}
    >
      {/* Stretched open control: the whole card opens the chamber. Footer
          actions sit above it (relative + z-index), so no click crutches. */}
      <button
        type="button"
        onClick={() => onOpen(unit.id)}
        aria-label={`Open details for ${unit.name}`}
        className="absolute inset-0 z-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
      />
      <ChamberCardHeader
        titleId={`incubator-card-${unit.id}`}
        title={
          <>
            <span
              className="min-w-0"
              style={{
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              {unit.name}
            </span>
            <ChevronRight
              size={14}
              className={cn(
                "shrink-0 transition-opacity duration-200",
                highlighted
                  ? "opacity-100"
                  : "opacity-60 md:opacity-0 group-hover:opacity-100",
              )}
              style={{ color: "var(--progress-stroke)" }}
              aria-hidden
            />
          </>
        }
        titleClassName="flex min-w-0 items-center gap-1"
        subtitle={ready ? "Unassigned" : mode.name}
        subtitleStyle={{
          color: ready ? "var(--text-gray-cool)" : "var(--text-farm)",
          fontWeight: "var(--weight-medium)",
        }}
        trailing={
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <SegmentedBattery
              battery={unit.batteryPct}
              charging={unit.powerSource !== "battery"}
              showLabel
            />
            {unit.conditionSeverity !== "info" ? (
              <span
                className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5"
                style={{
                  backgroundColor:
                    unit.conditionSeverity === "critical"
                      ? "var(--status-danger-bg)"
                      : "var(--status-warning-bg)",
                  color:
                    unit.conditionSeverity === "critical"
                      ? "var(--status-danger-strong)"
                      : "var(--text-amber-deep)",
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
            ) : undefined}
          </div>
        }
      />

      {ready ? (
        /* Ready chamber — no cycle running yet, prompt the farmer to set up. */
        <div
          className="flex flex-1 flex-col items-center justify-center rounded-[var(--radius-dialog)] px-4 py-5 text-center"
          style={{ backgroundColor: "var(--surface-subtle)" }}
        >
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--type-heading-sm)",
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-snug)",
              color: "var(--text-primary)",
            }}
          >
            Incubator Ready
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-regular)",
              color: "var(--text-farm)",
              lineHeight: "var(--leading-normal)",
              marginTop: 4,
            }}
          >
            Load eggs and choose a mode to begin incubation.
          </p>
        </div>
      ) : (
        <div className="flex-1">
          <div className="grid grid-cols-3 gap-2">
            <Reading
              icon={<Thermometer size={15} />}
              label="TEMP"
              value={unit.temp}
              unit="°C"
              delta={unit.tempTrend}
              state={tempSt}
            />
            <Reading
              icon={<Droplets size={15} />}
              label="HUMIDITY"
              value={unit.humidity}
              unit="%"
              delta={unit.humidityTrend}
              state={humSt}
            />
            <Reading
              label="WATER"
              value={unit.waterOk ? "Good" : "Low"}
              state={waterSt}
              valueColor={waterInfo.color}
              valueSize={16}
              subtext={
                <span style={{ color: waterInfo.color }}>
                  {unit.waterOk ? "Sufficient" : "Refill"}
                </span>
              }
            />
          </div>

          {/* Cycle progress — the day count gets its own high-visibility row. */}
          <div style={{ marginTop: 12 }}>
            <div
              className="flex items-center justify-between gap-2"
              style={{ marginBottom: 6 }}
            >
              <span
                className="whitespace-nowrap max-[19rem]:whitespace-normal"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-body-sm)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-normal)",
                  color: "var(--text-primary)",
                }}
              >
                Day {unit.dayOfIncubation} of {mode.incubationDays}
              </span>
              <span
                className="whitespace-nowrap max-[19rem]:whitespace-normal"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-caption)",
                  fontWeight: "var(--weight-medium)",
                  lineHeight: "var(--leading-normal)",
                  color: MUTED,
                }}
              >
                {progress}% Complete
              </span>
            </div>
            <div
              className="w-full overflow-hidden rounded-full"
              style={{
                height: "var(--progress-thickness)",
                backgroundColor: BORDER,
              }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Incubation progress: day ${unit.dayOfIncubation} of ${mode.incubationDays}`}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  backgroundColor: RUST,
                  borderRadius: "var(--radius-pill)",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer — full-width status oval containing the status icon, label, and configure button. */}
      <ChamberCardFooter
        style={{
          backgroundColor: status.bg,
        }}
      >
        <div className="flex min-w-0 items-center gap-2 pl-1.5">
          {status.Icon ? (
            <StatusIconBadge
              size="sm"
              backgroundColor={status.fg}
              icon={
                <status.Icon
                  size={statusIconBadgeGlyphSize("sm")}
                  color="var(--status-icon-badge-fg)"
                  strokeWidth={3}
                />
              }
            />
          ) : (
            <span
              className="ml-1 h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: status.fg }}
            />
          )}
          <span
            style={{
              color: status.fg,
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-body)",
              fontWeight: "var(--weight-bold)",
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
            size="sm"
            onClick={() => onHarvest?.(unit)}
            aria-label={`Finish cycle for ${unit.name}`}
            className="relative z-10 h-[var(--control-height-mobile)] max-h-[var(--control-height-mobile)] py-0 md:h-[var(--control-height-default)] md:max-h-[var(--control-height-default)] cursor-pointer rounded-full shadow-sm transition-colors hover:brightness-110"
            style={{
              backgroundColor: RUST,
              color: "var(--on-brand)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-button-label)",
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-button)",
              paddingLeft: 12,
              paddingRight: 12,
            }}
          >
            <span>Finish Cycle</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => onOpen(unit.id)}
            aria-label={
              ready ? `Start setup for ${unit.name}` : `${cta} ${unit.name}`
            }
            className="relative z-10 h-[var(--control-height-mobile)] max-h-[var(--control-height-mobile)] py-0 md:h-[var(--control-height-default)] md:max-h-[var(--control-height-default)] cursor-pointer rounded-full shadow-sm transition-colors hover:bg-[var(--surface-action-hover)]"
            style={{
              backgroundColor: "var(--surface-card)",
              color: CTA,
              border: "var(--border-width-hairline) solid var(--border-ink)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-button-label)",
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-button)",
              paddingLeft: 12,
              paddingRight: 10,
            }}
          >
            <span>{ready ? "Start Setup" : cta}</span>{" "}
            <ChevronRight size={15} />
          </Button>
        )}
      </ChamberCardFooter>
    </ChamberCardShell>
  );
}
