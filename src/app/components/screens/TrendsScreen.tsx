import { useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import {
  LineChart,
  Egg,
  TableProperties,
  Download,
  ChevronDown,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Percent,
  Award,
  Layers,
} from "lucide-react";
import { Switch } from "../ui/switch";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Incubator, Mode, buildHistory, hatchHistory } from "../../data/mockData";

// ── Design tokens ───────────────────────────────────────────────────────────
const RUST = "#A84323";
const CARD = "#F9F6F0";
const SURFACE = "#FFFFFF";
const BORDER = "#E8E2D5";
const TEXT = "#1A1A1A";
const MUTED = "#5A4838";
const OK = "#16A34A";
const OK_BG = "#DCFCE7";
const WARN = "#D97706";
const WARN_BG = "#FEF3C7";
const TARGET_BAND = "rgba(22, 163, 74, 0.12)";
const inputStyle = { borderColor: "#D8D0C0", backgroundColor: "#F2EEE5" };
// Framed white control used inside the trends toolbar.
const toolbarInputStyle = { borderColor: "#D8D0C0", backgroundColor: SURFACE, height: 38 };
// One typographic voice for every control in the trends toolbar.
const CONTROL_FONT: React.CSSProperties = {
  fontFamily: '"Nunito", sans-serif',
  fontSize: 13,
  fontWeight: 600,
};

type RangeKey = "24h" | "7d" | "full";
const ranges: { key: RangeKey; label: string; hours: number | null }[] = [
  { key: "24h", label: "LAST 24H", hours: 24 },
  { key: "7d", label: "LAST 7 DAYS", hours: 24 * 7 },
  { key: "full", label: "FULL INCUBATION", hours: null },
];

type TrendView = "environmental" | "hatch";
type Metric = "temp" | "humidity";

// Muted chamber-identity colors, distinct from the semantic status colors.
const CHAMBER_COLORS = ["#3E5C76", "#5E8B8B", "#8C6A86", "#7A6A9B", "#A6795C", "#6B8E5A"];

const metricInfo: Record<Metric, { label: string; unit: string; domain: [number, number] }> = {
  temp: { label: "Temperature", unit: "°C", domain: [35, 40] },
  humidity: { label: "Humidity", unit: "%", domain: [40, 80] },
};

const HATCH_ROWS = 10;

interface Props {
  units: Incubator[];
  modes: Mode[];
  initialUnitId?: string;
}

