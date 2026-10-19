import { BenchmarkHistory } from "../trends/BenchmarkHistory";
import type { ReactNode } from "react";
import { useState } from "react";
import type { HatchRecord, Incubator, Mode } from "../../domain/types";
import type { FeatureQueryState } from "../../features/farm/query-state";
import {
  resolvedTelemetryStatus,
  telemetryReceiptTimestamp,
  telemetryStatusLabel,
} from "../../features/farm/telemetry";
import { RawReadingsDialog } from "../RawReadingsDialog";
import { EmptyState } from "../EmptyState";
import { Button } from "../ui/button";
import { EnvironmentalTrends } from "../trends/EnvironmentalTrends";
import { HatchHistory } from "../trends/HatchHistory";
import { BORDER, type TrendView, WARN, WARN_BG } from "../trends/presentation";
import { useEnvironmentalTrends } from "../trends/useEnvironmentalTrends";
import { useHatchHistory } from "../trends/useHatchHistory";
import { IncubationRunHistory, useRunHistory } from "../trends/IncubationRunHistory";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../ui/segmented-control";

interface Props {
  units: Incubator[];
  modes: Mode[];
  history: HatchRecord[];
  historyStatus?: FeatureQueryState;
  initialUnitId?: string;
  /** Shell page header rendered inside the sticky toolbar (trends route). */
  header?: ReactNode;
}

export function TrendsScreen({
  units,
  modes,
  history,
  historyStatus,
  initialUnitId,
  header,
}: Props) {
  const [trendView, setTrendView] = useState<TrendView>("environmental");
  // Keep both models mounted so tab switches preserve selections and queries.
  const environmental = useEnvironmentalTrends(units, modes, initialUnitId);
  const historyModel = useHatchHistory(history);
  const runHistory = useRunHistory();
  const {
    staleTelemetryUnits,
    readingsOpen,
    setReadingsOpen,
    range,
    readingWindow,
    customBounds,
    selectedRun,
    readingGroups,
  } = environmental;
  const viewOptions: {
    key: TrendView;
    label: string;
    mobileLabel: string;
  }[] = [
    { key: "environmental", label: "Environmental Trends", mobileLabel: "Environment" },
    { key: "runs", label: "Incubation History", mobileLabel: "Cycles" },
    { key: "benchmarks", label: "Benchmarks", mobileLabel: "Tests" },
    { key: "hatch", label: "Hatch History", mobileLabel: "Hatches" },
  ];
  return (
    <div className="space-y-2 md:space-y-6">
      {/* Sticky toolbar: page header + view tabs stay fixed while charts scroll underneath. */}
      <div
        className="sticky top-0 z-30 flex flex-col gap-2 md:gap-3"
        style={{
          backgroundColor: "var(--surface-app)",
          paddingBottom: 4,
          paddingTop: 24,
        }}
      >
        {header}
        {staleTelemetryUnits.length > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-20 items-center gap-4 rounded-2xl border p-4 shadow-sm"
            style={{
              backgroundColor: WARN_BG,
              borderColor: BORDER,
            }}
          >
            <span
              aria-hidden="true"
              className="w-1.5 shrink-0 self-stretch rounded-full"
              style={{ backgroundColor: WARN }}
            />
            <div className="min-w-0 flex-1">
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--type-body-sm)",
                  fontWeight: "var(--weight-extrabold)",
                  lineHeight: "var(--leading-snug)",
                  color: WARN,
                }}
              >
                Readings are not latest
              </p>
              <p
                style={{
                  fontSize: "var(--type-filter-label)",
                  lineHeight: "var(--leading-normal)",
                  color: WARN,
                  marginTop: 2,
                }}
              >
                {staleTelemetryUnits
                  .map((activeUnit) => {
                    const status = resolvedTelemetryStatus(activeUnit);
                    return `${activeUnit.name} (${telemetryStatusLabel(
                      status,
                      telemetryReceiptTimestamp(activeUnit),
                    )})`;
                  })
                  .join(", ")}
                . The chart shows historical readings.
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-start gap-4">
          <SegmentedControl
            flush
            role="tablist"
            aria-label="Trend view"
            className="w-full md:w-auto"
          >
            {viewOptions.map(({ key, label, mobileLabel }) => {
              const active = trendView === key;
              return (
                <SegmentedControlItem
                  key={key}
                  flush
                  active={active}
                  className="min-w-0 flex-1 px-3 md:flex-none md:px-4"
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onKeyDown={(event) => {
                    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                    event.preventDefault();
                    const index = viewOptions.findIndex((option) => option.key === key);
                    const next = event.key === "Home" ? 0 : event.key === "End" ? viewOptions.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + viewOptions.length) % viewOptions.length;
                    setTrendView(viewOptions[next].key);
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
                  }}
                  aria-label={label}
                  onClick={() => setTrendView(key)}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-filter-label)",
                    fontWeight: "var(--weight-bold)",
                    lineHeight: "var(--leading-snug)",
                    letterSpacing: "var(--tracking-label)",
                    textTransform: "uppercase",
                  }}
                >
                  <span className="md:hidden">{mobileLabel}</span>
                  <span className="hidden md:inline">{label}</span>
                </SegmentedControlItem>
              );
            })}
          </SegmentedControl>
        </div>
      </div>

      {trendView === "environmental" ? (
        units.length === 0 ? (
          <EmptyState
            size="page"
            title="No environmental readings yet"
            description="Add an incubator and connect its sensor to start collecting temperature and humidity readings."
            action={<Button asChild className="rounded-xl"><a href="/incubators">Add your first incubator</a></Button>}
          />
        ) : <EnvironmentalTrends model={environmental} units={units} />
      ) : trendView === "benchmarks" ? (<BenchmarkHistory units={units} />) : trendView === "runs" ? (
        <IncubationRunHistory model={runHistory} units={units} modes={modes} onView={(run) => { environmental.selectRun(run); setTrendView("environmental"); }} />
      ) : (
        <HatchHistory
          hasIncubators={units.length > 0}
          model={historyModel}
          historyStatus={historyStatus}
          isMobile={environmental.isMobile}
        />
      )}

      {readingsOpen && readingGroups.length > 0 && (
        <RawReadingsDialog
          key={`${selectedRun?.id}:${range}:${customBounds?.start}:${customBounds?.end}:${readingGroups.map((u) => u.id).join(",")}`}
          ids={readingGroups.map((u) => u.id)}
          window={readingWindow}
          bounds={range === "custom" ? customBounds ?? undefined : undefined}
          runId={selectedRun?.id}
          onClose={() => setReadingsOpen(false)}
        />
      )}
    </div>
  );
}
