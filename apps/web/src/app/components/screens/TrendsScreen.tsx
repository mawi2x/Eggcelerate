import {
  ChevronDown,
  Download,
  Layers,
  Percent,
  Search,
  TableProperties,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import type { ReadingWindow } from "../../data/repositories/repository";
import type { HatchRecord, Incubator, Mode, Reading } from "../../domain/types";
import {
  resolvedTelemetryStatus,
  telemetryReceiptTimestamp,
  telemetryStatusLabel,
} from "../../features/farm/telemetry";
import { useIncubatorReadingMap } from "../../features/farm/use-incubator-readings";
import {
  dedupeTickLabels,
  formatXTick,
  formatYTick,
  pickTimeTicks,
} from "../../features/trends/chart-ticks";
import {
  selectFilteredHatch,
  selectHatchKpis,
  selectHatchWithPct,
} from "../../features/trends/selectors";
import { KpiCard } from "../KpiCard";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { FilterBar } from "../ui/filter-bar";
import { Input } from "../ui/input";
import { PaginationBar } from "../ui/pagination-bar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { useIsMobile } from "../ui/use-mobile";
import { type ViewMode, ViewToggle } from "../ViewToggle";

// ── Design tokens ───────────────────────────────────────────────────────────
const RUST = "var(--brand-primary)";
const CARD = "var(--surface-subtle)";
const SURFACE = "var(--surface-card)";
const BORDER = "var(--border-default)";
const TEXT = "var(--text-primary)";
const MUTED = "var(--text-secondary)";
const OK = "var(--status-success-fg)";
const OK_BG = "var(--status-success-bg)";
const WARN = "var(--status-warning-fg)";
const WARN_BG = "var(--status-warning-bg)";
// Target-range band accent resolves from --chart-target-band (chart exception
// zone): recharts SVG fill takes an attribute, which cannot resolve var(),
// so the token is read once here instead of inlining hex.
const TARGET_BAND_COLOR = getComputedStyle(document.documentElement)
  .getPropertyValue("--chart-target-band")
  .trim();
const TARGET_BAND_OPACITY = 0.045;
const inputStyle = {
  borderColor: "var(--input-border)",
  backgroundColor: "var(--surface-tile)",
};
// Framed white control used inside the trends toolbar.
const toolbarInputStyle = {
  borderColor: "var(--input-border)",
  backgroundColor: SURFACE,
};
// One typographic voice for every control in the trends toolbar.
const CONTROL_FONT: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-body-sm)",
  fontWeight: "var(--weight-semibold)",
  lineHeight: "var(--leading-normal)",
};
const COMPARE_FONT: React.CSSProperties = {
  ...CONTROL_FONT,
  fontSize: "var(--type-filter-value)",
};

type RangeKey = ReadingWindow;
const ranges: { key: RangeKey; label: string; hours: number | null }[] = [
  { key: "24h", label: "LAST 24H", hours: 24 },
  { key: "7d", label: "LAST 7 DAYS", hours: 24 * 7 },
  { key: "full", label: "FULL CYCLE", hours: null },
];

type TrendView = "environmental" | "hatch";
type Metric = "temp" | "humidity";

// Chamber-identity series resolve from --chart-series-1..12 (theme.css chart
// exception zone): same attribute constraint as the target band above.
const CHAMBER_COLORS = Array.from({ length: 12 }, (_, i) =>
  getComputedStyle(document.documentElement)
    .getPropertyValue(`--chart-series-${i + 1}`)
    .trim(),
);

const metricInfo: Record<
  Metric,
  { label: string; unit: string; domain: [number, number] }
> = {
  temp: { label: "Temperature", unit: "°C", domain: [35, 40] },
  humidity: { label: "Humidity", unit: "%", domain: [40, 80] },
};

const HATCH_ROWS = 10;

interface Props {
  units: Incubator[];
  modes: Mode[];
  history: HatchRecord[];
  initialUnitId?: string;
  /** Shell page header rendered inside the sticky toolbar (trends route). */
  header?: ReactNode;
}

// Per-chamber context the tooltip needs to judge each reading.
interface TooltipMeta {
  band: { min: number; max: number };
  metricLabel: string;
}

