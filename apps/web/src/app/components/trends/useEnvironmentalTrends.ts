import { useCallback, useMemo, useState } from "react";
import type { Incubator, Mode } from "../../domain/types";
import { resolvedTelemetryStatus } from "../../features/farm/telemetry";
import { useIncubatorReadingMap } from "../../features/farm/use-incubator-readings";
import { mergeChartReadings } from "../../features/trends/chart-data";
import {
  dedupeTickLabels,
  formatXTick,
  pickTimeTicks,
} from "../../features/trends/chart-ticks";
import { useIsMobile } from "../ui/use-mobile";

import {
  CHAMBER_COLORS,
  type Metric,
  metricInfo,
  type RangeKey,
  RUST,
  type TooltipMeta,
} from "./presentation";

export function useEnvironmentalTrends(
  units: Incubator[],
  modes: Mode[],
  initialUnitId?: string,
) {
  const [unitId, setUnitId] = useState(initialUnitId ?? units[0]?.id ?? "");
  const [range, setRange] = useState<RangeKey>("24h");
  const [readingsOpen, setReadingsOpen] = useState(false);
  // Narrow-viewport chart treatment (tick density, y gutter, tooltip pill).
  const isMobile = useIsMobile();

  // Compare mode state.
  const [compare, setCompare] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>(
    units.slice(0, 2).map((u) => u.id),
  );
  const [metric, setMetric] = useState<Metric>("temp");
  const [highlightedUnitId, setHighlightedUnitId] = useState<string | null>(
    null,
  );

  const unit = units.find((u) => u.id === unitId) ?? units[0];
  const modeOf = useCallback(
    (u: Incubator) => modes.find((m) => m.id === u.modeId) ?? modes[0],
    [modes],
  );

  // The active set of chambers to chart (single selection, or the compare set).
  const activeUnits = useMemo<Incubator[]>(() => {
    if (!compare) return unit ? [unit] : [];
    return Array.from(new Set(compareIds))
      .map((id) => units.find((u) => u.id === id))
      .filter(Boolean) as Incubator[];
  }, [compare, compareIds, unit, units]);
  const activeHighlightedUnitId = activeUnits.some(
    (u) => u.id === highlightedUnitId,
  )
    ? highlightedUnitId
    : null;
  const readingUnitIds = useMemo(
    () =>
      Array.from(
        new Set([...activeUnits.map((activeUnit) => activeUnit.id), unit.id]),
      ),
    [activeUnits, unit.id],
  );
  const {
    readingsByIncubator,
    isLoading: readingsLoading,
    error: readingsError,
    retry: retryReadings,
  } = useIncubatorReadingMap(readingUnitIds, range);
  const activeReadingCount = activeUnits.reduce(
    (total, activeUnit) =>
      total + (readingsByIncubator[activeUnit.id]?.length ?? 0),
    0,
  );
  const staleTelemetryUnits = activeUnits.filter(
    (activeUnit) => resolvedTelemetryStatus(activeUnit) !== "fresh",
  );

  // Merge each active chamber's readings for the chosen metric onto a shared axis.
  const chartData = useMemo(
    () =>
      mergeChartReadings(
        activeUnits.map((u) => u.id),
        readingsByIncubator,
        metric,
      ),
    [activeUnits, metric, readingsByIncubator],
  );
  const chartSeriesByUnit = useMemo(
    () =>
      Object.fromEntries(
        activeUnits.map((u) => [
          u.id,
          mergeChartReadings([u.id], readingsByIncubator, metric),
        ]),
      ),
    [activeUnits, readingsByIncubator, metric],
  );
  const readingGroups = compare ? activeUnits : [unit];

  // Unique safe bands across the active chambers, so we can shade the target zone.
  const bands = useMemo(() => {
    const seen = new Map<string, { min: number; max: number }>();
    activeUnits.forEach((u) => {
      const band =
        metric === "temp" ? modeOf(u).targetTemp : modeOf(u).targetHumidity;
      seen.set(`${band.min}-${band.max}`, band);
    });
    return Array.from(seen.values());
  }, [activeUnits, metric, modeOf]);

  // Auto-scale the y-axis to fit all active values plus each safe band.
  const domain = useMemo<[number, number]>(() => {
    let min = Infinity;
    let max = -Infinity;
    chartData.forEach((row) => {
      activeUnits.forEach((u) => {
        const values = row[`${u.id}_range`];
        if (Array.isArray(values))
          for (const v of values) {
            if (v < min) min = v;
            if (v > max) max = v;
          }
      });
    });
    bands.forEach((b) => {
      if (b.min < min) min = b.min;
      if (b.max > max) max = b.max;
    });
    if (!Number.isFinite(min) || !Number.isFinite(max))
      return metricInfo[metric].domain;
    const pad = metric === "temp" ? 0.5 : 3;
    return [
      Math.floor((min - pad) * 10) / 10,
      Math.ceil((max + pad) * 10) / 10,
    ];
  }, [chartData, activeUnits, bands, metric]);

  // Explicit x ticks (5 on all viewports) so axis labels are deterministic.
  // Five ticks over 24h land ~6h apart, which reads as a progression
  // (4 PM → 10 PM → 4 AM …); three ticks land ~12h apart so both ends read
  // the same wall time with one midpoint — it looks like a broken axis.
  // Hour labels are short enough (~40px at 11px) to fit five across a phone.
  const xTickValues = useMemo(
    () =>
      pickTimeTicks(
        chartData.map((row) => row.ts),
        5,
      ),
    [chartData],
  );
  const xTickLabels = useMemo(
    () => dedupeTickLabels(xTickValues.map((ts) => formatXTick(ts, range))),
    [xTickValues, range],
  );
  const ySpan = domain[1] - domain[0];

  const colorFor = (id: string) =>
    compare
      ? CHAMBER_COLORS[compareIds.indexOf(id) % CHAMBER_COLORS.length]
      : RUST;

  // Mode + safe band per series, consumed by the hover tooltip.
  const tooltipMeta = useMemo(() => {
    const map: Record<string, TooltipMeta> = {};
    activeUnits.forEach((u) => {
      const m = modeOf(u);
      map[u.id] = {
        band: metric === "temp" ? m.targetTemp : m.targetHumidity,
        metricLabel: metricInfo[metric].label,
      };
    });
    return map;
  }, [activeUnits, metric, modeOf]);

  // One target-range label when every active chamber shares a band, otherwise a hint.
  // Short forms fit the one-line header slot beside the metric toggle (~25 chars
  // at caption/10px); full text stays on `title` as a supplement.
  const targetRangeLabel =
    bands.length === 1
      ? `Target Safe Range is ${bands[0].min} to ${bands[0].max}${metricInfo[metric].unit}`
      : "Target Safe Range varies by incubation mode";
  const targetRangeShort =
    bands.length === 1
      ? `Safe range ${bands[0].min} to ${bands[0].max}${metricInfo[metric].unit}`
      : "Varies by incubation mode";
  // Never allow the selection to drop below two chambers — that would blank the chart.

  const toggleCompareId = (id: string) =>
    setCompareIds((prev) => {
      if (!prev.includes(id)) return [...prev, id];
      if (prev.length <= 2) return prev;
      return prev.filter((x) => x !== id);
    });

  // Turning compare on always starts from a valid two-chamber selection.
  const handleCompareChange = (on: boolean) => {
    if (on && compareIds.length < 2) {
      setCompareIds(units.slice(0, 2).map((u) => u.id));
    }
    setCompare(on);
  };

  return {
    unitId,
    setUnitId,
    range,
    setRange,
    readingsOpen,
    setReadingsOpen,
    isMobile,
    compare,
    compareIds,
    metric,
    setMetric,
    setHighlightedUnitId,
    activeUnits,
    activeHighlightedUnitId,
    readingsLoading,
    readingsError,
    retryReadings,
    activeReadingCount,
    staleTelemetryUnits,
    chartData,
    chartSeriesByUnit,
    readingGroups,
    bands,
    domain,
    xTickValues,
    xTickLabels,
    ySpan,
    colorFor,
    tooltipMeta,
    targetRangeLabel,
    targetRangeShort,
    toggleCompareId,
    handleCompareChange,
  };
}
