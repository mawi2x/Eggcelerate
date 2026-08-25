import { useMemo } from "react";
import {
  Layers,
  Egg,
  Clock,
  TriangleAlert,
  Check,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import {
  Incubator,
  Mode,
  UnitStatus,
} from "../../data/mockData";

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
.condition-row:hover{background:#FFF7ED;border-color:#E7D0B8}
`;

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--surface-subtle)",
  borderColor: "var(--border-default)",
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};

interface KpiPill { text: string; tone: "neutral" | "positive" | "negative" | "warning" }
interface KpiFooter { primary: string; secondary?: string }

function KpiCard({ Icon, label, value, pill, footer }: {
  Icon: typeof Layers; label: string; value: string; pill?: KpiPill; footer?: KpiFooter
}) {
  return (
    <Card className="relative overflow-hidden" style={{ ...cardStyle, height: pill || footer ? "6.75rem" : "5.625rem" }}>
      {/* Decorative watermark — cropped, tilted, low-opacity so text stays legible. */}
      <Icon
        aria-hidden
        className="pointer-events-none absolute -bottom-3 -right-3"
        style={{ width: 80, height: 80, color: "var(--brand-primary)", opacity: 0.07, transform: "rotate(-12deg)" }}
        strokeWidth={1.5}
      />
      <CardContent className="relative flex h-full flex-col justify-center p-4">
        <div
          style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}
        >
          {label}
        </div>
        <div
          className="mt-1 truncate"
          style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, whiteSpace: "nowrap" }}
        >
          {value}
        </div>
        {pill && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: pill.tone === "neutral" ? "var(--status-info-bg)" : pill.tone === "positive" ? "var(--status-success-bg)" : pill.tone === "negative" ? "var(--status-danger-bg)" : "var(--status-warning-bg)",
                  color: pill.tone === "neutral" ? "var(--status-info-fg)" : pill.tone === "positive" ? "var(--status-success-fg)" : pill.tone === "negative" ? "var(--status-danger-fg)" : "var(--status-warning-fg)",
                  borderColor: "var(--border-default)"
                }}>
            {pill.tone === "positive" && "↗"} {pill.tone === "negative" && "↘"} {pill.text}
          </span>
        )}
        {footer && (
          <div className="mt-2">
            <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>{footer.primary}</div>
            {footer.secondary && <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{footer.secondary}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Ring stroke — progress-only (not health). Single soft clay from primary #AD3A1D.
const PROGRESS_STROKE = "#C27B4A";

type OffTargetDir = "high" | "low" | "ok";

interface OffTargetEntry {
  unit: Incubator;
  mode: Mode;
  dev: number;
  dir: OffTargetDir;
  value: number;
  target: { min: number; max: number };
}

function getTempOff(unit: Incubator, mode: Mode): Omit<OffTargetEntry, "unit" | "mode"> {
  const v = unit.temp;
  const { min, max } = mode.targetTemp;
  if (v < min) return { dev: min - v, dir: "low", value: v, target: mode.targetTemp };
  if (v > max) return { dev: v - max, dir: "high", value: v, target: mode.targetTemp };
  return { dev: 0, dir: "ok", value: v, target: mode.targetTemp };
}

function getHumidityOff(unit: Incubator, mode: Mode): Omit<OffTargetEntry, "unit" | "mode"> {
  const v = unit.humidity;
  const { min, max } = mode.targetHumidity;
  if (v < min) return { dev: min - v, dir: "low", value: v, target: mode.targetHumidity };
  if (v > max) return { dev: v - max, dir: "high", value: v, target: mode.targetHumidity };
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
  const displayValue = kind === "temp" ? value.toFixed(1) : Math.round(value).toString();
  const delta = dev.toFixed(kind === "temp" ? 1 : 0);

  let statusText: string;
  if (!isOff) statusText = "Within target";
  else if (kind === "temp") statusText = dir === "high" ? `Too warm by ${delta}°C` : `Too cool by ${delta}°C`;
  else statusText = dir === "high" ? `Too humid by ${delta}%` : `Too dry by ${delta}%`;

  const isUrgent = isOff && (kind === "temp" ? dev >= 1.5 : dev >= 10);
  const valueColor = !isOff ? "var(--text-primary)" : isUrgent ? "var(--status-danger-fg)" : "#9A4A2A";
  const statusColor = !isOff ? "#6B7280" : isUrgent ? "var(--status-danger-fg)" : "#C2410C";

  return (
    <>
      <style>{conditionRowStyle}</style>
      <button
        onClick={() => onOpen(unit.id)}
        className="condition-row group flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2"
        title={`${unit.name} · ${displayValue}${unitLabel}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{
              backgroundColor: isOff ? (isUrgent ? "#FEE2E2" : "#FDF0E6") : "#F0FDF4",
              color: isOff ? (isUrgent ? "var(--status-danger-fg)" : "#9A4A2A") : "var(--status-success-fg)",
              border: `1px solid ${isOff ? (isUrgent ? "#FECACA" : "#E8D5C2") : "#BBF7D0"}`,
            }}
          >
            {rank}
          </span>
          <div className="min-w-0">
            <div className="truncate" style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
              {unit.name}
            </div>
            <div className="truncate" style={{ fontSize: 11, fontWeight: 500, color: "#6E6259" }}>
              {mode.name}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex flex-col items-end gap-0.5">
            <span style={{ fontSize: 13, fontWeight: 700, color: valueColor, whiteSpace: "nowrap" }}>
              {displayValue}{unitLabel}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: statusColor, whiteSpace: "nowrap", lineHeight: 1.2 }}>
              {statusText}
            </span>
          </div>
          <ChevronRight
            size={14}
            className="shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            style={{ color: "#C27B4A" }}
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
function MiniCard({ unit, mode, onOpen }: { unit: Incubator; mode: Mode; onOpen: (id: string) => void }) {
  const pct = Math.min(100, Math.round((unit.dayOfIncubation / mode.incubationDays) * 100));
  const stroke = PROGRESS_STROKE;
  const size = 88;
  const width = 10;
  const r = (size - width) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <button
      onClick={() => onOpen(unit.id)}
      className="group flex w-full cursor-pointer flex-col items-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 text-left transition-colors duration-200 hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      title={`${unit.name} · Day ${unit.dayOfIncubation} of ${mode.incubationDays} — click to view`}
    >
      {/* Top-left header stack — name over mode over progress. */}
      <div className="w-full min-w-0 text-left">
        <div className="flex items-start justify-between gap-2">
          <span className="block min-w-0 flex-1 truncate" style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
            {unit.name}
          </span>
          <ChevronRight size={14} className="mt-1 shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ color: "#C27B4A" }} aria-hidden />
        </div>
        <span className="block min-w-0 truncate" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", marginTop: 4 }}>
          {mode.name}
        </span>
        <span className="block min-w-0 truncate" style={{ fontSize: 12, fontWeight: 400, color: "#6E6259", whiteSpace: "nowrap", marginTop: 4 }}>
          Progress: Day {unit.dayOfIncubation} of {mode.incubationDays}
        </span>
      </div>

      {/* Center body — the ring */}
      <div className="relative mt-3 flex min-h-0 items-center justify-center">
        <svg
          width={size}
          height={size}
          role="img"
          aria-label={`Cycle progress ${pct}%, day ${unit.dayOfIncubation} of ${mode.incubationDays}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BORDER} strokeWidth={width} />
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
            className="tracking-tight"
            style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 17, fontWeight: 700, color: stroke, lineHeight: 1 }}
          >
            {pct}%
          </span>
        </div>
      </div>
    </button>
  );
}

export function OverviewScreen({ units, modes, onOpenUnit, onManageAll }: Props) {
  const modeOf = (id: string) => modes.find((m) => m.id === id) ?? modes[0];

  const stats = useMemo(() => {
    const count = (s: UnitStatus) => units.filter((u) => u.status === s).length;
    const connected = units.filter((u) => u.paired && u.connectionState === "connected").length;
    const totalEggs = units.reduce((s, u) => s + (u.totalEggsLoaded ?? 0), 0);
    const modesInUse = Array.from(new Set(units.map((u) => modeOf(u.modeId).name)));

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
  }, [units, modes]);

  // Priority action items, drawn from real chamber issues (alerts first).
  // Overview shows only the 4 highest-priority incubators (Alert → Attention → Optimal).
  const priorityUnits = useMemo(() => {
    const rank = { alert: 0, warning: 1, optimal: 2 } as const;
    return [...units].sort((a, b) => rank[a.status] - rank[b.status]).slice(0, 4);
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
  }, [units, modes]);

  const nextRemaining = stats.nextHatch?.remaining ?? 0;
  const hatchValue =
    nextRemaining <= 0 ? "Now" : nextRemaining === 1 ? "~24 Hours" : `${nextRemaining} Days`;

  return (
    <div className="flex flex-col" style={{ gap: 32 }}>
      {/* Section 2: executive KPI summary — strict 1-row compact cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Layers reads as stacked multi-tier incubator cabinets. */}
        <KpiCard Icon={Layers} label="INCUBATORS" value={`${units.length} Active`} />
        <KpiCard Icon={Egg} label="EGGS INCUBATING" value={`${stats.totalEggs} Eggs`} />
        <KpiCard Icon={Clock} label="UPCOMING HATCH" value={hatchValue} />
        <KpiCard Icon={TriangleAlert} label="NEEDS ATTENTION" value={`${stats.needsAttention}`} />
      </div>

      {/* Section 3: chamber status grid, wrapped in one white container */}
      <section
        style={{ backgroundColor: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 24 }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: HEADING }}>Active Incubators</h2>
            <p style={{ fontSize: 12, fontWeight: 400, color: "#6E6259", marginTop: 2 }}>Chambers currently running.</p>
          </div>
          <button
            onClick={onManageAll}
            className="inline-flex shrink-0 cursor-pointer items-center rounded-xl border bg-white px-4 py-2 text-sm transition-colors duration-200 hover:bg-[#FFF7ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ borderColor: RUST, color: RUST, fontWeight: 600 }}
          >
            View All Incubators
          </button>
        </div>
        <div className="my-4 h-px w-full" style={{ backgroundColor: "#EFE9DC" }} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {priorityUnits.map((u) => (
            <MiniCard key={u.id} unit={u} mode={modeOf(u.modeId)} onOpen={onOpenUnit} />
          ))}
        </div>
      </section>

      {/* Section 4: Conditions to Check — 1 container, 2 columns inside, ranked by deviation */}
      <section
        style={{ backgroundColor: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 24 }}
      >
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: HEADING }}>Conditions to Check</h2>
          <p style={{ fontSize: 12, fontWeight: 400, color: "#6E6259", marginTop: 2 }}>
            Incubators with temperature or humidity that may need attention.
          </p>
        </div>
        <div className="mb-4 h-px w-full" style={{ backgroundColor: "#EFE9DC" }} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left column: temperature */}
          <div className="min-w-0">
            <div className="mb-3">
              <h3 style={{ fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                Temperature
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {offTarget.temp.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border px-3 py-4" style={{ borderColor: BORDER, backgroundColor: "#FBFAF7" }}>
                  <Check size={16} style={{ color: "var(--status-success-fg)" }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>All temperatures within target</span>
                </div>
              ) : (
                offTarget.temp.map((entry, idx) => (
                  <OffTargetRow key={entry.unit.id} entry={entry} kind="temp" rank={idx + 1} onOpen={onOpenUnit} />
                ))
              )}
            </div>
          </div>

          {/* Divider for mobile */}
          <div className="h-px w-full lg:hidden" style={{ backgroundColor: "#F2EEE5" }} />

          {/* Right column: humidity */}
          <div className="min-w-0">
            <div className="mb-3">
              <h3 style={{ fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                Humidity
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {offTarget.humidity.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border px-3 py-4" style={{ borderColor: BORDER, backgroundColor: "#FBFAF7" }}>
                  <Check size={16} style={{ color: "var(--status-success-fg)" }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>All humidity levels within target</span>
                </div>
              ) : (
                offTarget.humidity.map((entry, idx) => (
                  <OffTargetRow key={entry.unit.id} entry={entry} kind="humidity" rank={idx + 1} onOpen={onOpenUnit} />
                ))
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
