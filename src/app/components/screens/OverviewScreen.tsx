import { useMemo } from "react";
import {
  Layers,
  Egg,
  Clock,
  Percent,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import {
  Incubator,
  Mode,
  UnitStatus,
  hatchHistory,
} from "../../data/mockData";

interface Props {
  units: Incubator[];
  modes: Mode[];
  onOpenUnit: (id: string) => void;
  onManageAll: () => void;
}

// ── Design tokens ───────────────────────────────────────────────────────────
const RUST = "#AD3A1D";
const CARD = "#F9F6F0";
const BORDER = "#E8E2D5";
const TEXT = "#2D241E";
const MUTED = "#5A4838";
const OK = "#16A34A";
const HEADING = "#1C1917";

// Nominal tray capacity per species mode — used to estimate total eggs on set.
const EGGS_PER_MODE: Record<string, number> = {
  broiler: 42,
  duck: 32,
  quail: 60,
  goose: 24,
  turkey: 30,
  pheasant: 40,
  peafowl: 24,
  swan: 16,
  "broiler-hh": 42,
  "rapid-quail": 60,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: CARD,
  borderColor: BORDER,
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};

function KpiCard({
  Icon,
  label,
  value,
  accent = RUST,
}: {
  Icon: typeof Layers;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden" style={{ ...cardStyle, height: "5.625rem" }}>
      {/* Decorative watermark — cropped, tilted, low-opacity so text stays legible. */}
      <Icon
        aria-hidden
        className="pointer-events-none absolute -bottom-3 -right-3"
        style={{ width: 80, height: 80, color: RUST, opacity: 0.07, transform: "rotate(-12deg)" }}
        strokeWidth={1.5}
      />
      <CardContent className="relative flex h-full flex-col justify-center p-4">
        <div
          style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          {label}
        </div>
        <div
          className="mt-1 truncate"
          style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 22, fontWeight: 800, color: TEXT, lineHeight: 1.1, whiteSpace: "nowrap" }}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

// Ring stroke by chamber health.
const ringColors: Record<UnitStatus, string> = {
  optimal: "#059669",
  warning: "#D97706",
  alert: RUST,
};

/**
 * Minimal progress card: chamber name over its day count, then a single 120px
 * progress ring holding only the completion percentage. Status is carried by
 * the ring stroke alone — no pills, no sensor readings.
 */
function MiniCard({ unit, mode, onOpen }: { unit: Incubator; mode: Mode; onOpen: (id: string) => void }) {
  const pct = Math.min(100, Math.round((unit.dayOfIncubation / mode.incubationDays) * 100));
  const stroke = ringColors[unit.status];
  const size = 120;
  const width = 10;
  const r = (size - width) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <button
      onClick={() => onOpen(unit.id)}
      className="flex w-full flex-col items-center rounded-2xl border transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ backgroundColor: "#FFFFFF", borderColor: BORDER, borderRadius: 16, height: 200, padding: 14 }}
      title={`${unit.name} · Day ${unit.dayOfIncubation} of ${mode.incubationDays}`}
    >
      {/* Top-left header stack — name over day progress. */}
      <div className="w-full min-w-0 text-left">
        <span className="block min-w-0 truncate" style={{ fontSize: 16, fontWeight: 700, color: TEXT, whiteSpace: "nowrap" }}>
          {unit.name}
        </span>
        <span className="block min-w-0 truncate" style={{ fontSize: 13, color: MUTED, whiteSpace: "nowrap", marginTop: 2 }}>
          Day {unit.dayOfIncubation} of {mode.incubationDays}
        </span>
      </div>

      {/* Center body — the ring */}
      <div className="relative mt-2 flex min-h-0 flex-1 items-center justify-center">
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
            style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 30, fontWeight: 800, color: stroke, lineHeight: 1 }}
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
    const connected = units.filter((u) => u.paired).length;
    const totalEggs = units.reduce((s, u) => s + (EGGS_PER_MODE[u.modeId] ?? 30), 0);
    const modesInUse = Array.from(new Set(units.map((u) => modeOf(u.modeId).name)));

    // Chamber closest to hatching (fewest days remaining).
    const withRemaining = units
      .map((u) => {
        const m = modeOf(u.modeId);
        return { u, m, remaining: m.incubationDays - u.dayOfIncubation };
      })
      .sort((a, b) => a.remaining - b.remaining);
    const nextHatch = withRemaining[0];

    // Power infrastructure breakdown.
    const grid = units.filter((u) => u.powerSource === "grid").length;
    const solar = units.filter((u) => u.powerSource === "solar").length;
    const batteryUnits = units.filter((u) => u.powerSource === "battery");

    return {
      optimal: count("optimal"),
      warning: count("warning"),
      alert: count("alert"),
      connected,
      totalEggs,
      modesInUse,
      nextHatch,
      grid,
      solar,
      batteryUnits,
    };
  }, [units, modes]);

  // Priority action items, drawn from real chamber issues (alerts first).
  // Overview shows only the 4 highest-priority incubators (Alert → Attention → Optimal).
  const priorityUnits = useMemo(() => {
    const rank = { alert: 0, warning: 1, optimal: 2 } as const;
    return [...units].sort((a, b) => rank[a.status] - rank[b.status]).slice(0, 4);
  }, [units]);

  const nextRemaining = stats.nextHatch?.remaining ?? 0;
  const hatchValue =
    nextRemaining <= 0 ? "Now" : nextRemaining === 1 ? "~24 Hours" : `${nextRemaining} Days`;

  // Average hatch rate across all completed cycles.
  const avgHatchRate = useMemo(() => {
    const totals = hatchHistory.reduce(
      (a, r) => ({ eggs: a.eggs + r.totalEggs, hatched: a.hatched + r.hatchedEggs }),
      { eggs: 0, hatched: 0 },
    );
    return totals.eggs > 0 ? (totals.hatched / totals.eggs) * 100 : 0;
  }, []);

  return (
    <div className="flex flex-col" style={{ gap: 32 }}>
      {/* Section 2: executive KPI summary — strict 1-row compact cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Layers reads as stacked multi-tier incubator cabinets. */}
        <KpiCard Icon={Layers} accent={RUST} label="Incubators" value={`${units.length} Active`} />
        <KpiCard Icon={Egg} accent={RUST} label="Total Capacity" value={`${stats.totalEggs} Eggs`} />
        <KpiCard Icon={Clock} accent={OK} label="Upcoming Hatch" value={hatchValue} />
        <KpiCard Icon={Percent} accent={OK} label="Avg Hatch Rate" value={`${avgHatchRate.toFixed(1)}%`} />
      </div>

      {/* Section 3: chamber status grid, wrapped in one white container */}
      <section
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #EAE7E1", borderRadius: 16, padding: 24 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: HEADING }}>Active Incubators</h2>
          <button
            onClick={onManageAll}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ color: RUST, fontWeight: 600 }}
          >
            View All Incubators ({units.length}) <ArrowRight size={15} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {priorityUnits.map((u) => (
            <MiniCard key={u.id} unit={u} mode={modeOf(u.modeId)} onOpen={onOpenUnit} />
          ))}
        </div>
      </section>

    </div>
  );
}
