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
import { EnvironmentalTrends } from "../trends/EnvironmentalTrends";
import { HatchHistory } from "../trends/HatchHistory";
import { BORDER, type TrendView, WARN, WARN_BG } from "../trends/presentation";
import { useEnvironmentalTrends } from "../trends/useEnvironmentalTrends";
import { useHatchHistory } from "../trends/useHatchHistory";
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
  const {
    staleTelemetryUnits,
    readingsOpen,
    setReadingsOpen,
    range,
    readingGroups,
  } = environmental;
  const viewOptions: {
    key: TrendView;
    label: string;
  }[] = [
    { key: "environmental", label: "Environmental Trends" },
    { key: "hatch", label: "Hatch History" },
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
            aria-label="Trend view"
            className="w-full md:w-auto"
          >
            {viewOptions.map(({ key, label }) => {
              const active = trendView === key;
              return (
                <SegmentedControlItem
                  key={key}
                  flush
                  active={active}
                  className="min-w-0 flex-1 px-3 md:flex-none md:px-4"
                  aria-pressed={active}
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
                  {label}
                </SegmentedControlItem>
              );
            })}
          </SegmentedControl>
        </div>
      </div>

      {trendView === "environmental" ? (
        <EnvironmentalTrends model={environmental} units={units} />
      ) : (
        <HatchHistory
          model={historyModel}
          historyStatus={historyStatus}
          isMobile={environmental.isMobile}
        />
      )}

      {readingsOpen && (
        <RawReadingsDialog
          key={`${range}:${readingGroups.map((u) => u.id).join(",")}`}
          ids={readingGroups.map((u) => u.id)}
          window={range}
          onClose={() => setReadingsOpen(false)}
        />
      )}
    </div>
  );
}
