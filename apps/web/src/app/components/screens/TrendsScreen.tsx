import {
  ChevronDown,
  Download,
  Egg,
  Layers,
  LineChart,
  Percent,
  Search,
  TableProperties,
  TrendingUp,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import type { ReadingWindow } from "../../data/repositories/repository";
import type { HatchRecord, Incubator, Mode } from "../../domain/types";
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
const TARGET_BAND_COLOR = "#16A34A";
const TARGET_BAND_OPACITY = 0.045;
const inputStyle = { borderColor: "#D8D0C0", backgroundColor: "#F2EEE5" };
// Framed white control used inside the trends toolbar.
const toolbarInputStyle = { borderColor: "#D8D0C0", backgroundColor: SURFACE };
// One typographic voice for every control in the trends toolbar.
const CONTROL_FONT: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-body-sm)",
  fontWeight: "var(--weight-semibold)",
  lineHeight: "var(--leading-normal)",
};

type RangeKey = ReadingWindow;
const ranges: { key: RangeKey; label: string; hours: number | null }[] = [
  { key: "24h", label: "LAST 24H", hours: 24 },
  { key: "7d", label: "LAST 7 DAYS", hours: 24 * 7 },
  { key: "full", label: "FULL INCUBATION", hours: null },
];

type TrendView = "environmental" | "hatch";
type Metric = "temp" | "humidity";

// Muted chamber-identity colors, distinct from the semantic status colors.
const CHAMBER_COLORS = [
  "#3E5C76",
  "#4F7C82",
  "#7B5D78",
  "#675A8C",
  "#9A6B50",
  "#66806A",
  "#466B8A",
  "#6F8488",
  "#936D85",
  "#7F74A8",
  "#A0826B",
  "#77906F",
];

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
  return `${day} · ${time}`;
}

