import { CheckFat as Check } from "@phosphor-icons/react";
import { ChevronRight } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { AlertEntry, Incubator, Mode } from "../../domain/types";
import { resolvedTelemetryStatus } from "../../features/farm/telemetry";
import { ActiveIncubatorCard } from "../ActiveIncubatorCard";
import { OverviewSummary } from "../OverviewSummary";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../ui/segmented-control";

interface Props {
  units: Incubator[];
  modes: Mode[];
  alerts?: AlertEntry[];
  onOpenUnit: (id: string) => void;
  onManageAll: () => void;
}

// ── Design tokens ───────────────────────────────────────────────────────────
const RUST = "var(--brand-primary)";
const BORDER = "var(--border-default)";
const TEXT = "var(--text-primary)";
const HEADING = "var(--text-primary)";

const conditionRowStyle = `
.condition-row{position:relative;background:var(--surface-card);border:var(--border-width-hairline) solid var(--border-default);border-radius:12px;transition:background-color 0.2s ease-in-out, border-color 0.2s ease-in-out}
.condition-row:hover{background:var(--nav-hover-bg);border-color:var(--nav-hover-border)}
`;

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
              border: `var(--border-width-hairline) solid ${isOff ? (isUrgent ? "var(--border-blush)" : "var(--border-peach)") : "var(--border-mint)"}`,
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

