import { Check, ChevronRight, Clock, Egg } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Incubator, Mode, UnitStatus } from "../../domain/types";
import { ExclamationIcon, IncubatorDeviceIcon } from "../icons";
import { KpiCard, type KpiFooter } from "../KpiCard";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../ui/segmented-control";

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
      <div className="condition-row group flex min-h-[var(--control-height-default)] w-full items-center justify-between gap-3 px-3 py-3 text-left md:min-h-0">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="w-1 shrink-0 self-stretch rounded-full"
            style={{ backgroundColor: statusColor }}
          />
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
          <button
            type="button"
            onClick={() => onOpen(unit.id)}
            aria-label={`Open details for ${unit.name}`}
            className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-action-hover)] hover:text-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 md:h-8 md:w-8"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
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
    <article
      aria-labelledby={`mini-card-${unit.id}`}
      className="group flex h-full w-full flex-col justify-between rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3 text-left transition-colors duration-200 hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] md:rounded-2xl md:p-4"
    >
      {/* Top-left header stack — name over mode over progress. */}
      <div className="relative w-full min-w-0 text-left">
        <div className="flex min-w-0 items-start pr-10">
          <h3
            id={`mini-card-${unit.id}`}
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
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onOpen(unit.id)}
          aria-label={`Open details for ${unit.name}`}
          className="absolute right-0 top-0 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-action-hover)] hover:text-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 md:h-8 md:w-8"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
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
    </article>
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
        {/* Same chamber-device glyph as the sidebar Incubators nav item. */}
        <KpiCard
          Icon={IncubatorDeviceIcon}
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
          Icon={ExclamationIcon}
          label="NEEDS ATTENTION"
          value={`${stats.needsAttention}`}
          footer={needsAttentionFooter}
        />
      </div>

      {/* Section 3: chamber status grid, wrapped in one white container */}
      <section
        aria-labelledby="active-incubators-title"
        className="rounded-2xl border p-3 md:p-6"
        style={{
          backgroundColor: "var(--surface-card)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="active-incubators-title"
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
        aria-labelledby="conditions-to-check-title"
        className="rounded-2xl border p-4 md:p-6"
        style={{
          backgroundColor: "var(--surface-card)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <h2
            id="conditions-to-check-title"
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
          className="mb-4 flex w-full min-w-0 border-0 p-0 lg:hidden"
          aria-label="Condition type to display"
        >
          <SegmentedControl flush className="w-full">
            <SegmentedControlItem
              flush
              active={conditionTab === "temp"}
              aria-pressed={conditionTab === "temp"}
              aria-controls="condition-temp-panel"
              aria-label={`Temperature, ${offTarget.temp.length} need attention`}
              onClick={() => selectConditionTab("temp")}
              className="min-w-0 flex-1"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-filter-label)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
                letterSpacing: "var(--tracking-label)",
                textTransform: "uppercase",
              }}
            >
              Temperature
            </SegmentedControlItem>
            <SegmentedControlItem
              flush
              active={conditionTab === "humidity"}
              aria-pressed={conditionTab === "humidity"}
              aria-controls="condition-humidity-panel"
              aria-label={`Humidity, ${offTarget.humidity.length} need attention`}
              onClick={() => selectConditionTab("humidity")}
              className="min-w-0 flex-1"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-filter-label)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
                letterSpacing: "var(--tracking-label)",
                textTransform: "uppercase",
              }}
            >
              Humidity
            </SegmentedControlItem>
          </SegmentedControl>
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