function formatMeasurement(value: number, unit: string) {
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: unit === "°C" ? 1 : 0,
  })}${unit}`;
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
          backgroundColor: "var(--text-primary)",
          color: "#FFFFFF",
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
              color: "rgba(255, 255, 255, 0.75)",
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
      className="min-w-[196px] rounded-xl border bg-white p-3.5 shadow-lg"
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
        <p style={{ fontSize: 13, fontWeight: 700 }}>{reading.name}</p>
      </div>
      {typeof timestamp === "number" && (
        <p className="mt-0.5" style={{ color: MUTED, fontSize: 12 }}>
          {formatTooltipTime(timestamp)}
        </p>
      )}
      <div
        className="mt-3 space-y-1.5 border-t pt-2.5"
        style={{ borderColor: BORDER }}
      >
        <div className="flex items-baseline justify-between gap-5">
          <span style={{ color: MUTED, fontSize: 12 }}>
            {info?.metricLabel ?? "Reading"}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            {formatMeasurement(reading.value, unit)}
          </span>
        </div>
        {info && (
          <div className="flex items-baseline justify-between gap-5">
            <span style={{ color: MUTED, fontSize: 12 }}>Target</span>
            <span style={{ color: MUTED, fontSize: 12, fontWeight: 600 }}>
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

export function TrendsScreen({ units, modes, history, initialUnitId }: Props) {
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
  const [hatchRowsPerPage, setHatchRowsPerPage] = useState(HATCH_ROWS);

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
  const { readingsByIncubator } = useIncubatorReadingMap(readingUnitIds, range);

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
  const singleReadings = readingsByIncubator[unit.id] ?? [];

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

  // Explicit x ticks (3 mobile / 5 desktop) so axis labels are deterministic
  // and never repeat the same wall time on the 24h view.
  const xTickValues = useMemo(
    () =>
      pickTimeTicks(
        chartData.map((row) => row.ts),
        isMobile ? 3 : 5,
      ),
    [chartData, isMobile],
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
  const targetRangeLabel =
    bands.length === 1
      ? `Target Safe Range · ${bands[0].min} to ${bands[0].max}${metricInfo[metric].unit}`
      : "Target Safe Range · varies by incubation mode";

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
    const header = "Timestamp,Temperature (C),Humidity (%)";
    const rows = singleReadings.map(
      (p) => `${new Date(p.ts).toISOString()},${p.temp},${p.humidity}`,
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${unit.name.replace(/\s+/g, "-").toLowerCase()}-readings-${range}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${singleReadings.length} readings as CSV`);
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
    Icon: typeof LineChart;
  }[] = [
    { key: "environmental", label: "Environmental Trends", Icon: LineChart },
    { key: "hatch", label: "Hatch History", Icon: Egg },
  ];

  const cardStyle = {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderRadius: 16,
    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-start gap-4">
        <SegmentedControl aria-label="Trend view" className="w-full sm:w-auto">
          {viewOptions.map(({ key, label, Icon }) => {
            const active = trendView === key;
            return (
              <SegmentedControlItem
                key={key}
                active={active}
                className="min-w-0 flex-1 !h-auto min-h-11 whitespace-normal px-3 py-2 text-center sm:flex-none sm:px-4"
                aria-pressed={active}
                onClick={() => setTrendView(key)}
              >
                <Icon size={16} aria-hidden="true" /> {label}
              </SegmentedControlItem>
            );
          })}
        </SegmentedControl>
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
            <div className="flex flex-wrap items-center gap-3">
              {!compare ? (
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger
                    size="toolbar"
                    className="w-full rounded-xl sm:w-[240px]"
                    style={{
                      ...toolbarInputStyle,
                      ...CONTROL_FONT,
                      color: TEXT,
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={CONTROL_FONT}>
                    {units.map((u) => (
                      <SelectItem
                        key={u.id}
                        value={u.id}
                        style={{ ...CONTROL_FONT, color: TEXT }}
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
                      className="flex h-[var(--control-height-toolbar)] w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-4 transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 sm:w-[240px]"
                      style={{
                        ...toolbarInputStyle,
                        ...CONTROL_FONT,
                        border: `1px solid ${toolbarInputStyle.borderColor}`,
                        color: TEXT,
                      }}
                    >
                      {compareIds.length} of {units.length} Chambers
                      <ChevronDown size={16} style={{ color: MUTED }} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-64 p-0"
                    align="start"
                    style={CONTROL_FONT}
                  >
                    <div
                      className="px-3 py-2"
                      style={{ borderBottom: `1px solid ${BORDER}` }}
                    >
                      <span style={{ ...CONTROL_FONT, color: TEXT }}>
                        Select chambers
                      </span>
                      <p style={{ ...CONTROL_FONT, color: MUTED }}>
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
                            <span style={{ ...CONTROL_FONT, color: TEXT }}>
                              {u.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              <div
                className="flex cursor-pointer items-center gap-2"
                style={{ ...CONTROL_FONT, color: compare ? TEXT : MUTED }}
              >
                <Switch
                  checked={compare}
                  onCheckedChange={handleCompareChange}
                  aria-label="Compare Chambers"
                />
                Compare Chambers
              </div>

              {/* Metric segmented toggle. */}
              <SegmentedControl className="ml-auto" aria-label="Metric">
                {(Object.keys(metricInfo) as Metric[]).map((mk) => {
                  const active = metric === mk;
                  return (
                    <SegmentedControlItem
                      key={mk}
                      size="compact"
                      active={active}
                      aria-pressed={active}
                      onClick={() => setMetric(mk)}
                      style={{ color: active ? TEXT : MUTED }}
                    >
                      {metricInfo[mk].label}
                    </SegmentedControlItem>
                  );
                })}
              </SegmentedControl>
            </div>

            <div
              className="mt-4 flex flex-wrap items-center gap-2 pt-4"
              style={{ borderTop: `1px solid ${BORDER}` }}
            >
              <FilterBar
                ariaLabel="Time horizon"
                value={range}
                onChange={(key) => setRange(key as RangeKey)}
                options={ranges.map((r) => ({ key: r.key, label: r.label }))}
              />
              {!compare && (
                <button
                  type="button"
                  onClick={() => setReadingsOpen(true)}
                  className="ml-auto flex min-h-[var(--control-height-chip)] cursor-pointer items-center gap-2 rounded-lg px-3 py-1 transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
                  style={{
                    color: "var(--brand-primary)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-bold)",
                  }}
                >
                  <TableProperties size={16} aria-hidden="true" /> See all
                  readings
                </button>
              )}
            </div>
          </div>

          <Card style={{ ...cardStyle, backgroundColor: SURFACE }}>
            <CardContent className="p-5 sm:p-6">
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-5">
                <div className="shrink-0">
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
                    {metricInfo[metric].label} History
                  </h2>
                  <p
                    className="mt-0.5"
                    style={{
                      color: MUTED,
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-caption)",
                      fontWeight: "var(--weight-semibold)",
                      lineHeight: "var(--leading-normal)",
                    }}
                  >
                    {targetRangeLabel}
                  </p>
                </div>

                <fieldset
                  aria-label="Chart legend"
                  className="m-0 flex max-h-[44px] min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 overflow-y-auto border-0 p-0 pr-1 lg:max-w-[76%] lg:justify-end"
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
                      className="flex min-h-4 cursor-pointer items-center gap-1 rounded-md px-0.5 transition-[background-color,opacity] duration-150 hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 motion-reduce:transition-none"
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

              <div
                className="mt-4 h-[360px] w-full border-t pt-4 sm:h-[420px] lg:h-[440px]"
                style={{ borderColor: BORDER }}
                role="img"
                aria-labelledby="environmental-chart-title"
                aria-label={`${metricInfo[metric].label} readings for ${activeUnits.map((u) => u.name).join(", ")}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 18, left: 22, bottom: 12 }}
                  >
                    {/* Every chart child carries an explicit key: recharts clones children
                        and reuses their keys, so unkeyed siblings collide. */}
                    <CartesianGrid
                      key="grid"
                      stroke="#ECE9E2"
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
                      axisLine={{ stroke: "#D8D0C0" }}
                      tickLine={false}
                      tickMargin={10}
                      interval={0}
                    />
                    <YAxis
                      key="y-axis"
                      domain={domain}
                      width={isMobile ? 52 : 72}
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
                      cursor={{ stroke: "#D8D0C0", strokeWidth: 1 }}
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
        <>
          {/* KPI summary row. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              Icon={Layers}
              label="Completed Cycles"
              value={`${kpis.cycles} Cycles`}
              cardStyle={cardStyle}
            />
            <KpiCard
              Icon={Percent}
              label="Average Hatchability"
              value={
                kpis.avgRate === null ? "Not available" : `${kpis.avgRate}%`
              }
              accent={OK}
              cardStyle={cardStyle}
            />
            <KpiCard
              Icon={TrendingUp}
              label="Total Chicks Hatched"
              value={`${kpis.hatched} Hatched`}
              cardStyle={cardStyle}
            />
          </div>

          {/* Control bar: search + species filter dropdown */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1" style={{ minWidth: 220 }}>
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
                className="rounded-xl pl-9"
                style={inputStyle}
              />
            </div>
            <div className="w-[200px] shrink-0">
              <Select
                value={species}
                onValueChange={(val) => {
                  setSpecies(val);
                  setHatchPage(1);
                }}
              >
                <SelectTrigger
                  size="toolbar"
                  className="w-full rounded-xl"
                  style={{ ...toolbarInputStyle, ...CONTROL_FONT, color: TEXT }}
                >
                  <SelectValue placeholder="Species: All" />
                </SelectTrigger>
                <SelectContent style={CONTROL_FONT}>
                  {speciesOptions.map((s) => {
                    const count =
                      s === "All"
                        ? withPct.length
                        : withPct.filter((h) => h.modeName === s).length;
                    return (
                      <SelectItem
                        key={s}
                        value={s}
                        style={{ ...CONTROL_FONT, color: TEXT }}
                      >
                        {s === "All"
                          ? `All Species (${count})`
                          : `${s} (${count})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card style={cardStyle}>
            <CardContent className="p-5">
              <PaginationBar
                className="mb-4 border-b border-t-0 px-0 pt-0"
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
              <div
                className="h-[520px] overflow-auto rounded-2xl border"
                style={{ borderColor: BORDER }}
              >
                <Table>
                  <TableHeader
                    className="sticky top-0 z-10"
                    style={{ backgroundColor: "#F2EEE5" }}
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
                          <TableCell style={{ fontWeight: 700, color: TEXT }}>
                            {h.chamber}
                          </TableCell>
                          <TableCell>
                            <span
                              className="rounded-full px-2 py-0.5"
                              style={{
                                backgroundColor: "rgba(173,58,29,0.12)",
                                color: RUST,
                                fontWeight: 600,
                                fontSize: 13,
                              }}
                            >
                              {h.modeName}
                            </span>
                          </TableCell>
                          <TableCell style={{ color: MUTED }}>
                            {formatDate(h.startDate)} to {formatDate(h.endDate)}
                          </TableCell>
                          <TableCell className="text-right">
                            {h.totalEggs}
                          </TableCell>
                          <TableCell className="text-right">
                            {h.hatchedEggs}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className="inline-block rounded-full px-2.5 py-0.5"
                              style={{
                                backgroundColor: good ? OK_BG : WARN_BG,
                                color: good ? OK : WARN,
                                fontWeight: 700,
                                fontSize: 13,
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
                          style={{ color: MUTED }}
                        >
                          No cycles match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Raw readings modal */}
      <Dialog open={readingsOpen} onOpenChange={setReadingsOpen}>
        <DialogContent className="rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--type-heading-md)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              Raw readings: {unit.name}
            </DialogTitle>
            <DialogDescription>
              {singleReadings.length} data points for{" "}
              {ranges.find((r) => r.key === range)?.label.toLowerCase() ?? ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="mb-3 flex justify-end">
            <Button
              className="rounded-xl"
              style={{ backgroundColor: RUST }}
              onClick={exportCsv}
            >
              <Download size={16} /> Export as CSV
            </Button>
          </div>
          <div
            className="max-h-[50vh] overflow-y-auto rounded-2xl border"
            style={{ borderColor: BORDER }}
          >
            <Table>
              <TableHeader
                className="sticky top-0 z-10"
                style={{ backgroundColor: "#F2EEE5" }}
              >
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Temperature</TableHead>
                  <TableHead className="text-right">Humidity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {singleReadings.map((p) => (
                  <TableRow key={p.ts}>
                    <TableCell style={{ color: MUTED }}>
                      {new Date(p.ts).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{p.temp}°C</TableCell>
                    <TableCell className="text-right">{p.humidity}%</TableCell>
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

function KpiCard({
  Icon,
  label,
  value,
  accent,
  cardStyle,
}: {
  Icon: typeof LineChart;
  label: string;
  value: string;
  accent?: string;
  cardStyle: React.CSSProperties;
}) {
  return (
    <Card style={cardStyle}>
      <CardContent className="p-5">
        <div
          className="flex items-center gap-2"
          style={{ color: MUTED, fontSize: 13, fontWeight: 600 }}
        >
          <Icon size={16} /> {label}
        </div>
        <div
          className="mt-2 tracking-tight"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--type-panel-title)",
            fontWeight: "var(--weight-extrabold)",
            lineHeight: "var(--leading-tight)",
            color: accent ?? TEXT,
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