export function OverviewScreen({
  units,
  modes,
  alerts = [],
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
    el.scrollTo?.({
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
    const connected = units.filter(
      (u) => resolvedTelemetryStatus(u) === "fresh",
    ).length;
    const totalEggs = units.reduce((s, u) => s + (u.totalEggsLoaded ?? 0), 0);
    const modesInUse = Array.from(
      new Set(units.map((u) => modeOf(u.modeId).name)),
    );

    // Chamber closest to hatching (fewest days remaining).
    const withRemaining = units
      .filter((unit) => unit.paired && unit.cyclePhase !== "ready")
      .map((u) => {
        const m = modeOf(u.modeId);
        return { u, m, remaining: m.incubationDays - u.dayOfIncubation };
      })
      .sort((a, b) => a.remaining - b.remaining);
    const nextHatch = withRemaining[0];

    return {
      needsAttention: units.filter((u) => u.status !== "optimal").length,
      connected,
      totalEggs,
      modesInUse,
      nextHatch,
    };
  }, [units, modeOf]);

  // Action items for Needs Attention KPI (alerts and warnings first)
  const attentionUnits = useMemo(() => {
    const rank = { alert: 0, warning: 1, optimal: 2 } as const;
    return [...units].sort((a, b) => rank[a.status] - rank[b.status]);
  }, [units]);

  // Active chambers nearest to completing their incubation cycle (highest progress percentage first)
  const priorityUnits = useMemo(() => {
    const running = units.filter((u) => u.cyclePhase !== "ready" && u.paired);
    const candidateUnits = running.length > 0 ? running : units;
    return candidateUnits
      .map((u) => {
        const m = modeOf(u.modeId);
        const pct =
          m.incubationDays > 0
            ? (u.dayOfIncubation / m.incubationDays) * 100
            : 0;
        const daysRemaining = Math.max(0, m.incubationDays - u.dayOfIncubation);
        return { unit: u, pct, daysRemaining };
      })
      .sort((a, b) => b.pct - a.pct || a.daysRemaining - b.daysRemaining)
      .map((item) => item.unit)
      .slice(0, 4);
  }, [units, modeOf]);

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
  const offlineCount = units.filter(
    (unit) => resolvedTelemetryStatus(unit) === "offline",
  ).length;
  const hatchesDue = units.filter(
    (unit) =>
      unit.paired &&
      unit.cyclePhase !== "ready" &&
      unit.dayOfIncubation >= modeOf(unit.modeId).incubationDays,
  ).length;
  const unreadAlerts = alerts.filter((alert) => !alert.acknowledged);
  const startChecks = () => {
    const due = units.find(
      (unit) =>
        unit.paired &&
        unit.cyclePhase !== "ready" &&
        unit.dayOfIncubation >= modeOf(unit.modeId).incubationDays,
    );
    const first =
      due ?? attentionUnits.find((unit) => unit.status !== "optimal");
    if (first) onOpenUnit(first.id);
    else onManageAll();
  };

  return (
    <div className="flex flex-col gap-2 md:gap-8">
      <OverviewSummary
        incubators={units.length}
        running={activeCount}
        idle={idleCount}
        eggs={stats.totalEggs}
        needsAttention={stats.needsAttention}
        hatchesDue={hatchesDue}
        offline={offlineCount}
        nextHatch={stats.nextHatch ? hatchValue : "—"}
        nextChamber={stats.nextHatch?.u.name}
        alerts={unreadAlerts.length}
        criticalAlerts={
          unreadAlerts.filter((alert) => alert.severity === "critical").length
        }
        onStartChecks={startChecks}
      />

      {/* Section 3: chamber status grid, wrapped in one white container */}
      <section
        aria-labelledby="active-incubators-title"
        className="rounded-2xl border p-3 md:p-6"
        style={{
          backgroundColor: "var(--surface-card)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex h-[var(--control-height-mobile)] items-center justify-between gap-3 md:h-[var(--control-height-default)]">
          <div className="flex h-full min-w-0 flex-col justify-center">
            <h2
              id="active-incubators-title"
              className="text-(length:--type-heading-sm) leading-snug md:leading-5 lg:text-(length:--type-heading-md)"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: "var(--weight-semibold)",
                color: HEADING,
              }}
            >
              Active Incubators
            </h2>
            <p
              className="mt-0 leading-normal md:leading-4"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-regular)",
                color: "var(--text-farm)",
              }}
            >
              Chambers currently running.
            </p>
          </div>
          <button
            type="button"
            onClick={onManageAll}
            className="inline-flex h-[var(--control-height-mobile)] max-h-[var(--control-height-mobile)] shrink-0 cursor-pointer items-center gap-2 rounded-xl border bg-[var(--surface-card)] px-2.5 py-0 text-(length:--type-button-label) font-semibold transition-colors duration-200 hover:bg-[var(--nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:h-[var(--control-height-default)] md:max-h-[var(--control-height-default)] md:px-4"
            style={{
              borderColor: RUST,
              color: RUST,
              lineHeight: "var(--leading-button)",
            }}
            aria-label="View all incubators"
          >
            <span className="md:hidden">View all</span>
            <span className="hidden md:inline">View All Incubators</span>
            <ChevronRight size={16} aria-hidden="true" />
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
              <ActiveIncubatorCard
                unit={u}
                mode={modeOf(u.modeId)}
                onOpen={onOpenUnit}
              />
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
          <div className="flex h-[var(--control-height-mobile)] flex-col justify-center md:h-[var(--control-height-default)]">
            <h2
              id="conditions-to-check-title"
              className="text-(length:--type-heading-sm) leading-snug md:leading-5 lg:text-(length:--type-heading-md)"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: "var(--weight-semibold)",
                color: HEADING,
              }}
            >
              Conditions to Check
            </h2>
            <p
              className="mt-0 leading-normal md:leading-4"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-regular)",
                color: "var(--text-farm)",
              }}
            >
              Incubators with temperature or humidity concerns.
            </p>
          </div>
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
                    weight="fill"
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
                    weight="fill"
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
        <div className="mt-3 flex justify-center gap-1.5 lg:hidden">
          {[
            {
              key: "temp",
              label: "Show temperature conditions",
              tab: "temp" as const,
            },
            {
              key: "humidity",
              label: "Show humidity conditions",
              tab: "humidity" as const,
            },
          ].map(({ key, label, tab }) => (
            <button
              key={key}
              type="button"
              onClick={() => selectConditionTab(tab)}
              className="h-1.5 cursor-pointer rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 motion-reduce:transition-none"
              aria-current={conditionTab === tab ? "true" : undefined}
              aria-label={label}
              style={{
                width:
                  conditionTab === tab
                    ? "var(--dot-width-current)"
                    : "var(--dot-size)",
                backgroundColor:
                  conditionTab === tab ? RUST : "var(--dot-idle)",
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