function formatTooltipTime(timestamp: number) {
  const date = new Date(timestamp);
  const day = date.toLocaleDateString([], { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} at ${time}`;
}

function formatMeasurement(value: number, unit: string) {
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: unit === "°C" ? 1 : 0,
  })}${unit}`;
}

export function buildReadingsCsv(
  rows: { chamber: string; reading: Reading }[],
): string {
  const csvCell = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = "Chamber,Timestamp,Temperature (C),Humidity (%)";
  const records = rows.map(({ chamber, reading }) =>
    [
      chamber,
      new Date(reading.ts).toISOString(),
      reading.temp,
      reading.humidity,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header, ...records].join("\n");
}

function ChartTooltip({
  active,
  payload,
  unit,
  meta,
  highlightedId,
  compact = false,
  range = "24h",
}: {
  active?: boolean;
  payload?: {
    value?: unknown;
    dataKey?: string | number;
    color?: string;
    name?: string;
    payload?: { ts?: unknown };
  }[];
  unit: string;
  meta?: Record<string, TooltipMeta>;
  highlightedId?: string | null;
  /** Mobile value pill: value + timestamp only, pinned near the touch point. */
  compact?: boolean;
  range?: RangeKey;
}) {
  if (!active || !payload?.length) return null;

  const validPayload = payload.filter(
    (item): item is typeof item & { value: number } =>
      typeof item.value === "number",
  );
  const reading =
    validPayload.find((item) => item.dataKey === highlightedId) ??
    validPayload[0];
  if (!reading) return null;

  const info: TooltipMeta | undefined =
    typeof reading.dataKey === "string" ? meta?.[reading.dataKey] : undefined;
  const timestamp = reading.payload?.ts;

  // Mobile: minimal dark value pill pinned near the touch point (ref pattern).
  // Chamber name and target range already live in the card legend/subtitle.
  if (compact) {
    return (
      <div
        className="flex items-baseline gap-2 rounded-full px-3 py-1.5 shadow-lg"
        style={{
          backgroundColor: "var(--surface-tooltip)",
          color: "var(--on-brand)",
          fontFamily: "var(--font-body)",
        }}
      >
        <span
          style={{
            fontSize: "var(--type-body)",
            fontWeight: "var(--weight-bold)",
            lineHeight: "var(--leading-snug)",
          }}
        >
          {formatMeasurement(reading.value, unit)}
        </span>
        {typeof timestamp === "number" && (
          <span
            style={{
              fontSize: "var(--type-label)",
              fontWeight: "var(--weight-semibold)",
              letterSpacing: "var(--tracking-label)",
              color: "var(--text-on-dark-muted)",
            }}
          >
            {formatXTick(timestamp, range)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="min-w-[196px] rounded-xl border bg-[var(--surface-card)] p-3.5 shadow-lg"
      style={{
        borderColor: BORDER,
        color: TEXT,
        fontFamily: "var(--font-body)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-0.5 w-4 shrink-0 rounded-full"
          style={{ backgroundColor: reading.color }}
        />
        <p
          style={{
            fontSize: "var(--type-body-sm)",
            fontWeight: "var(--weight-bold)",
          }}
        >
          {reading.name}
        </p>
      </div>
      {typeof timestamp === "number" && (
        <p
          className="mt-0.5"
          style={{ color: MUTED, fontSize: "var(--type-caption)" }}
        >
          {formatTooltipTime(timestamp)}
        </p>
      )}
      <div
        className="mt-3 space-y-1.5 border-t pt-2.5"
        style={{ borderColor: BORDER }}
      >
        <div className="flex items-baseline justify-between gap-5">
          <span style={{ color: MUTED, fontSize: "var(--type-caption)" }}>
            {info?.metricLabel ?? "Reading"}
          </span>
          <span
            style={{
              fontSize: "var(--type-body)",
              fontWeight: "var(--weight-bold)",
            }}
          >
            {formatMeasurement(reading.value, unit)}
          </span>
        </div>
        {info && (
          <div className="flex items-baseline justify-between gap-5">
            <span style={{ color: MUTED, fontSize: "var(--type-caption)" }}>
              Target
            </span>
            <span
              style={{
                color: MUTED,
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-semibold)",
              }}
            >
              {info.band.min} to {info.band.max}
              {unit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T00:00:00`)
    : new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TrendsScreen({
  units,
  modes,
  history,
  initialUnitId,
  header,
}: Props) {
  const [trendView, setTrendView] = useState<TrendView>("environmental");
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

  // Hatch history state.
  const [hatchSearch, setHatchSearch] = useState("");
  const [species, setSpecies] = useState<string>("All");
  const [hatchPage, setHatchPage] = useState(1);
  const touchStartX = useRef<number | null>(null);
  const [hatchRowsPerPage, setHatchRowsPerPage] = useState(HATCH_ROWS);
  const [hatchView, setHatchView] = useState<ViewMode>("grid");

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
  const chartData = useMemo(() => {
    const rows = new Map<
      number,
      { ts: number; time: string; [seriesId: string]: number | string }
    >();
    activeUnits.forEach((u) => {
      (readingsByIncubator[u.id] ?? []).forEach((p) => {
        let row = rows.get(p.ts);
        if (!row) {
          row = { ts: p.ts, time: p.time };
          rows.set(p.ts, row);
        }
        row[u.id] = metric === "temp" ? p.temp : p.humidity;
      });
    });
    return Array.from(rows.values()).sort((a, b) => a.ts - b.ts);
  }, [activeUnits, metric, readingsByIncubator]);

  // Raw readings for the single selected chamber (used by the export modal).
  const readingGroups = compare ? activeUnits : [unit];
  const readingsForExport = readingGroups
    .flatMap((readingUnit) =>
      (readingsByIncubator[readingUnit.id] ?? []).map((reading) => ({
        chamber: readingUnit.name,
        reading,
      })),
    )
    .sort(
      (left, right) =>
        left.reading.ts - right.reading.ts ||
        left.chamber.localeCompare(right.chamber),
    );

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
        const v = row[u.id];
        if (typeof v === "number") {
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

  const exportCsv = () => {
    const blob = new Blob([buildReadingsCsv(readingsForExport)], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const scopeName = compare
      ? "compared-chambers"
      : unit.name.replace(/\s+/g, "-").toLowerCase();
    a.download = `${scopeName}-readings-${range}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(
      compare
        ? `Exported ${readingsForExport.length} readings from ${readingGroups.length} chambers`
        : `Exported ${readingsForExport.length} readings for ${unit.name}`,
    );
  };

  // ── Hatch-history derived data ──────────────────────────────────────────────
  const withPct = useMemo(() => selectHatchWithPct(history), [history]);

  const kpis = useMemo(() => selectHatchKpis(withPct), [withPct]);

  const speciesOptions: string[] = [
    "All",
    ...Array.from(new Set(history.map((h) => h.modeName))).sort(),
  ];

  const filteredHatch = useMemo(
    () =>
      selectFilteredHatch(withPct, {
        search: hatchSearch,
        species,
      }),
    [withPct, hatchSearch, species],
  );

  const hatchPages = Math.max(
    1,
    Math.ceil(filteredHatch.length / hatchRowsPerPage),
  );
  const page = Math.min(hatchPage, hatchPages);
  const pagedHatch = filteredHatch.slice(
    (page - 1) * hatchRowsPerPage,
    page * hatchRowsPerPage,
  );
  const viewOptions: {
    key: TrendView;
    label: string;
  }[] = [
    { key: "environmental", label: "Environmental Trends" },
    { key: "hatch", label: "Hatch History" },
  ];
  const cardStyle = {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderRadius: "var(--radius-card)",
    boxShadow: "var(--shadow-card)",
  };

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
        <>
          {/* Unified 2-row toolbar: chamber + metric controls, then time horizon. */}
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: BORDER,
              backgroundColor: CARD,
              ...CONTROL_FONT,
            }}
          >
            {/* ROW 1 — chamber selection and metric. */}
            <div className="flex flex-col items-stretch gap-3 md:flex-row md:flex-wrap md:items-center">
              {!compare ? (
                <Select size="filter" value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger
                    size="filter"
                    className="h-[var(--control-height-mobile)] min-w-0 flex-1 rounded-xl md:w-[240px] md:shrink-0"
                    style={{
                      ...toolbarInputStyle,
                      ...CONTROL_FONT,
                      color: RUST,
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={CONTROL_FONT}>
                    {units.map((u) => (
                      <SelectItem
                        key={u.id}
                        value={u.id}
                        style={{ color: TEXT }}
                      >
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                /* Compact multi-select dropdown — avoids chip wrapping. */
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-[var(--control-height-default)] min-w-0 flex-1 cursor-pointer items-center justify-between gap-1.5 rounded-xl border px-3 py-2 whitespace-nowrap transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 md:h-[var(--control-height-toolbar)] md:w-[240px] md:shrink-0"
                      style={{
                        ...toolbarInputStyle,
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-filter-value)",
                        fontWeight: "var(--weight-bold)",
                        lineHeight: "var(--leading-normal)",
                        border: `1px solid ${toolbarInputStyle.borderColor}`,
                        color: RUST,
                      }}
                    >
                      {compareIds.length} of {units.length} Chambers
                      <ChevronDown size={16} style={{ color: MUTED }} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-64 p-0"
                    align="start"
                    style={COMPARE_FONT}
                  >
                    <div
                      className="px-3 py-2"
                      style={{ borderBottom: `1px solid ${BORDER}` }}
                    >
                      <span style={{ ...COMPARE_FONT, color: TEXT }}>
                        Select chambers
                      </span>
                      <p style={{ ...COMPARE_FONT, color: MUTED }}>
                        Keep at least two selected.
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {units.map((u) => {
                        const checked = compareIds.includes(u.id);
                        // The last two selections lock so the chart can never go blank.
                        const locked = checked && compareIds.length <= 2;
                        return (
                          <div
                            key={u.id}
                            className={`flex items-center gap-3 px-3 py-2 ${
                              locked
                                ? "cursor-default opacity-70"
                                : "cursor-pointer hover:bg-amber-50/60"
                            }`}
                          >
                            <Checkbox
                              id={`compare-chamber-${u.id}`}
                              checked={checked}
                              disabled={locked}
                              onCheckedChange={() => toggleCompareId(u.id)}
                              aria-label={u.name}
                            />
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: checked
                                  ? colorFor(u.id)
                                  : BORDER,
                              }}
                            />
                            <span
                              className="min-w-0 break-words"
                              style={{
                                ...COMPARE_FONT,
                                color: TEXT,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {u.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              <div className="flex w-full items-center justify-between gap-2 md:w-auto md:flex-1">
                <div
                  className="flex shrink-0 cursor-pointer items-center gap-2"
                  style={{ ...CONTROL_FONT, color: compare ? TEXT : MUTED }}
                >
                  <Switch
                    checked={compare}
                    onCheckedChange={handleCompareChange}
                    aria-label="Compare Chambers"
                  />
                  Compare Chambers
                </div>
                <button
                  type="button"
                  onClick={() => setReadingsOpen(true)}
                  className="flex h-[var(--control-height-mobile)] shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-1 transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 md:min-h-[var(--control-height-compact)]"
                  style={{
                    color: "var(--brand-primary)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-caption)",
                    fontWeight: "var(--weight-bold)",
                  }}
                >
                  <TableProperties size={16} aria-hidden="true" />
                  {compare
                    ? "Readings for compared chambers"
                    : "See all readings"}
                </button>
              </div>
            </div>

            <div
              className="mt-4 flex flex-wrap items-center gap-2 pt-4"
              style={{ borderTop: `1px solid ${BORDER}` }}
            >
              <FilterBar
                ariaLabel="Time horizon"
                variant="segmented"
                fitToScreenOnMobile
                value={range}
                onChange={(key) => setRange(key as RangeKey)}
                options={ranges.map((r) => ({ key: r.key, label: r.label }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            {staleTelemetryUnits.length > 0 && (
              <p
                role="status"
                className="rounded-xl border px-3 py-2 text-sm text-[var(--text-secondary)]"
                style={{ borderColor: BORDER }}
              >
                Telemetry is not current for{" "}
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
            )}
            {readingsLoading && (
              <p role="status" className="text-sm text-[var(--text-secondary)]">
                Loading environmental readings…
              </p>
            )}
            {readingsError && (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                style={{ borderColor: BORDER }}
              >
                <p className="text-sm text-[var(--text-secondary)]">
                  {activeReadingCount > 0
                    ? "Some readings could not be loaded. Showing available readings."
                    : "Environmental readings could not be loaded."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void retryReadings()}
                >
                  Retry
                </Button>
              </div>
            )}
            {!readingsLoading && !readingsError && activeReadingCount === 0 && (
              <p role="status" className="text-sm text-[var(--text-secondary)]">
                No historical readings are available for this selection and time
                range.
              </p>
            )}
          </div>

          <Card style={{ ...cardStyle, backgroundColor: SURFACE }}>
            <CardContent className="p-4 md:p-6">
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h2
                        id="environmental-chart-title"
                        style={{
                          color: TEXT,
                          fontFamily: "var(--font-display)",
                          fontSize: "var(--type-heading-md)",
                          fontWeight: "var(--weight-bold)",
                          lineHeight: "var(--leading-snug)",
                        }}
                      >
                        {metricInfo[metric].label} Trend
                      </h2>
                      <p
                        style={{
                          color: MUTED,
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--type-caption)",
                          fontWeight: "var(--weight-semibold)",
                          lineHeight: "var(--leading-normal)",
                          whiteSpace: "nowrap",
                        }}
                        title={targetRangeLabel}
                      >
                        {targetRangeShort}
                      </p>
                    </div>
                    <SegmentedControl
                      flush
                      className="max-w-full shrink-0 self-start overflow-x-auto scrollbar-none"
                      aria-label="Chart metric"
                    >
                      {(Object.keys(metricInfo) as Metric[]).map((mk) => {
                        const active = metric === mk;
                        return (
                          <SegmentedControlItem
                            key={mk}
                            flush
                            active={active}
                            aria-pressed={active}
                            onClick={() => setMetric(mk)}
                            className="px-3"
                            style={{
                              fontFamily: "var(--font-body)",
                              fontSize: "var(--type-filter-label)",
                              fontWeight: "var(--weight-bold)",
                              lineHeight: "var(--leading-snug)",
                              letterSpacing: "var(--tracking-label)",
                              textTransform: "uppercase",
                            }}
                          >
                            {metricInfo[mk].label}
                          </SegmentedControlItem>
                        );
                      })}
                    </SegmentedControl>
                  </div>
                  <fieldset
                    aria-label="Chart legend"
                    className="m-0 flex min-w-0 w-full flex-nowrap items-center justify-start gap-x-2.5 overflow-x-auto border-0 p-0 pr-1 text-left scrollbar-none"
                    style={{
                      color: TEXT,
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-label)",
                      fontWeight: "var(--weight-semibold)",
                      letterSpacing: "var(--tracking-label)",
                      lineHeight: "var(--leading-snug)",
                    }}
                  >
                    {activeUnits.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        aria-label={`Highlight ${u.name} series`}
                        onMouseEnter={() => setHighlightedUnitId(u.id)}
                        onMouseLeave={() => setHighlightedUnitId(null)}
                        onFocus={() => setHighlightedUnitId(u.id)}
                        onBlur={() => setHighlightedUnitId(null)}
                        className="flex h-[var(--control-height-mobile)] shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-0.5 transition-[background-color,opacity] duration-150 hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 motion-reduce:transition-none md:h-auto md:min-h-4"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--type-label)",
                          fontWeight: "var(--weight-semibold)",
                          letterSpacing: "var(--tracking-label)",
                          lineHeight: "var(--leading-snug)",
                          opacity:
                            activeHighlightedUnitId &&
                            activeHighlightedUnitId !== u.id
                              ? 0.48
                              : 1,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className="h-0.5 w-2.5 rounded-full"
                          style={{ backgroundColor: colorFor(u.id) }}
                        />
                        {u.name}
                      </button>
                    ))}
                  </fieldset>
                </div>
              </div>

              <p id="environmental-chart-desc" className="sr-only">
                {`${metricInfo[metric].label} readings for ${activeUnits.map((u) => u.name).join(", ")}`}
              </p>
              <div
                className="mt-3 h-[260px] w-full border-t pt-3 md:mt-4 md:h-[420px] md:pt-4 lg:h-[440px]"
                style={{ borderColor: BORDER }}
                role="img"
                aria-labelledby="environmental-chart-title"
                aria-describedby="environmental-chart-desc"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{
                      top: 8,
                      right: 18,
                      left: isMobile ? 4 : 22,
                      bottom: 12,
                    }}
                  >
                    <defs key="defs">
                      {activeUnits.map((u) => (
                        <linearGradient
                          key={`gradient-${u.id}`}
                          id={`gradient-${u.id}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={colorFor(u.id)}
                            stopOpacity={0.24}
                          />
                          <stop
                            offset="95%"
                            stopColor={colorFor(u.id)}
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                      ))}
                    </defs>
                    {/* Every chart child carries an explicit key: recharts clones children
                        and reuses their keys, so unkeyed siblings collide. */}
                    <CartesianGrid
                      key="grid"
                      stroke="var(--chart-grid)"
                      strokeWidth={1}
                    />
                    <XAxis
                      key={`x-axis-${range}-${metric}`}
                      dataKey="ts"
                      type="number"
                      scale="time"
                      domain={["dataMin", "dataMax"]}
                      ticks={xTickValues}
                      tick={{
                        fill: MUTED,
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-medium)",
                      }}
                      tickFormatter={(_, index) => xTickLabels[index] ?? ""}
                      axisLine={{ stroke: "var(--input-border)" }}
                      tickLine={false}
                      tickMargin={10}
                      interval={0}
                    />
                    <YAxis
                      key="y-axis"
                      domain={domain}
                      width={isMobile ? 40 : 72}
                      tick={{
                        fill: MUTED,
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-medium)",
                      }}
                      tickCount={5}
                      tickFormatter={(value) =>
                        formatYTick(Number(value), ySpan)
                      }
                      tickLine={false}
                      axisLine={false}
                      tickMargin={isMobile ? 4 : 8}
                      allowDecimals
                      label={
                        isMobile
                          ? undefined
                          : {
                              value: `${metricInfo[metric].label} (${metricInfo[metric].unit})`,
                              angle: -90,
                              position: "insideLeft",
                              fill: MUTED,
                              fontFamily: "var(--font-body)",
                              fontSize: "var(--type-label)",
                              fontWeight: "var(--weight-semibold)",
                            }
                      }
                    />
                    <Tooltip
                      key="tooltip"
                      cursor={{ stroke: "var(--input-border)", strokeWidth: 1 }}
                      wrapperStyle={{ outline: "none" }}
                      position={isMobile ? { y: 0 } : undefined}
                      allowEscapeViewBox={{ x: false, y: true }}
                      content={
                        <ChartTooltip
                          unit={metricInfo[metric].unit}
                          meta={tooltipMeta}
                          highlightedId={activeHighlightedUnitId}
                          compact={isMobile}
                          range={range}
                        />
                      }
                    />
                    {bands.map((b) => (
                      <ReferenceArea
                        key={`band-${b.min}-${b.max}`}
                        y1={b.min}
                        y2={b.max}
                        fill={TARGET_BAND_COLOR}
                        fillOpacity={
                          bands.length > 1
                            ? TARGET_BAND_OPACITY / 2
                            : TARGET_BAND_OPACITY
                        }
                        strokeOpacity={0}
                      />
                    ))}
                    {/* Soft gradient under-fill for single unit or highlighted unit (Copilot Money style) */}
                    {activeUnits.map((u) => {
                      const isSoleOrHighlighted =
                        activeUnits.length === 1 ||
                        activeHighlightedUnitId === u.id;
                      if (!isSoleOrHighlighted) return null;
                      return (
                        <Area
                          key={`area-${u.id}`}
                          type="monotone"
                          dataKey={u.id}
                          stroke="none"
                          fill={`url(#gradient-${u.id})`}
                          fillOpacity={1}
                          connectNulls
                          isAnimationActive={false}
                        />
                      );
                    })}
                    {bands[0] && (
                      <ReferenceLine
                        key="target-reference-line"
                        y={Number(
                          ((bands[0].min + bands[0].max) / 2).toFixed(1),
                        )}
                        stroke="var(--chart-target-band)"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        strokeOpacity={0.75}
                      />
                    )}
                    {activeUnits.map((u) => {
                      const highlighted = activeHighlightedUnitId === u.id;
                      const faded = Boolean(
                        activeHighlightedUnitId && !highlighted,
                      );
                      return (
                        <Line
                          key={`line-${u.id}`}
                          type="monotone"
                          dataKey={u.id}
                          name={u.name}
                          stroke={colorFor(u.id)}
                          strokeWidth={highlighted ? 2.4 : 1.8}
                          strokeOpacity={faded ? 0.22 : 0.92}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          dot={false}
                          activeDot={
                            faded || (activeUnits.length > 4 && !highlighted)
                              ? false
                              : {
                                  r: highlighted ? 4 : 3,
                                  strokeWidth: 1.5,
                                  fill: SURFACE,
                                }
                          }
                          connectNulls
                          isAnimationActive={false}
                          onMouseEnter={() => setHighlightedUnitId(u.id)}
                          onMouseLeave={() => setHighlightedUnitId(null)}
                          className="transition-opacity duration-150 motion-reduce:transition-none"
                        />
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <section aria-label="Hatch history">
          {/* KPI summary row: 3 cards in 1 row across viewports */}
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <KpiCard
              Icon={Layers}
              hideIconOnMobile
              label="Completed Cycles"
              value={`${kpis.cycles}`}
              minHeight="none"
              accentBar="var(--text-primary)"
            />
            <KpiCard
              Icon={Percent}
              hideIconOnMobile
              label="Average Hatchability"
              value={kpis.avgRate === null ? "N/A" : `${kpis.avgRate}%`}
              minHeight="none"
              accent={OK}
              accentBar={OK}
            />
            <KpiCard
              Icon={TrendingUp}
              hideIconOnMobile
              label="Total Chicks Hatched"
              value={`${kpis.hatched}`}
              minHeight="none"
              accentBar="var(--text-primary)"
            />
          </div>

          {/* Control bar: search + species filter dropdown */}
          {/* Control bar: search + species filter dropdown + ViewToggle */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 md:mt-6">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative min-w-0 flex-1 md:min-w-[220px]">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: MUTED }}
                />
                <Input
                  size="toolbar"
                  value={hatchSearch}
                  onChange={(e) => {
                    setHatchSearch(e.target.value);
                    setHatchPage(1);
                  }}
                  maxLength={50}
                  placeholder="Filter hatch history..."
                  aria-label="Filter hatch history"
                  className="h-[var(--control-height-mobile)] rounded-xl pl-9 md:h-[var(--control-height-toolbar)]"
                  style={{
                    ...inputStyle,
                    fontSize: "var(--type-filter-value)",
                  }}
                />
              </div>
              <div className="w-[150px] shrink-0 md:w-[200px]">
                <Select
                  size="filter"
                  value={species}
                  onValueChange={(val) => {
                    setSpecies(val);
                    setHatchPage(1);
                  }}
                >
                  <SelectTrigger
                    size="filter"
                    className="w-full justify-start rounded-xl"
                    style={{
                      ...toolbarInputStyle,
                      ...CONTROL_FONT,
                      color: RUST,
                    }}
                  >
                    <SelectValue placeholder="Species: All" />
                  </SelectTrigger>
                  <SelectContent style={CONTROL_FONT}>
                    {speciesOptions.map((s) => {
                      return (
                        <SelectItem key={s} value={s} style={{ color: TEXT }}>
                          {s === "All" ? `All Species` : s}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Desktop ViewToggle (grid vs list), hidden on mobile where responsive cards are always shown */}
            <div className="hidden md:block">
              <ViewToggle view={hatchView} onChange={setHatchView} />
            </div>
          </div>

          {/* Main content: Cards view (Mobile & Desktop Grid) vs Table view (Desktop List) */}
          {isMobile || hatchView === "grid" ? (
            <div className="mt-2 md:mt-4 space-y-4">
              {/* Responsive Cards Grid */}
              <div
                className="grid grid-cols-1 gap-3 touch-pan-y md:grid-cols-2"
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0].clientX;
                }}
                onTouchEnd={(e) => {
                  if (touchStartX.current === null) return;
                  const dx = e.changedTouches[0].clientX - touchStartX.current;
                  touchStartX.current = null;
                  if (Math.abs(dx) < 48) return;
                  if (dx < 0) setHatchPage(Math.min(hatchPages, page + 1));
                  else setHatchPage(Math.max(1, page - 1));
                }}
              >
                {pagedHatch.map((h) => {
                  const good = h.pct !== null && h.pct >= 80;
                  const unhatched = h.totalEggs - h.hatchedEggs;
                  return (
                    <div
                      key={h.id}
                      className="flex flex-col gap-3 rounded-[var(--radius-dialog)] border p-4 shadow-sm transition-colors duration-150"
                      style={{
                        backgroundColor: "var(--surface-card)",
                        borderColor: BORDER,
                      }}
                    >
                      {/* Card Header: Chamber Name + Mode Badge + Hatchability Pill */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4
                            style={{
                              fontFamily: "var(--font-display)",
                              fontSize: "var(--type-heading-sm)",
                              fontWeight: "var(--weight-bold)",
                              color: TEXT,
                            }}
                            className="truncate"
                          >
                            {h.chamber}
                          </h4>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className="rounded-full px-2 py-0.5"
                              style={{
                                backgroundColor: "var(--wash-brand-soft)",
                                color: RUST,
                                fontWeight: "var(--weight-semibold)",
                                fontSize: "var(--type-label)",
                              }}
                            >
                              {h.modeName}
                            </span>
                            <span
                              style={{
                                color: MUTED,
                                fontFamily: "var(--font-body)",
                                fontSize: "var(--type-caption)",
                              }}
                            >
                              {formatDate(h.startDate)} –{" "}
                              {formatDate(h.endDate)}
                            </span>
                          </div>
                        </div>

                        <span
                          className="shrink-0 rounded-full px-2.5 py-1 text-center"
                          style={{
                            backgroundColor: good ? OK_BG : WARN_BG,
                            color: good ? OK : WARN,
                            fontWeight: "var(--weight-extrabold)",
                            fontSize: "var(--type-body-sm)",
                          }}
                        >
                          {h.pct === null ? "N/A" : `${h.pct}%`}
                        </span>
                      </div>

                      {/* Card Telemetry Metrics: Eggs Set, Hatched, Unhatched */}
                      <div
                        className="grid grid-cols-3 gap-2 rounded-[var(--radius-dialog)] p-2.5"
                        style={{ backgroundColor: "var(--surface-tile)" }}
                      >
                        <div className="flex flex-col">
                          <span
                            style={{
                              fontSize: "var(--type-label-compact)",
                              color: "var(--text-muted)",
                              fontWeight: "var(--weight-bold)",
                              textTransform: "uppercase",
                              letterSpacing: "var(--tracking-label)",
                            }}
                          >
                            Eggs Set
                          </span>
                          <span
                            style={{
                              fontSize: "var(--type-heading-sm)",
                              fontWeight: "var(--weight-bold)",
                              color: TEXT,
                            }}
                          >
                            {h.totalEggs}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span
                            style={{
                              fontSize: "var(--type-label-compact)",
                              color: "var(--text-muted)",
                              fontWeight: "var(--weight-bold)",
                              textTransform: "uppercase",
                              letterSpacing: "var(--tracking-label)",
                            }}
                          >
                            Hatched
                          </span>
                          <span
                            style={{
                              fontSize: "var(--type-heading-sm)",
                              fontWeight: "var(--weight-bold)",
                              color: good ? OK : TEXT,
                            }}
                          >
                            {h.hatchedEggs}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span
                            style={{
                              fontSize: "var(--type-label-compact)",
                              color: "var(--text-muted)",
                              fontWeight: "var(--weight-bold)",
                              textTransform: "uppercase",
                              letterSpacing: "var(--tracking-label)",
                            }}
                          >
                            Unhatched
                          </span>
                          <span
                            style={{
                              fontSize: "var(--type-heading-sm)",
                              fontWeight: "var(--weight-bold)",
                              color:
                                unhatched > 0
                                  ? "var(--text-secondary)"
                                  : "var(--text-muted)",
                            }}
                          >
                            {Math.max(0, unhatched)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {pagedHatch.length === 0 && (
                <div
                  className="py-12 text-center rounded-[var(--radius-dialog)] border"
                  style={{
                    borderColor: BORDER,
                    backgroundColor: "var(--surface-card)",
                  }}
                >
                  <p
                    style={{
                      color: MUTED,
                      fontSize: "var(--type-body-sm)",
                    }}
                  >
                    No cycles match your filters.
                  </p>
                </div>
              )}

              {/* Single clean pagination bar below cards */}
              {filteredHatch.length > 0 && (
                <div
                  className="overflow-hidden rounded-[var(--radius-dialog)] border"
                  style={{
                    backgroundColor: "var(--surface-card)",
                    borderColor: BORDER,
                  }}
                >
                  <PaginationBar
                    className="border-none px-4 py-3"
                    page={page}
                    pageSize={hatchRowsPerPage}
                    totalItems={filteredHatch.length}
                    itemLabel="records"
                    pageSizeOptions={[10, 20, 50]}
                    onPageSizeChange={(value) => {
                      setHatchRowsPerPage(value);
                      setHatchPage(1);
                    }}
                    onPageChange={setHatchPage}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Desktop List View: Full 6-Column Data Table */
            <div
              className="mt-3 md:mt-6 overflow-hidden rounded-[var(--radius-dialog)] border"
              style={{
                borderColor: BORDER,
                backgroundColor: CARD,
              }}
            >
              <div className="h-[520px] overflow-auto">
                <Table className="min-w-[640px]">
                  <TableHeader
                    className="sticky top-0 z-10"
                    style={{ backgroundColor: "var(--surface-tile)" }}
                  >
                    <TableRow>
                      {["CHAMBER", "MODE", "DATES"].map((h) => (
                        <TableHead
                          key={h}
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
                          {h}
                        </TableHead>
                      ))}
                      {["EGGS SET", "HATCHED", "HATCHABILITY"].map((h) => (
                        <TableHead
                          key={h}
                          className="text-right"
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
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedHatch.map((h) => {
                      const good = h.pct !== null && h.pct >= 80;
                      return (
                        <TableRow key={h.id} className="hover:bg-amber-50/60">
                          <TableCell
                            style={{
                              fontSize: "var(--type-body)",
                              lineHeight: "var(--leading-normal)",
                              fontWeight: "var(--weight-bold)",
                              color: TEXT,
                            }}
                          >
                            {h.chamber}
                          </TableCell>
                          <TableCell>
                            <span
                              className="rounded-full px-2 py-0.5"
                              style={{
                                backgroundColor: "var(--wash-brand-soft)",
                                color: RUST,
                                fontWeight: "var(--weight-semibold)",
                                fontSize: "var(--type-body-sm)",
                              }}
                            >
                              {h.modeName}
                            </span>
                          </TableCell>
                          <TableCell
                            style={{
                              color: MUTED,
                              fontFamily: "var(--font-body)",
                              fontSize: "var(--type-body-sm)",
                              lineHeight: "var(--leading-normal)",
                            }}
                          >
                            {formatDate(h.startDate)} to {formatDate(h.endDate)}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            style={{
                              fontSize: "var(--type-body)",
                              lineHeight: "var(--leading-normal)",
                            }}
                          >
                            {h.totalEggs}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            style={{
                              fontSize: "var(--type-body)",
                              lineHeight: "var(--leading-normal)",
                            }}
                          >
                            {h.hatchedEggs}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className="inline-block rounded-full px-2.5 py-0.5"
                              style={{
                                backgroundColor: good ? OK_BG : WARN_BG,
                                color: good ? OK : WARN,
                                fontWeight: "var(--weight-bold)",
                                fontSize: "var(--type-body-sm)",
                              }}
                            >
                              {h.pct === null ? "Not available" : `${h.pct}%`}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {pagedHatch.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-8 text-center"
                          style={{
                            color: MUTED,
                            fontSize: "var(--type-body-sm)",
                          }}
                        >
                          No cycles match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <PaginationBar
                className="border-t border-b-0 px-4 py-2.5"
                page={page}
                pageSize={hatchRowsPerPage}
                totalItems={filteredHatch.length}
                itemLabel="records"
                pageSizeOptions={[10, 20, 50]}
                onPageSizeChange={(value) => {
                  setHatchRowsPerPage(value);
                  setHatchPage(1);
                }}
                onPageChange={setHatchPage}
              />
            </div>
          )}
        </section>
      )}

      {/* Raw readings modal */}
      <Dialog open={readingsOpen} onOpenChange={setReadingsOpen}>
        <DialogContent className="rounded-2xl md:max-w-2xl">
          <DialogHeader className="gap-0 pt-10 text-left">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <DialogTitle
                  className="min-w-0 whitespace-nowrap text-left"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--type-heading-md)",
                    fontWeight: "var(--weight-bold)",
                    lineHeight: "var(--leading-snug)",
                  }}
                >
                  {compare
                    ? "Compared Chamber Readings"
                    : `${unit.name} Readings`}
                </DialogTitle>
                <DialogDescription
                  className="text-left"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-caption)",
                    lineHeight: "var(--leading-normal)",
                  }}
                >
                  <strong style={{ fontWeight: "var(--weight-bold)" }}>
                    {readingsForExport.length}
                  </strong>{" "}
                  readings across {readingGroups.length}{" "}
                  {readingGroups.length === 1 ? "chamber" : "chambers"}
                </DialogDescription>
              </div>
              <Button
                className="shrink-0 gap-1 rounded-xl px-2"
                style={{
                  backgroundColor: RUST,
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-caption)",
                  lineHeight: "var(--leading-normal)",
                }}
                onClick={exportCsv}
              >
                <Download size={16} /> Export as CSV
              </Button>
            </div>
          </DialogHeader>
          <div
            className="max-h-[50vh] overflow-y-auto rounded-[var(--radius-dialog)] border"
            style={{ borderColor: BORDER }}
          >
            <Table>
              <TableHeader
                className="sticky top-0 z-10"
                style={{ backgroundColor: "var(--surface-tile)" }}
              >
                <TableRow>
                  <TableHead>Chamber</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Temperature</TableHead>
                  <TableHead className="text-right">Humidity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readingsForExport.map(({ chamber, reading }) => (
                  <TableRow key={`${reading.ts}-${chamber}`}>
                    <TableCell
                      style={{
                        fontSize: "var(--type-body)",
                        lineHeight: "var(--leading-normal)",
                      }}
                    >
                      {chamber}
                    </TableCell>
                    <TableCell
                      style={{
                        color: MUTED,
                        fontSize: "var(--type-body)",
                        lineHeight: "var(--leading-normal)",
                      }}
                    >
                      {new Date(reading.ts).toLocaleString()}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      style={{
                        fontSize: "var(--type-body)",
                        lineHeight: "var(--leading-normal)",
                      }}
                    >
                      {reading.temp}°C
                    </TableCell>
                    <TableCell
                      className="text-right"
                      style={{
                        fontSize: "var(--type-body)",
                        lineHeight: "var(--leading-normal)",
                      }}
                    >
                      {reading.humidity}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
