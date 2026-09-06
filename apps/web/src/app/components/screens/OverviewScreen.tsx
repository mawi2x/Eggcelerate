import {
  Check,
  ChevronRight,
  Clock,
  Droplets,
  Egg,
  Layers,
  Thermometer,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Incubator, Mode, UnitStatus } from "../../domain/types";
import { Card, CardContent } from "../ui/card";

interface Props {
  units: Incubator[];
  modes: Mode[];
  onOpenUnit: (id: string) => void;
  onManageAll: () => void;
}

// ── Design tokens ───────────────────────────────────────────────────────────
const RUST = "var(--brand-primary)";
const BORDER = "var(--border-default)";
const TEXT = "var(--text-primary)";
const HEADING = "var(--text-primary)";

const conditionRowStyle = `
.condition-row{position:relative;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;transition:background-color 0.2s ease-in-out, border-color 0.2s ease-in-out}
.condition-row:hover{background:var(--nav-hover-bg);border-color:var(--nav-hover-border)}
`;

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--surface-card)",
  borderColor: "var(--border-default)",
  borderRadius: "var(--radius-card)",
  boxShadow: "var(--shadow-card)",
};

interface KpiPill {
  text: string;
  tone: "neutral" | "positive" | "negative" | "warning";
}
interface KpiFooter {
  primary: string;
  secondary?: string;
  tertiary?: string;
}