// Per-chamber context the tooltip needs to judge each reading.
interface TooltipMeta {
  modeName: string;
  band: { min: number; max: number };
  metricLabel: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  meta,
}: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="p-3 shadow-lg" style={{ backgroundColor: "#1A1510", borderRadius: 12, color: "#FFFFFF" }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: BORDER }}>⏱ {label}</p>
      <div className="mt-1.5 space-y-1">
        {payload.map((p: any) => {
          const info: TooltipMeta | undefined = meta?.[p.dataKey];
          let status = info ? `${info.modeName} ✓` : "";
          if (info && typeof p.value === "number") {
            if (p.value > info.band.max) status = `⚠️ High ${info.metricLabel}`;
            else if (p.value < info.band.min) status = `⚠️ Low ${info.metricLabel}`;
          }
          return (
            <p key={p.dataKey} className="whitespace-nowrap" style={{ fontSize: 13 }}>
              <span style={{ color: p.color }}>•</span> {p.name}: {p.value}
              {unit}
              {status ? <span style={{ color: BORDER }}> ({status})</span> : null}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function TrendsScreen({ units, modes, initialUnitId }: Props) {
  const [trendView, setTrendView] = useState<TrendView>("environmental");
  const [unitId, setUnitId] = useState(initialUnitId ?? units[0]?.id ?? "");
  const [range, setRange] = useState<RangeKey>("24h");
  const [readingsOpen, setReadingsOpen] = useState(false);

  // Compare mode state.
  const [compare, setCompare] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>(units.slice(0, 2).map((u) => u.id));
  const [metric, setMetric] = useState<Metric>("temp");

  // Hatch history state.
  const [hatchSearch, setHatchSearch] = useState("");
  const [species, setSpecies] = useState<string>("All");
  const [hatchPage, setHatchPage] = useState(1);

  const unit = units.find((u) => u.id === unitId) ?? units[0];
  const mode = modes.find((m) => m.id === unit.modeId) ?? modes[0];
  const modeOf = (u: Incubator) => modes.find((m) => m.id === u.modeId) ?? modes[0];

  const cutoffFor = (key: RangeKey) => {
    const spec = ranges.find((r) => r.key === key)!;
    return spec.hours === null ? 0 : Date.now() - spec.hours * 3_600_000;
  };

  // The active set of chambers to chart (single selection, or the compare set).
  const activeUnits = useMemo<Incubator[]>(() => {
    if (!compare) return unit ? [unit] : [];
    return Array.from(new Set(compareIds))
      .map((id) => units.find((u) => u.id === id))
      .filter(Boolean) as Incubator[];
  }, [compare, compareIds, unit, units]);

  // Merge each active chamber's readings for the chosen metric onto a shared axis.
  const chartData = useMemo(() => {
    const cutoff = cutoffFor(range);
    const rows = new Map<number, any>();
    activeUnits.forEach((u) => {
      buildHistory(u, modeOf(u)).forEach((p) => {
        if (p.ts < cutoff) return;
        let row = rows.get(p.ts);
        if (!row) {
          row = { ts: p.ts, time: p.time };
          rows.set(p.ts, row);
        }
        row[u.id] = metric === "temp" ? p.temp : p.humidity;
      });
    });
    return Array.from(rows.values()).sort((a, b) => a.ts - b.ts);
  }, [activeUnits, range, metric]);

  // Raw readings for the single selected chamber (used by the export modal).
  const singleReadings = useMemo(() => {
    const cutoff = cutoffFor(range);
    return buildHistory(unit, mode).filter((p) => p.ts >= cutoff);
  }, [unit, mode, range]);

  // Unique safe bands across the active chambers, so we can shade the target zone.
  const bands = useMemo(() => {
    const seen = new Map<string, { min: number; max: number }>();
    activeUnits.forEach((u) => {
      const band = metric === "temp" ? modeOf(u).targetTemp : modeOf(u).targetHumidity;
      seen.set(`${band.min}-${band.max}`, band);
    });
    return Array.from(seen.values());
  }, [activeUnits, metric]);

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
    if (!isFinite(min) || !isFinite(max)) return metricInfo[metric].domain;
    const pad = metric === "temp" ? 0.5 : 3;
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  }, [chartData, activeUnits, bands, metric]);

  const colorFor = (id: string) =>
    compare ? CHAMBER_COLORS[compareIds.indexOf(id) % CHAMBER_COLORS.length] : RUST;

  // Mode + safe band per series, consumed by the hover tooltip.
  const tooltipMeta = useMemo(() => {
    const map: Record<string, TooltipMeta> = {};
    activeUnits.forEach((u) => {
      const m = modeOf(u);
      map[u.id] = {
        modeName: m.name,
        band: metric === "temp" ? m.targetTemp : m.targetHumidity,
        metricLabel: metric === "temp" ? "Temp" : "Humidity",
      };
    });
    return map;
  }, [activeUnits, metric]);

  // One target-range label when every active chamber shares a band, otherwise a hint.
  const targetRangeLabel =
    bands.length === 1
      ? `Target Safe Range (${bands[0].min}–${bands[0].max}${metricInfo[metric].unit})`
      : "Target Safe Range (varies by Mode)";

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
    const rows = singleReadings.map((p) => `${new Date(p.ts).toISOString()},${p.temp},${p.humidity}`);
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
  const withPct = useMemo(
    () => hatchHistory.map((h) => ({ ...h, pct: Math.round((h.hatchedEggs / h.totalEggs) * 100) })),
    []
  );

  const kpis = useMemo(() => {
    const cycles = withPct.length;
    const hatched = withPct.reduce((s, h) => s + h.hatchedEggs, 0);
    const avgRate = withPct.reduce((s, h) => s + h.hatchedEggs / h.totalEggs, 0) / cycles;
    const byMode = new Map<string, { sum: number; n: number }>();
    withPct.forEach((h) => {
      const cur = byMode.get(h.modeName) ?? { sum: 0, n: 0 };
      cur.sum += h.hatchedEggs / h.totalEggs;
      cur.n += 1;
      byMode.set(h.modeName, cur);
    });
    let topMode = "";
    let topAvg = 0;
    byMode.forEach((v, k) => {
      const a = v.sum / v.n;
      if (a > topAvg) {
        topAvg = a;
        topMode = k;
      }
    });
    return { cycles, hatched, avgRate, topMode, topAvg };
  }, [withPct]);

  const speciesOptions = ["All", "Broiler", "Duck", "Quail"];

  const filteredHatch = useMemo(() => {
    const q = hatchSearch.trim().toLowerCase();
    return withPct.filter((h) => {
      if (species !== "All" && h.modeName !== species) return false;
      if (!q) return true;
      return (
        h.chamber.toLowerCase().includes(q) ||
        h.modeName.toLowerCase().includes(q)
      );
    });
  }, [withPct, hatchSearch, species]);

  const hatchPages = Math.max(1, Math.ceil(filteredHatch.length / HATCH_ROWS));
  const page = Math.min(hatchPage, hatchPages);
  const pagedHatch = filteredHatch.slice((page - 1) * HATCH_ROWS, page * HATCH_ROWS);
  const rangeStart = filteredHatch.length === 0 ? 0 : (page - 1) * HATCH_ROWS + 1;
  const rangeEnd = Math.min(page * HATCH_ROWS, filteredHatch.length);

  const viewOptions: { key: TrendView; label: string; Icon: typeof LineChart }[] = [
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
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="flex items-center gap-1 rounded-full p-1" style={{ backgroundColor: "#F2EEE5" }}>
          {viewOptions.map(({ key, label, Icon }) => {
            const active = trendView === key;
            return (
              <button
                key={key}
                onClick={() => setTrendView(key)}
                className="flex items-center gap-2 rounded-full px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  backgroundColor: active ? SURFACE : "transparent",
                  color: active ? RUST : MUTED,
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  fontWeight: 600,
                }}
              >
                <Icon size={16} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {trendView === "environmental" ? (
        <>
          {/* Unified 2-row toolbar: chamber + metric controls, then time horizon. */}
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: BORDER, backgroundColor: CARD, ...CONTROL_FONT }}
          >
            {/* ROW 1 — chamber selection and metric. */}
            <div className="flex flex-wrap items-center gap-3">
              {!compare ? (
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger
                    className="w-[240px] rounded-xl"
                    style={{ ...toolbarInputStyle, ...CONTROL_FONT, color: TEXT }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={CONTROL_FONT}>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id} style={{ ...CONTROL_FONT, color: TEXT }}>
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
                      className="flex w-[240px] items-center justify-between gap-2 rounded-xl px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
                  <PopoverContent className="w-64 p-0" align="start" style={CONTROL_FONT}>
                    <div className="px-3 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ ...CONTROL_FONT, color: TEXT }}>Select chambers</span>
                      <p style={{ ...CONTROL_FONT, color: MUTED }}>Keep at least two selected.</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {units.map((u) => {
                        const checked = compareIds.includes(u.id);
                        // The last two selections lock so the chart can never go blank.
                        const locked = checked && compareIds.length <= 2;
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center gap-3 px-3 py-2 ${
                              locked ? "cursor-default opacity-70" : "cursor-pointer hover:bg-amber-50/60"
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={locked}
                              onCheckedChange={() => toggleCompareId(u.id)}
                            />
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: checked ? colorFor(u.id) : BORDER }}
                            />
                            <span style={{ ...CONTROL_FONT, color: TEXT }}>{u.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              <label
                className="flex cursor-pointer items-center gap-2"
                style={{ ...CONTROL_FONT, color: compare ? TEXT : MUTED }}
              >
                <Switch checked={compare} onCheckedChange={handleCompareChange} />
                Compare Chambers
              </label>

              {/* Metric segmented toggle. */}
              <div
                className="ml-auto flex items-center gap-1 rounded-xl p-1"
                style={{ backgroundColor: "#F2EEE5" }}
              >
                {(Object.keys(metricInfo) as Metric[]).map((mk) => {
                  const active = metric === mk;
                  return (
                    <button
                      key={mk}
                      onClick={() => setMetric(mk)}
                      className="rounded-lg px-4 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      style={{
                        ...CONTROL_FONT,
                        backgroundColor: active ? SURFACE : "transparent",
                        color: active ? TEXT : MUTED,
                        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      }}
                    >
                      {metricInfo[mk].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ROW 2 — time horizon presets. */}
            <div
              className="mt-4 flex flex-wrap gap-2 pt-4"
              style={{ borderTop: `1px solid ${BORDER}` }}
            >
              {ranges.map((r) => {
                const active = range === r.key;
                return (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className="rounded-xl px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{
                      backgroundColor: active ? RUST : SURFACE,
                      color: active ? "#FFFFFF" : "#78716C",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      border: active ? "none" : `1px solid ${BORDER}`,
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Card style={cardStyle}>
            <CardContent className="p-5">
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    {/* Every chart child carries an explicit key: recharts clones children
                        and reuses their keys, so unkeyed siblings collide. */}
                    <CartesianGrid key="grid" stroke={BORDER} strokeDasharray="4 4" />
                    <XAxis
                      key="x-axis"
                      dataKey="time"
                      tick={{ fill: MUTED, fontSize: 12 }}
                      interval="preserveStartEnd"
                      minTickGap={40}
                    />
                    <YAxis key="y-axis" domain={domain} tick={{ fill: MUTED, fontSize: 12 }} allowDecimals />
                    <Tooltip
                      key="tooltip"
                      content={<ChartTooltip unit={metricInfo[metric].unit} meta={tooltipMeta} />}
                    />
                    {bands.map((b) => (
                      <ReferenceArea
                        key={`band-${b.min}-${b.max}`}
                        y1={b.min}
                        y2={b.max}
                        fill={TARGET_BAND}
                        fillOpacity={1}
                      />
                    ))}
                    {activeUnits.map((u) => (
                      <Line
                        key={`line-${u.id}`}
                        type="monotone"
                        dataKey={u.id}
                        name={u.name}
                        stroke={colorFor(u.id)}
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Compact legend: target band swatch, then a dot + name per chamber.
                  Mode and safe-range detail now live in the hover tooltip. */}
              <div
                className="mt-4 flex flex-wrap items-center justify-center gap-4"
                style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: TARGET_BAND, border: `1px solid ${OK}` }}
                  />
                  <span style={{ color: MUTED }}>{targetRangeLabel}</span>
                </span>
                {activeUnits.map((u) => (
                  <span key={u.id} className="flex items-center gap-2 whitespace-nowrap">
                    <span
                      className="rounded-full"
                      style={{ width: 10, height: 10, backgroundColor: colorFor(u.id) }}
                    />
                    {u.name}
                  </span>
                ))}
                {!compare && (
                  <button
                    onClick={() => setReadingsOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{ backgroundColor: "#F2EEE5", color: RUST, fontWeight: 600, fontSize: 13 }}
                  >
                    <TableProperties size={16} /> See all readings
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* KPI summary row. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              Icon={Layers}
              label="Completed Cycles"
              value={`${kpis.cycles} Cycles`}
              cardStyle={cardStyle}
            />
            <KpiCard
              Icon={Percent}
              label="Average Hatch Rate"
              value={`${(kpis.avgRate * 100).toFixed(1)}%`}
              accent={OK}
              cardStyle={cardStyle}
            />
            <KpiCard
              Icon={TrendingUp}
              label="Total Chicks Hatched"
              value={`${kpis.hatched} Hatched`}
              cardStyle={cardStyle}
            />
            <KpiCard
              Icon={Award}
              label="Top Performing Mode"
              value={`${kpis.topMode} — ${Math.round(kpis.topAvg * 100)}% Avg`}
              cardStyle={cardStyle}
            />
          </div>

          {/* Control bar: search + species filter pills. */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1" style={{ minWidth: 220 }}>
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
              <Input
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
            <div className="flex flex-wrap gap-2">
              {speciesOptions.map((s) => {
                const active = species === s;
                const count =
                  s === "All"
                    ? withPct.length
                    : withPct.filter((h) => h.modeName === s).length;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setSpecies(s);
                      setHatchPage(1);
                    }}
                    className="rounded-xl px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{
                      backgroundColor: active ? RUST : SURFACE,
                      color: active ? "#fff" : MUTED,
                      border: active ? "none" : `1px solid ${BORDER}`,
                      fontWeight: 600,
                    }}
                  >
                    {s} <span style={{ opacity: 0.7 }}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Card style={cardStyle}>
            <CardContent className="p-5">
              <div
                className="h-[520px] overflow-auto rounded-2xl border"
                style={{ borderColor: BORDER }}
              >
                <Table>
                  <TableHeader className="sticky top-0 z-10" style={{ backgroundColor: "#F2EEE5" }}>
                    <TableRow>
                      {["CHAMBER", "MODE", "DATES"].map((h) => (
                        <TableHead key={h} style={{ color: "#78716C", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</TableHead>
                      ))}
                      {["EGGS SET", "HATCHED", "HATCHABILITY"].map((h) => (
                        <TableHead key={h} className="text-right" style={{ color: "#78716C", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedHatch.map((h) => {
                      const good = h.pct >= 80;
                      return (
                        <TableRow key={h.id} className="hover:bg-amber-50/60">
                          <TableCell style={{ fontWeight: 700, color: TEXT }}>{h.chamber}</TableCell>
                          <TableCell>
                            <span
                              className="rounded-full px-2 py-0.5"
                              style={{ backgroundColor: "rgba(173,58,29,0.12)", color: RUST, fontWeight: 600, fontSize: 13 }}
                            >
                              {h.modeName}
                            </span>
                          </TableCell>
                          <TableCell style={{ color: MUTED }}>
                            {formatDate(h.startDate)} – {formatDate(h.endDate)}
                          </TableCell>
                          <TableCell className="text-right">{h.totalEggs}</TableCell>
                          <TableCell className="text-right">{h.hatchedEggs}</TableCell>
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
                              {h.pct}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {pagedHatch.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center" style={{ color: MUTED }}>
                          No cycles match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination. */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span style={{ color: MUTED }}>
                  Showing {rangeStart}–{rangeEnd} of {filteredHatch.length} records
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    style={{ borderColor: BORDER }}
                    disabled={page <= 1}
                    onClick={() => setHatchPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} /> Prev
                  </Button>
                  <span style={{ color: MUTED }}>
                    Page {page} of {hatchPages}
                  </span>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    style={{ borderColor: BORDER }}
                    disabled={page >= hatchPages}
                    onClick={() => setHatchPage((p) => Math.min(hatchPages, p + 1))}
                  >
                    Next <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Raw readings modal */}
      <Dialog open={readingsOpen} onOpenChange={setReadingsOpen}>
        <DialogContent className="rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Baloo 2, sans-serif" }}>
              Raw readings — {unit.name}
            </DialogTitle>
            <DialogDescription>
              {singleReadings.length} data points for {ranges.find((r) => r.key === range)!.label.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>
          <div className="mb-3 flex justify-end">
            <Button className="rounded-xl" style={{ backgroundColor: RUST }} onClick={exportCsv}>
              <Download size={16} /> Export as CSV
            </Button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto rounded-2xl border" style={{ borderColor: BORDER }}>
            <Table>
              <TableHeader className="sticky top-0 z-10" style={{ backgroundColor: "#F2EEE5" }}>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Temperature</TableHead>
                  <TableHead className="text-right">Humidity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {singleReadings.map((p) => (
                  <TableRow key={p.ts}>
                    <TableCell style={{ color: MUTED }}>{new Date(p.ts).toLocaleString()}</TableCell>
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
        <div className="flex items-center gap-2" style={{ color: MUTED, fontSize: 13, fontWeight: 600 }}>
          <Icon size={16} /> {label}
        </div>
        <div
          className="mt-2 tracking-tight"
          style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 22, fontWeight: 800, color: accent ?? TEXT, whiteSpace: "nowrap" }}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