function KpiCard({
  Icon,
  label,
  value,
  pill,
  footer,
}: {
  Icon: typeof Layers;
  label: string;
  value: string;
  pill?: KpiPill;
  footer?: KpiFooter;
}) {
  return (
    <Card
      className={`relative overflow-hidden ${
        pill || footer
          ? "min-h-[6.3125rem] sm:min-h-[5.875rem] lg:min-h-[7.25rem]"
          : "min-h-[5.625rem]"
      }`}
      style={{
        ...cardStyle,
        height: "auto",
      }}
    >
      {/* Decorative watermark — cropped, tilted, low-opacity so text stays legible. */}
      <Icon
        aria-hidden
        className="pointer-events-none absolute -bottom-3 -right-3"
        style={{
          width: 80,
          height: 80,
          color: "var(--brand-primary)",
          opacity: 0.12,
          transform: "rotate(-12deg)",
        }}
        strokeWidth={1.5}
      />
      <CardContent className="relative flex flex-col p-3 sm:p-4">
        <div
          style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-label)",
            fontWeight: "var(--weight-bold)",
            letterSpacing: "var(--tracking-label)",
            lineHeight: "var(--leading-snug)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          className="mt-1 text-(length:--type-heading-sm) lg:text-(length:--type-panel-title)"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: "var(--weight-extrabold)",
            lineHeight: "var(--leading-tight)",
            color: "var(--text-primary)",
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
        >
          {value}
        </div>
        {pill && (
          <span
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-(length:--type-label) font-semibold"
            style={{
              backgroundColor:
                pill.tone === "neutral"
                  ? "var(--status-info-bg)"
                  : pill.tone === "positive"
                    ? "var(--status-success-bg)"
                    : pill.tone === "negative"
                      ? "var(--status-danger-bg)"
                      : "var(--status-warning-bg)",
              color:
                pill.tone === "neutral"
                  ? "var(--status-info-fg)"
                  : pill.tone === "positive"
                    ? "var(--status-success-fg)"
                    : pill.tone === "negative"
                      ? "var(--status-danger-fg)"
                      : "var(--status-warning-fg)",
              borderColor: "var(--border-default)",
            }}
          >
            {pill.tone === "positive" && "↗"} {pill.tone === "negative" && "↘"}{" "}
            {pill.text}
          </span>
        )}
        {footer && (
          <div className="mt-2">
            <div
              className="flex items-center gap-1 font-semibold"
              style={{
                color: "var(--text-primary)",
                fontSize: "var(--type-label)",
              }}
            >
              {footer.primary}
            </div>
            {footer.secondary && (
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: "var(--type-label)",
                }}
              >
                {footer.secondary}
              </div>
            )}
            {footer.tertiary && (
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: "var(--type-label)",
                }}
              >
                {footer.tertiary}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Ring stroke — progress-only (not health). Single soft clay derived from primary.
const PROGRESS_STROKE = "var(--progress-stroke)";

type OffTargetDir = "high" | "low" | "ok";

interface OffTargetEntry {
  unit: Incubator;
  mode: Mode;
  dev: number;
  dir: OffTargetDir;
  value: number;
  target: { min: number; max: number };
}

function getTempOff(
  unit: Incubator,
  mode: Mode,
): Omit<OffTargetEntry, "unit" | "mode"> {
  const v = unit.temp;
  const { min, max } = mode.targetTemp;
  if (v < min)
    return { dev: min - v, dir: "low", value: v, target: mode.targetTemp };
  if (v > max)
    return { dev: v - max, dir: "high", value: v, target: mode.targetTemp };
  return { dev: 0, dir: "ok", value: v, target: mode.targetTemp };
}

function getHumidityOff(
  unit: Incubator,
  mode: Mode,
): Omit<OffTargetEntry, "unit" | "mode"> {
  const v = unit.humidity;
  const { min, max } = mode.targetHumidity;
  if (v < min)
    return { dev: min - v, dir: "low", value: v, target: mode.targetHumidity };
  if (v > max)
    return { dev: v - max, dir: "high", value: v, target: mode.targetHumidity };
  return { dev: 0, dir: "ok", value: v, target: mode.targetHumidity };
}

function OffTargetRow({
  entry,
  kind,
  rank,
  onOpen,
}: {
  entry: OffTargetEntry;
  kind: "temp" | "humidity";
  rank: number;
  onOpen: (id: string) => void;
}) {
  const { unit, mode, dev, dir, value } = entry;
  const isOff = dev > 0.005;
  const unitLabel = kind === "temp" ? "°C" : "%";
  const displayValue =
    kind === "temp" ? value.toFixed(1) : Math.round(value).toString();
  const delta = dev.toFixed(kind === "temp" ? 1 : 0);

  let statusText: string;
  if (!isOff) statusText = "Within target";
  else if (kind === "temp")
    statusText =
      dir === "high" ? `Too warm by ${delta}°C` : `Too cool by ${delta}°C`;
  else
    statusText =
      dir === "high" ? `Too humid by ${delta}%` : `Too dry by ${delta}%`;

  const isUrgent = isOff && (kind === "temp" ? dev >= 1.5 : dev >= 10);
  const valueColor = !isOff
    ? "var(--text-primary)"
    : isUrgent
      ? "var(--status-danger-fg)"
      : "var(--text-bark)";
  const statusColor = !isOff
    ? "var(--text-neutral-cool)"
    : isUrgent
      ? "var(--status-danger-fg)"
      : "var(--text-ember)";

  return (
    <>
      <style>{conditionRowStyle}</style>
      <button
        type="button"
        onClick={() => onOpen(unit.id)}
        className="condition-row group flex min-h-[var(--control-height-default)] w-full cursor-pointer items-center justify-between gap-3 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 md:min-h-0"
        title={`${unit.name} · ${displayValue}${unitLabel}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{
              backgroundColor: isOff
                ? isUrgent
                  ? "var(--status-danger-bg)"
                  : "var(--surface-peach)"
                : "var(--surface-mint)",
              color: isOff
                ? isUrgent
                  ? "var(--status-danger-fg)"
                  : "var(--text-bark)"
                : "var(--status-success-fg)",
              border: `1px solid ${isOff ? (isUrgent ? "var(--border-blush)" : "var(--border-peach)") : "var(--border-mint)"}`,
            }}
          >
            {rank}
          </span>
          <div className="min-w-0">
            <div
              className="text-(length:--type-caption) lg:text-(length:--type-body-sm)"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-normal)",
                color: TEXT,
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
            >
              {unit.name}
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-medium)",
                lineHeight: "var(--leading-snug)",
                color: "var(--text-farm)",
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
            >
              {mode.name}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex flex-col items-end gap-0.5">
            <span
              className="text-(length:--type-caption) lg:text-(length:--type-body-sm)"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-normal)",
                color: valueColor,
                whiteSpace: "nowrap",
              }}
            >
              {displayValue}
              {unitLabel}
            </span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-medium)",
                lineHeight: "var(--leading-snug)",
                color: statusColor,
                whiteSpace: "nowrap",
              }}
            >
              {statusText}
            </span>
          </div>
          <ChevronRight
            size={14}
            className="shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            style={{ color: "var(--progress-stroke)" }}
            aria-hidden
          />
        </div>
      </button>
    </>
  );
}

/**
 * Minimal progress card: chamber name over its day count, then a single 120px
 * progress ring holding only the completion percentage. Status is carried by
 * the ring stroke alone — no pills, no sensor readings.
 */
function MiniCard({
  unit,
  mode,
  onOpen,
}: {
  unit: Incubator;
  mode: Mode;
  onOpen: (id: string) => void;
}) {
  const pct = Math.min(
    100,
    Math.round((unit.dayOfIncubation / mode.incubationDays) * 100),
  );
  const stroke = PROGRESS_STROKE;
  const size = 70;
  const width = 8;
  const r = (size - width) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <button
      type="button"
      onClick={() => onOpen(unit.id)}
      className="group flex h-full w-full cursor-pointer flex-col justify-between rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3 text-left transition-colors duration-200 hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:rounded-2xl md:p-4"
      title={`${unit.name} · Day ${unit.dayOfIncubation} of ${mode.incubationDays} — click to view`}
    >
      {/* Top-left header stack — name over mode over progress. */}
      <div className="w-full min-w-0 text-left">
        <div className="flex items-start justify-between gap-1">
          <span
            className="block min-w-0 flex-1 break-words text-(length:--type-body) lg:text-(length:--type-heading-sm)"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: "var(--weight-semibold)",
              lineHeight: "var(--leading-snug)",
              color: "var(--text-primary)",
            }}
            title={unit.name}
          >
            {unit.name}
          </span>
          <ChevronRight
            size={14}
            className="mt-0.5 hidden shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:block"
            style={{ color: "var(--progress-stroke)" }}
            aria-hidden
          />
        </div>
        <span
          className="block min-w-0 break-words text-(length:--type-caption) lg:text-(length:--type-body-sm)"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: "var(--weight-semibold)",
            lineHeight: "var(--leading-normal)",
            color: "var(--text-primary)",
            marginTop: 2,
          }}
        >
          {mode.name}
        </span>
        <span
          className="block min-w-0 break-words"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-caption)",
            fontWeight: "var(--weight-regular)",
            lineHeight: "var(--leading-normal)",
            color: "var(--text-farm)",
            marginTop: 2,
          }}
          title={`Progress: Day ${unit.dayOfIncubation} of ${mode.incubationDays}`}
        >
          Progress: Day {unit.dayOfIncubation} of {mode.incubationDays}
        </span>
      </div>

      {/* Center body — the ring */}
      <div className="relative mt-2.5 flex min-h-0 items-center justify-center md:mt-3">
        <svg
          width={size}
          height={size}
          role="img"
          aria-label={`Cycle progress ${pct}%, day ${unit.dayOfIncubation} of ${mode.incubationDays}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={BORDER}
            strokeWidth={width}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={width}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="tracking-tight font-bold text-sm md:text-base"
            style={{
              fontFamily: "var(--font-display)",
              color: stroke,
              lineHeight: "var(--leading-tight)",
            }}
          >
            {pct}%
          </span>
        </div>
      </div>
    </button>
  );
}

export function OverviewScreen({
  units,
  modes,
  onOpenUnit,
  onManageAll,
}: Props) {
  const modeOf = useCallback(
    (id: string) => modes.find((m) => m.id === id) ?? modes[0],
    [modes],
  );
  const [carouselPage, setCarouselPage] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const page = Math.round(el.scrollLeft / el.clientWidth);
    setCarouselPage(page);
  };
  const [conditionTab, setConditionTab] = useState<"temp" | "humidity">("temp");
  const conditionCarouselRef = useRef<HTMLDivElement>(null);
  const selectConditionTab = (tab: "temp" | "humidity") => {
    setConditionTab(tab);
    const el = conditionCarouselRef.current;
    if (!el) return;
    el.scrollTo({
      left: (tab === "humidity" ? 1 : 0) * el.clientWidth,
      behavior: "smooth",
    });
  };
  const handleConditionCarouselScroll = () => {
    const el = conditionCarouselRef.current;
    if (!el || el.clientWidth === 0) return;
    const page = Math.round(el.scrollLeft / el.clientWidth);
    setConditionTab(page > 0 ? "humidity" : "temp");
  };
  const stats = useMemo(() => {
    const count = (s: UnitStatus) => units.filter((u) => u.status === s).length;
    const connected = units.filter(
      (u) => u.paired && u.connectionState === "connected",
    ).length;
    const totalEggs = units.reduce((s, u) => s + (u.totalEggsLoaded ?? 0), 0);
    const modesInUse = Array.from(
      new Set(units.map((u) => modeOf(u.modeId).name)),
    );

    // Chamber closest to hatching (fewest days remaining).
    const withRemaining = units
      .map((u) => {
        const m = modeOf(u.modeId);
        return { u, m, remaining: m.incubationDays - u.dayOfIncubation };
      })
      .sort((a, b) => a.remaining - b.remaining);
    const nextHatch = withRemaining[0];

    return {
      optimal: count("optimal"),
      warning: count("warning"),
      alert: count("alert"),
      needsAttention: units.filter((u) => u.status !== "optimal").length,
      connected,
      totalEggs,
      modesInUse,
      nextHatch,
    };
  }, [units, modeOf]);

  // Priority action items, drawn from real chamber issues (alerts first).
  // Overview shows only the 4 highest-priority incubators (Alert → Attention → Optimal).
  const priorityUnits = useMemo(() => {
    const rank = { alert: 0, warning: 1, optimal: 2 } as const;
    return [...units]
      .sort((a, b) => rank[a.status] - rank[b.status])
      .slice(0, 4);
  }, [units]);

  // Most off-target by deviation from mode target (not absolute value) — only off-target shown
  const offTarget = useMemo(() => {
    const tempEntries: OffTargetEntry[] = units
      .map((u) => {
        const m = modeOf(u.modeId);
        const off = getTempOff(u, m);
        return { unit: u, mode: m, ...off } as OffTargetEntry;
      })
      .sort((a, b) => b.dev - a.dev)
      .filter((e) => e.dev > 0.005)
      .slice(0, 3);

    const humidityEntries: OffTargetEntry[] = units
      .map((u) => {
        const m = modeOf(u.modeId);
        const off = getHumidityOff(u, m);
        return { unit: u, mode: m, ...off } as OffTargetEntry;
      })
      .sort((a, b) => b.dev - a.dev)
      .filter((e) => e.dev > 0.005)
      .slice(0, 3);

    return { temp: tempEntries, humidity: humidityEntries };
  }, [units, modeOf]);

  const nextRemaining = stats.nextHatch?.remaining ?? 0;
  const hatchValue =
    nextRemaining <= 0
      ? "Now"
      : nextRemaining === 1
        ? "~24 Hours"
        : `${nextRemaining} Days`;

  const idleCount = units.filter(
    (u) => u.cyclePhase === "ready" || !u.paired,
  ).length;
  const activeCount = units.length - idleCount;
  const incubatorsFooter: KpiFooter =
    idleCount === 0
      ? {
          primary: "All incubators are running",
          secondary: "Efficiency to the max!",
        }
      : idleCount === 1
        ? { primary: "1 idle", secondary: `${activeCount} running` }
        : { primary: `${idleCount} idle`, secondary: `${activeCount} running` };
  const eggsFooter: KpiFooter = { primary: `Across ${units.length} chambers` };
  const upcomingFooter: KpiFooter | undefined = (() => {
    if (!stats.nextHatch) return undefined;
    const chamberName = stats.nextHatch.u.name;
    const modeName = stats.nextHatch.m.name;
    if (nextRemaining <= 0)
      return {
        primary: chamberName,
        secondary: modeName,
        tertiary: "check chamber",
      };
    if (nextRemaining === 1)
      return { primary: "Due tomorrow", secondary: `${modeName}` };
    return { primary: `In ${nextRemaining} days`, secondary: `${modeName}` };
  })();
  const needsAttentionFooter: KpiFooter | undefined = (() => {
    if (stats.needsAttention === 0)
      return { primary: "No issues", secondary: "All optimal" };
    const top = priorityUnits[0];
    return {
      primary: top ? top.name : `${stats.needsAttention} chambers`,
      secondary: "Need a look",
    };
  })();

  return (
    <div className="flex flex-col gap-2 md:gap-8">
      {/* Section 2: executive KPI summary — strict 1-row compact cards */}
      <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
        {/* Layers reads as stacked multi-tier incubator cabinets. */}
        <KpiCard
          Icon={Layers}
          label="INCUBATORS"
          value={`${units.length} Active`}
          footer={incubatorsFooter}
        />
        <KpiCard
          Icon={Egg}
          label="EGGS INCUBATING"
          value={`${stats.totalEggs} Eggs`}
          footer={eggsFooter}
        />
        <KpiCard
          Icon={Clock}
          label="UPCOMING HATCH"
          value={hatchValue}
          footer={upcomingFooter}
        />
        <KpiCard
          Icon={TriangleAlert}
          label="NEEDS ATTENTION"
          value={`${stats.needsAttention}`}
          footer={needsAttentionFooter}
        />
      </div>

      {/* Section 3: chamber status grid, wrapped in one white container */}
      <section
        className="rounded-2xl border p-3 md:p-6"
        style={{
          backgroundColor: "var(--surface-card)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2
              className="text-(length:--type-heading-sm) lg:text-(length:--type-heading-md)"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: "var(--weight-semibold)",
                lineHeight: "var(--leading-snug)",
                color: HEADING,
              }}
            >
              Active Incubators
            </h2>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-regular)",
                lineHeight: "var(--leading-normal)",
                color: "var(--text-farm)",
                marginTop: 2,
              }}
            >
              Chambers currently running.
            </p>
          </div>
          <button
            type="button"
            onClick={onManageAll}
            className="inline-flex min-h-[var(--overview-action-height-mobile)] shrink-0 cursor-pointer items-center gap-0.5 rounded-xl border bg-[var(--surface-card)] px-1.5 py-0.5 text-(length:--type-body-sm) font-semibold transition-colors duration-200 hover:bg-[var(--nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:min-h-11 md:px-4 md:py-2 md:text-sm"
            style={{ borderColor: RUST, color: RUST }}
            aria-label="View all incubators"
          >
            <span className="md:hidden">View all →</span>
            <span className="hidden md:inline">View All Incubators</span>
          </button>
        </div>
        <div
          className="my-3 h-px w-full sm:my-4"
          style={{ backgroundColor: "var(--border-sand)" }}
        />
        <div
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:pb-0 lg:grid-cols-4"
        >
          {priorityUnits.map((u) => (
            <div
              key={u.id}
              className="w-[calc((100%-10px)/2)] shrink-0 snap-start md:w-auto md:shrink md:snap-none"
            >
              <MiniCard unit={u} mode={modeOf(u.modeId)} onOpen={onOpenUnit} />
            </div>
          ))}
        </div>
        {priorityUnits.length > 2 && (
          <div className="mt-3 flex justify-center gap-1.5 md:hidden">
            {Array.from(
              { length: Math.ceil(priorityUnits.length / 2) },
              (_, i) => i,
            ).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => {
                  if (!carouselRef.current) return;
                  carouselRef.current.scrollTo({
                    left: page * carouselRef.current.clientWidth,
                    behavior: "smooth",
                  });
                  setCarouselPage(page);
                }}
                className="h-1.5 cursor-pointer rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
                aria-current={carouselPage === page ? "true" : undefined}
                aria-label={`Go to slide ${page + 1}`}
                style={{
                  width:
                    carouselPage === page
                      ? "var(--dot-width-current)"
                      : "var(--dot-size)",
                  backgroundColor:
                    carouselPage === page ? RUST : "var(--dot-idle)",
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 4: Conditions to Check — 1 container, 2 columns on desktop, tabs on mobile */}
      <section
        className="rounded-2xl border p-4 md:p-6"
        style={{
          backgroundColor: "var(--surface-card)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <h2
            className="text-(length:--type-heading-sm) lg:text-(length:--type-heading-md)"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: "var(--weight-semibold)",
              lineHeight: "var(--leading-snug)",
              color: HEADING,
            }}
          >
            Conditions to Check
          </h2>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-regular)",
              lineHeight: "var(--leading-normal)",
              color: "var(--text-farm)",
              marginTop: 2,
            }}
          >
            Incubators with temperature or humidity concerns.
          </p>
        </div>
        <div
          className="mb-4 h-px w-full"
          style={{ backgroundColor: "var(--border-sand)" }}
        />

        {/* Mobile toggle between Temperature and Humidity */}
        <fieldset
          className="mb-4 flex h-[var(--control-segment-height)] rounded-full border p-0 lg:hidden"
          style={{
            backgroundColor: "var(--surface-muted)",
            borderColor: "var(--border-subtle)",
          }}
          aria-label="Condition type to display"
        >
          <button
            type="button"
            onClick={() => selectConditionTab("temp")}
            aria-pressed={conditionTab === "temp"}
            aria-controls="condition-temp-panel"
            aria-label={`Temperature, ${offTarget.temp.length} need attention`}
            className="flex h-full min-h-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-0 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
            style={{
              backgroundColor:
                conditionTab === "temp" ? "var(--surface-card)" : "transparent",
              color:
                conditionTab === "temp"
                  ? "var(--brand-primary)"
                  : "var(--text-secondary)",
              boxShadow:
                conditionTab === "temp" ? "var(--shadow-lift)" : "none",
            }}
          >
            <Thermometer size={14} className="shrink-0" aria-hidden="true" />
            <span>Temperature</span>
            {offTarget.temp.length > 0 && (
              // Count duplicates the button's aria-label; 11px label minimum.
              <span
                className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-(length:--type-label) font-bold"
                style={{
                  backgroundColor:
                    conditionTab === "temp"
                      ? "var(--brand-primary)"
                      : "var(--surface-stone)",
                  color:
                    conditionTab === "temp"
                      ? "var(--on-brand)"
                      : "var(--text-farm)",
                }}
              >
                {offTarget.temp.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => selectConditionTab("humidity")}
            aria-pressed={conditionTab === "humidity"}
            aria-controls="condition-humidity-panel"
            aria-label={`Humidity, ${offTarget.humidity.length} need attention`}
            className="flex h-full min-h-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-0 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
            style={{
              backgroundColor:
                conditionTab === "humidity"
                  ? "var(--surface-card)"
                  : "transparent",
              color:
                conditionTab === "humidity"
                  ? "var(--brand-primary)"
                  : "var(--text-secondary)",
              boxShadow:
                conditionTab === "humidity" ? "var(--shadow-lift)" : "none",
            }}
          >
            <Droplets size={14} className="shrink-0" aria-hidden="true" />
            <span>Humidity</span>
            {offTarget.humidity.length > 0 && (
              // Count duplicates the button's aria-label; 11px label minimum.
              <span
                className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-(length:--type-label) font-bold"
                style={{
                  backgroundColor:
                    conditionTab === "humidity"
                      ? "var(--brand-primary)"
                      : "var(--surface-stone)",
                  color:
                    conditionTab === "humidity"
                      ? "var(--on-brand)"
                      : "var(--text-farm)",
                }}
              >
                {offTarget.humidity.length}
              </span>
            )}
          </button>
        </fieldset>

        <div
          ref={conditionCarouselRef}
          onScroll={handleConditionCarouselScroll}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scrollbar-none lg:grid lg:grid-cols-2 lg:gap-6 lg:overflow-visible"
        >
          {/* Column 1: temperature */}
          <div
            id="condition-temp-panel"
            className="min-w-full shrink-0 snap-start lg:min-w-0 lg:shrink"
          >
            <div className="mb-3 hidden lg:block">
              <h3
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-body-sm)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-normal)",
                  color: TEXT,
                }}
              >
                Temperature
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {offTarget.temp.length === 0 ? (
                <div
                  className="flex items-center gap-2 rounded-xl border px-3 py-4"
                  style={{
                    borderColor: BORDER,
                    backgroundColor: "var(--surface-page)",
                  }}
                >
                  <Check
                    size={16}
                    style={{ color: "var(--status-success-fg)" }}
                  />
                  <span
                    className="text-(length:--type-caption) lg:text-(length:--type-body-sm)"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: "var(--weight-medium)",
                      lineHeight: "var(--leading-normal)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    All temperatures within target
                  </span>
                </div>
              ) : (
                offTarget.temp.map((entry, idx) => (
                  <OffTargetRow
                    key={entry.unit.id}
                    entry={entry}
                    kind="temp"
                    rank={idx + 1}
                    onOpen={onOpenUnit}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 2: humidity */}
          <div
            id="condition-humidity-panel"
            className="min-w-full shrink-0 snap-start lg:min-w-0 lg:shrink"
          >
            <div className="mb-3 hidden lg:block">
              <h3
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-body-sm)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-normal)",
                  color: TEXT,
                }}
              >
                Humidity
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {offTarget.humidity.length === 0 ? (
                <div
                  className="flex items-center gap-2 rounded-xl border px-3 py-4"
                  style={{
                    borderColor: BORDER,
                    backgroundColor: "var(--surface-page)",
                  }}
                >
                  <Check
                    size={16}
                    style={{ color: "var(--status-success-fg)" }}
                  />
                  <span
                    className="text-(length:--type-caption) lg:text-(length:--type-body-sm)"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: "var(--weight-medium)",
                      lineHeight: "var(--leading-normal)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    All humidity levels within target
                  </span>
                </div>
              ) : (
                offTarget.humidity.map((entry, idx) => (
                  <OffTargetRow
                    key={entry.unit.id}
                    entry={entry}
                    kind="humidity"
                    rank={idx + 1}
                    onOpen={onOpenUnit}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
