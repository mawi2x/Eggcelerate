import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  RotateCw, Clock, Check, CheckCircle2, Circle, AlertCircle, Calendar, X,
  Waves, Droplet, Wifi, WifiOff,
  Flame, Fan, Camera, Egg, Plus,
  Activity, ScanSearch, Settings2, Zap, ShieldAlert,
  ChevronLeft, ChevronRight, Download, Trash2, Pencil,
  Maximize2, Minimize2, ZoomIn, ZoomOut, Maximize,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { GaugeDial } from "../GaugeDial";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../ui/dialog";
import { cn } from "../ui/utils";
import { TrayFertilityBar, fertilityTones } from "../candling/EggIcons";
import {
  Incubator, Mode, CandlingLogEntry, CandlingCheckpoint, DevelopmentCheck, developmentCheckLabels,
  computeCandling, waterState, getWaterStatusInfo,
} from "../../data/mockData";

// ─── Types ────────────────────────────────────────────────────────────────────
type DetailTab = "monitor" | "candling" | "settings";
type MarkerStatus = "logged" | "due" | "upcoming";

interface CandleForm {
  targetDay: number;
  date: string;
  note: string;
  photos: string[];
  /** Straight tally inputs — no per-egg tray map. */
  fertile: number;
  clear: number;
  uncertain: number;
  checks: DevelopmentCheck[];
}

// ─── Design tokens ──────────────────────────────────────────────────────────────
const RUST = "#AD3A1D";
// Milestone nodes use the lighter burnt orange so they read on the rust bar.
const RUST_NODE = "#C85A32";
const BG = "#FBFAF7";
const CARD = "#F9F6F0";
const SURFACE = "#FFFFFF";
const BORDER = "#E8E2D5";
const TEXT = "#2D241E";
const MUTED = "#5A4838";
const INPUT_BORDER = "#D8D0C0";
const RADIUS = 16;
const SHADOW = "0 2px 12px rgba(0,0,0,0.04)";

// Semantic status tokens (all WCAG AA on their bg).
const OK = { fg: "#16A34A", bg: "#DCFCE7", ring: "#16A34A" };
const WARN = { fg: "#D97706", bg: "#FEF3C7", ring: "#D97706" };
const CRIT = { fg: "#DC2626", bg: "#FEE2E2", ring: "#DC2626" };
const NEUTRAL = { fg: MUTED, bg: "#EFE9DC", ring: "#C9BEA8" };

// Short checkpoint captions shared by the horizontal and vertical timelines.
const CANDLE_SHORT_LABELS = ["1st Candling", "2nd Candling", "Lockdown"];

// Upload guards for candling photos.
const MAX_PHOTOS = 9;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const NOTES_MAX = 500;

// Nominal tray capacity per species mode — total eggs set.
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const formatNodeDay = (day: number) => String(day > 99 ? 99 : day).slice(0, 3);

function formatDisplayDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formatted = `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const isToday = dateStr === todayStr();
  return isToday ? `Today (${formatted})` : formatted;
}

const emptyForm = (day: number): CandleForm => ({
  targetDay: day, date: todayStr(), note: "", photos: [], fertile: 0, clear: 0, uncertain: 0, checks: [],
});

function markerStatus(day: number, currentDay: number, logged: boolean): MarkerStatus {
  if (logged) return "logged";
  if (day <= currentDay) return "due";
  return "upcoming";
}
function dayFraction(day: number, total: number) {
  return total <= 1 ? 0 : (day - 1) / (total - 1);
}
function relTime(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  const h = Math.floor(diff / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
// Stable pseudo-time derived from the date string so journal timestamps render
// a realistic 12-hour time without storing one. Inspections fall in 8 AM – 6 PM.
function pseudoTime(d: string) {
  let h = 0;
  for (const c of d) h = (h * 31 + c.charCodeAt(0)) % 1000;
  const hour = 8 + (h % 10);
  const minute = h % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function fmtTimestamp(d: string) {
  const date = fmtDate(d);
  const time = new Date(`${d}T${pseudoTime(d)}:00`).toLocaleTimeString([], {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
  return `${date} • ${time}`;
}

// ─── Semantic status pill ─────────────────────────────────────────────────────
function StatusPill({ tone, children, dot = true, pulse = false }: {
  tone: typeof OK; children: React.ReactNode; dot?: boolean; pulse?: boolean;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ backgroundColor: tone.bg, color: tone.fg, fontSize: 12, fontWeight: 700 }}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${pulse ? "animate-pulse" : ""}`}
          style={{ backgroundColor: tone.fg }}
        />
      )}
      {children}
    </span>
  );
}

// ─── Shared card shell ────────────────────────────────────────────────────────
function SectionCard({ title, subtitle, action, children, centered = false }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; centered?: boolean;
}) {
  return (
    <Card style={{ backgroundColor: "#FFFFFF", border: "1px solid #EAE7E1", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <CardContent className="p-5">
        <div
          className="mb-4 flex flex-wrap items-center gap-3 min-h-[32px]"
          style={centered ? { justifyContent: "center", textAlign: "center" } : { justifyContent: "space-between" }}
        >
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1C1917" }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 12, color: MUTED }}>{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// White inner tile shell.
function InnerTile({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: tone ? `${tone}0D` : SURFACE,
        border: `1px solid ${tone ? `${tone}40` : BORDER}`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Mini incubation calendar ─────────────────────────────────────────────────
// Design anchor: cycle Day 1 = Aug 5, 2026, so Day 6 = Aug 10, Day 13 = Aug 17,
// Day 18 = Aug 22, Day 21 = Aug 25 — all within the August 2026 default view.
const CYCLE_START = new Date(2026, 7, 5);
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAY_HEADS = ["S", "M", "T", "W", "T", "F", "S"];

function MiniIncubationCalendar({ currentDay, totalDays, candling }: {
  currentDay: number; totalDays: number; candling: CandlingCheckpoint[];
}) {
  const [view, setView] = useState(() => {
    const today = new Date(CYCLE_START);
    today.setDate(today.getDate() + Math.max(0, currentDay - 1));
    return { y: today.getFullYear(), m: today.getMonth() };
  });

  const dayOffset = (day: number) => {
    const d = new Date(CYCLE_START);
    d.setDate(d.getDate() + day - 1);
    return d;
  };

  const candleDay = candling[1]?.day ?? 13;
  const lockdownDay = candling[2]?.day ?? 18;
  const todayDate = dayOffset(currentDay);

  const first = new Date(view.y, view.m, 1);
  const lead = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  // Always render 6 rows (42 slots) so the card height never shifts between
  // months; short months spill into trailing muted days of the next month.
  const trailingCount = 42 - lead - daysInMonth;

  const milestoneFor = (d: Date) => {
    if (d.toDateString() === todayDate.toDateString()) return { kind: "today", label: `Day ${currentDay} · Today` };
    if (d.toDateString() === dayOffset(candleDay).toDateString()) return { kind: "candling", label: `Day ${candleDay} · 2nd Candling` };
    if (d.toDateString() === dayOffset(lockdownDay).toDateString()) return { kind: "lockdown", label: `Day ${lockdownDay} · Lockdown` };
    if (d.toDateString() === dayOffset(totalDays).toDateString()) return { kind: "hatch", label: `Day ${totalDays} · Expected Hatch` };
    return null;
  };

  const cells: ({ day: number; date: Date; trailing: boolean } | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1, date: new Date(view.y, view.m, i + 1), trailing: false,
    })),
    ...Array.from({ length: trailingCount }, (_, i) => ({
      day: i + 1, date: new Date(view.y, view.m + 1, i + 1), trailing: true,
    })),
  ];

  const shiftMonth = (delta: number) =>
    setView(({ y, m }) => {
      const next = new Date(y, m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });

  return (
    <SectionCard title="Incubation Calendar" centered>
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-center gap-2">
        <button
          onClick={() => shiftMonth(-1)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[#A8A29E] transition-colors hover:bg-[#F5EFE6] hover:text-[#C85A32]"
          aria-label="Previous month"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-center" style={{ minWidth: 118, fontSize: 14, fontWeight: 600, color: TEXT }}>
          {MONTH_NAMES[view.m]} {view.y}
        </span>
        <button
          onClick={() => shiftMonth(1)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[#A8A29E] transition-colors hover:bg-[#F5EFE6] hover:text-[#C85A32]"
          aria-label="Next month"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_HEADS.map((w, i) => (
          <div key={i} className="text-center" style={{ fontSize: 10, fontWeight: 700, color: "#A8A29E" }}>{w}</div>
        ))}
      </div>

      {/* Day grid — fixed 6 rows, trailing days muted */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (c === null) return <div key={i} />;
          const m = c.trailing ? null : milestoneFor(c.date);
          return (
            <div key={i} className="flex flex-col items-center justify-center" style={{ height: 38 }} title={m?.label}>
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 28,
                  height: 28,
                  fontSize: 12,
                  boxSizing: "border-box",
                  fontWeight: m?.kind === "today" ? 700 : 500,
                  backgroundColor: m?.kind === "today" ? "#8B3A1C" : "transparent",
                  color: m?.kind === "today" ? "#FFFFFF" : m ? TEXT : "#78716C",
                  border: m?.kind === "candling" ? "2px solid #F2C94C" : undefined,
                  ...(c.trailing ? { color: "#D1C7BD", opacity: 0.4 } : {}),
                }}
              >
                {c.day}
              </span>
              {m?.kind === "today" ? (
                <span className="mt-0.5" style={{ fontSize: 8, fontWeight: 700, color: "#8B3A1C" }}>
                  Day {currentDay}
                </span>
              ) : m?.kind === "candling" ? (
                <span className="mt-1 rounded-full" style={{ width: 5, height: 5, backgroundColor: "#F2C94C" }} />
              ) : m?.kind === "lockdown" ? (
                <span className="mt-1 rounded-full" style={{ width: 5, height: 5, backgroundColor: "#D97706" }} />
              ) : m?.kind === "hatch" ? (
                <Egg size={9} color="#16A34A" className="mt-0.5" />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* One-line legend */}
      <div className="mt-3 flex items-center justify-center gap-x-2 whitespace-nowrap border-t pt-2.5" style={{ borderColor: "#EFE9DC" }}>
        {[
          { swatch: <span className="rounded-sm" style={{ width: 9, height: 9, backgroundColor: "#8B3A1C" }} />, label: "Today" },
          { swatch: <span className="rounded-full" style={{ width: 9, height: 9, border: "2px solid #F2C94C", boxSizing: "border-box" }} />, label: "2nd Candling" },
          { swatch: <span className="rounded-full" style={{ width: 9, height: 9, backgroundColor: "#D97706" }} />, label: "Lockdown" },
          { swatch: <Egg size={10} color="#16A34A" />, label: "Hatch" },
        ].map((l) => (
          <span key={l.label} className="flex select-none items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: "#78716C" }}>
            {l.swatch} {l.label}
          </span>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Actuator row ─────────────────────────────────────────────────────────────
function ActuatorRow({ icon, name, sub, on, tone, label, offLabel, pulse = false }: {
  icon: React.ReactNode; name: string; sub: string;
  on: boolean; tone: typeof OK; label: string; offLabel: string; pulse?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-3.5"
      style={{
        backgroundColor: on ? tone.bg : SURFACE,
        border: `1px solid ${on ? `${tone.fg}33` : BORDER}`,
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: on ? "#FFFFFF" : "#F3ECDD", color: on ? tone.fg : "#9E8B72" }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{name}</p>
        <p style={{ color: MUTED, fontSize: 12 }}>{sub}</p>
      </div>
      {on
        ? <StatusPill tone={tone} pulse={pulse}>{label}</StatusPill>
        : <StatusPill tone={NEUTRAL}>{offLabel}</StatusPill>}
    </div>
  );
}

// ─── Count badge (candling breakdown) ──────────────────────────────────────────
function CountBadge({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value: number; tone: typeof OK;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: tone.bg, border: `1px solid ${tone.fg}2E` }}>
      <span style={{ color: tone.fg }}>{icon}</span>
      <div>
        <p style={{ fontSize: 17, fontWeight: 700, color: tone.fg, fontFamily: "Baloo 2, sans-serif", lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 11, color: MUTED }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Sub-tab nav ─────────────────────────────────────────────────────────────
function SubTabNav({ active, onChange }: { active: DetailTab; onChange: (t: DetailTab) => void }) {
  const tabs: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    { id: "monitor",  label: "Live Monitor",           icon: <Activity size={15} /> },
    { id: "candling", label: "Candling & Inspection",  icon: <ScanSearch size={15} /> },
    { id: "settings", label: "Device Settings",        icon: <Settings2 size={15} /> },
  ];
  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-3 self-start"
      style={{ backgroundColor: "#F4ECE1", borderRadius: 9999, padding: 4 }}
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className="flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              backgroundColor: isActive ? "#FFFFFF" : "transparent",
              boxShadow: isActive ? "0px 2px 6px rgba(0,0,0,0.05)" : "none",
              color: isActive ? "#8B3A1C" : "#6E5E53",
              fontWeight: 500,
              fontSize: 13,
              borderRadius: 9999,
              padding: "12px 16px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.icon} {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Timeline (shared) ────────────────────────────────────────────────────────
function Timeline({ currentDay, totalDays, candling, candled }: {
  currentDay: number; totalDays: number;
  candling: { day: number; label: string }[];
  candled: Record<number, boolean>;
}) {
  const fillPct = dayFraction(currentDay, totalDays) * 100;
  const NODE = 28;
  return (
    <div>
      <div className="relative mx-1" style={{ paddingTop: 56, paddingBottom: 62 }}>
        {/* Track frame — the axis line, centered vertically in the container.
            It is the positioning context for the "Today" badge (bottom: 100%)
            and the milestone labels (top: 100%). */}
        <div
          className="absolute left-0 right-0"
          style={{ height: 6, top: "50%", transform: "translateY(-50%)" }}
        >
          {/* Track line (6px stroke) + progress fill. */}
          <div className="absolute inset-0 rounded-full" style={{ backgroundColor: "#ECE6D9" }} />
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fillPct}%`, backgroundColor: RUST }} />

          {/* Layer 1 — "Today" badge. bottom: 100% parks its pointer tip on the
              top edge of the track; the 14px pointer keeps the pill body fully
              above the 28px nodes (which reach 14px above the axis). */}
          <div
            className="absolute flex flex-col items-center"
            style={{
              left: `clamp(28px, ${fillPct}%, calc(100% - 28px))`,
              bottom: "100%",
              transform: "translateX(-50%)",
              zIndex: 30,
            }}
          >
            <span
              className="whitespace-nowrap rounded-full px-2.5 py-0.5"
              style={{ fontSize: 11, fontWeight: 800, backgroundColor: RUST, color: "#fff", boxShadow: "0 2px 6px rgba(173,58,29,0.28)" }}
            >
              Today
            </span>
            {/* Stem + ▼ triangle; the tip touches the top of the track line. */}
            <svg width={10} height={14} viewBox="0 0 10 14" style={{ display: "block" }} aria-hidden>
              <path d="M5 2 L5 7" stroke={RUST} strokeWidth={2} strokeLinecap="round" />
              <path d="M1.5 6 L8.5 6 L5 12.5 Z" fill={RUST} />
            </svg>
          </div>

          {/* Layer 3 — milestone labels, 12px below the track line. */}
          {candling.map((c, i) => {
            const pct = dayFraction(c.day, totalDays) * 100;
            const status = markerStatus(c.day, currentDay, !!candled[c.day]);
            const filled = status !== "upcoming";
            return (
              <span
                key={c.day}
                className="absolute flex flex-col items-center whitespace-nowrap"
                style={{ left: `${pct}%`, top: "calc(100% + 12px)", transform: "translateX(-50%)", zIndex: 5 }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#78716C" }}>
                  {CANDLE_SHORT_LABELS[i] ?? c.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#78716C" }}>
                  DAY {c.day}
                </span>
              </span>
            );
          })}
        </div>

        {/* Layer 2 — milestone nodes, centered on the track line. */}
        {candling.map((c, i) => {
          const pct = dayFraction(c.day, totalDays) * 100;
          const status = markerStatus(c.day, currentDay, !!candled[c.day]);
          // Past checkpoints read as filled; only future ones stay hollow.
          const filled = status !== "upcoming";
          return (
            <div
              key={c.day}
              className="absolute"
              style={{ left: `${pct}%`, top: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}
              title={`${c.label} — day ${c.day} — ${status}`}
            >
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: NODE,
                  height: NODE,
                  backgroundColor: filled ? RUST_NODE : "#FFFFFF",
                  border: `2px solid ${RUST_NODE}`,
                  color: filled ? "#FFFFFF" : RUST_NODE,
                  boxShadow: "0 0 0 3px #F9F6F0",
                }}
              >
                {status === "logged" ? (
                  <Check size={14} strokeWidth={3.2} />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{i + 1}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mx-1 flex justify-between" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#78716C" }}>
        <span>DAY 1</span>
        <span>DAY {totalDays}</span>
      </div>
    </div>
  );
}

// ─── Photo Lightbox Modal ───────────────────────────────────────────────────
const ZOOM_MIN = 25;
const ZOOM_MAX = 400;
const ZOOM_STEP = 25;

// One source of truth for the two viewer layouts — no stacked overrides.
// Width comes from DialogContent's `size` prop ("large" / "fullscreen").
const VIEWER_SHELL_CLASS =
  "border-none p-0 overflow-hidden shadow-2xl bg-[#141210]/95 backdrop-blur-xl text-white transition-all duration-300";
const VIEWER_SHELL_FULLSCREEN = "h-[88vh] grid-rows-[auto_1fr] gap-0 rounded-2xl";
const VIEWER_SHELL_NORMAL = "w-[92vw] rounded-3xl";
const VIEWER_VIEWPORT_CLASS =
  "relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden transition-all select-none";
const VIEWER_VIEWPORT_FULLSCREEN = "h-full w-full";
const VIEWER_VIEWPORT_NORMAL = "h-auto w-full min-h-[400px] max-h-[82vh] p-4 sm:p-6 bg-black/40";
const VIEWER_IMAGE_FULLSCREEN = "absolute left-1/2 top-1/2 block";
const VIEWER_IMAGE_NORMAL = "mx-auto block h-auto w-auto max-h-[65vh] max-w-full rounded-2xl shadow-2xl";

function PhotoLightboxModal({
  open,
  photos = [],
  initialIndex,
  day,
  onClose,
  onDelete,
}: {
  open: boolean;
  photos: string[];
  initialIndex: number;
  day: number;
  onClose: () => void;
  onDelete: (idx: number) => void;
}) {
  const safePhotos = (photos || []).filter((p) => typeof p === "string" && p.trim().length > 0);
  const total = safePhotos.length;
  const safeInitial = total > 0 ? Math.min(Math.max(0, initialIndex), total - 1) : 0;
  const [currentIndex, setCurrentIndex] = useState(safeInitial);
  const [fullscreen, setFullscreen] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Zoom state — 0 means "fit to screen", otherwise a percentage in [25, 400].
  const [zoom, setZoom] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const displayRef = useRef<HTMLDivElement>(null);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const s = total > 0 ? Math.min(Math.max(0, initialIndex), total - 1) : 0;
    setCurrentIndex(s);
    setFullscreen(false);
    setImgError(false);
    setZoom(0);
    setPan({ x: 0, y: 0 });
    setNatural({ w: 0, h: 0 });
  }, [initialIndex, open, total]);

  const safeIndex = total > 0 ? Math.min(Math.max(0, currentIndex), total - 1) : 0;
  const currentPhoto = safePhotos[safeIndex];

  // Keep the usable viewer size measured so the fit scale stays accurate.
  useEffect(() => {
    const el = displayRef.current;
    if (!el || !open) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setViewSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, fullscreen]);

  useEffect(() => {
    setImgError(false);
    setZoom(0);
    setPan({ x: 0, y: 0 });
    setNatural({ w: 0, h: 0 });
  }, [currentPhoto, safeIndex]);

  // Scale that fits the whole photo inside the viewer, preserving aspect ratio.
  const fitScale = useMemo(() => {
    if (viewSize.w <= 0 || viewSize.h <= 0 || natural.w <= 0 || natural.h <= 0) return 1;
    return Math.min(viewSize.w / natural.w, viewSize.h / natural.h);
  }, [viewSize, natural]);

  const scale = zoom === 0 ? fitScale : zoom / 100;
  const canPan = scale * natural.w > viewSize.w + 1 || scale * natural.h > viewSize.h + 1;

  const clampPan = useCallback((x: number, y: number) => {
    const ox = Math.max(0, (scale * natural.w - viewSize.w) / 2);
    const oy = Math.max(0, (scale * natural.h - viewSize.h) / 2);
    return { x: Math.min(ox, Math.max(-ox, x)), y: Math.min(oy, Math.max(-oy, y)) };
  }, [scale, natural, viewSize]);

  // Keep the pan inside bounds whenever the zoom level changes.
  useEffect(() => {
    setPan((p) => clampPan(p.x, p.y));
  }, [clampPan]);

  const fromFit = (z: number) => (z === 0 ? Math.round((fitScale * 100) / ZOOM_STEP) * ZOOM_STEP : z);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, fromFit(z) + ZOOM_STEP));
  }, [fitScale]);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, fromFit(z) - ZOOM_STEP));
  }, [fitScale]);

  const resetView = useCallback(() => {
    setZoom(0);
    setPan({ x: 0, y: 0 });
  }, []);

  // Mouse wheel zooms over the image area while fullscreen.
  useEffect(() => {
    const el = displayRef.current;
    if (!el || !open || !fullscreen) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, fullscreen, zoomIn, zoomOut]);

  const toggleFullscreen = () => {
    setFullscreen((f) => !f);
    setZoom(0);
    setPan({ x: 0, y: 0 });
  };

  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    setImgError(false);
    setCurrentIndex((i) => (i - 1 + total) % total);
  }, [total]);

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    setImgError(false);
    setCurrentIndex((i) => (i + 1) % total);
  }, [total]);

  const handleDownload = () => {
    if (!currentPhoto) return;
    const a = document.createElement("a");
    a.href = currentPhoto;
    a.download = `candling-day-${day}-photo-${safeIndex + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Photo downloaded");
  };

  const handleDeleteCurrent = () => {
    onDelete(safeIndex);
    if (total <= 1) {
      onClose();
    } else {
      setCurrentIndex((i) => (i >= total - 1 ? total - 2 : i));
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!canPan) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!dragging) return;
    setPan(
      clampPan(
        dragStart.current.px + (e.clientX - dragStart.current.x),
        dragStart.current.py + (e.clientY - dragStart.current.y),
      ),
    );
  };

  const onPointerEnd = () => setDragging(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-" || e.key === "_") zoomOut();
      if (e.key === "0") resetView();
      if (e.key === "Escape") {
        if (fullscreen) {
          setFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, fullscreen, handlePrev, handleNext, zoomIn, zoomOut, resetView, onClose]);

  if (!open || total === 0 || !currentPhoto) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        hideClose
        size={fullscreen ? "fullscreen" : "large"}
        className={cn(VIEWER_SHELL_CLASS, fullscreen ? VIEWER_SHELL_FULLSCREEN : VIEWER_SHELL_NORMAL)}
        style={{ border: "1px solid rgba(255,255,255,0.12)" }}
      >
        <DialogTitle className="sr-only">Candling Photo Viewer</DialogTitle>
        <DialogDescription className="sr-only">High resolution photo preview with download and navigation</DialogDescription>

        {/* Top Header Bar with Single Unified Close Button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 select-none">
          <span className="text-sm font-semibold text-stone-200">
            Photo {safeIndex + 1} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-stone-200 hover:text-white hover:bg-white/10 rounded-full h-8 px-3 text-xs gap-1.5"
              onClick={toggleFullscreen}
              title={fullscreen ? "Exit Fullscreen (Esc)" : "Enlarge / Fullscreen"}
            >
              {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {fullscreen ? "Exit Fullscreen" : "Enlarge"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-stone-200 hover:text-white hover:bg-white/10 rounded-full h-8 px-3 text-xs gap-1.5"
              onClick={handleDownload}
              title="Download photo"
            >
              <Download size={14} /> Download
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full h-8 px-3 text-xs gap-1.5"
              onClick={handleDeleteCurrent}
              title="Delete photo"
            >
              <Trash2 size={14} /> Delete
            </Button>
            <button
              onClick={onClose}
              className="ml-2 rounded-full p-1.5 text-stone-300 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2"
              aria-label="Close photo viewer"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main High-Resolution Photo Display Area */}
        <div
          ref={displayRef}
          className={cn(
            VIEWER_VIEWPORT_CLASS,
            fullscreen ? VIEWER_VIEWPORT_FULLSCREEN : VIEWER_VIEWPORT_NORMAL
          )}
        >
          {total > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-4 sm:left-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2"
              aria-label="Previous photo"
              title="Previous photo (←)"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {!imgError && currentPhoto ? (
            <img
              src={currentPhoto}
              alt={`Candling inspection photo ${safeIndex + 1}`}
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setImgError(true)}
              onPointerDown={fullscreen ? onPointerDown : undefined}
              onPointerMove={fullscreen ? onPointerMove : undefined}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              className={cn(fullscreen ? VIEWER_IMAGE_FULLSCREEN : VIEWER_IMAGE_NORMAL)}
              style={
                fullscreen
                  ? {
                      transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                      cursor: dragging ? "grabbing" : canPan ? "grab" : "default",
                      transition: dragging ? "none" : "transform 0.15s ease-out",
                      touchAction: "none",
                    }
                  : undefined
              }
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-white/5 border border-white/10 text-stone-300">
              <Camera size={48} className="mb-3 text-stone-400 opacity-70" />
              <p className="text-base font-semibold text-stone-200">Image could not be loaded</p>
              <p className="text-xs text-stone-400 mt-1">The photo format or source is unavailable</p>
            </div>
          )}

          {total > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-4 sm:right-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2"
              aria-label="Next photo"
              title="Next photo (→)"
            >
              <ChevronRight size={24} />
            </button>
          )}

          {/* Zoom controls — bottom-right, fullscreen only */}
          {fullscreen && (
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-full bg-black/60 py-1.5 pl-2 pr-1.5 backdrop-blur select-none">
              <button
                type="button"
                onClick={zoomOut}
                className="flex h-8 w-8 items-center justify-center rounded-full text-stone-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2"
                aria-label="Zoom out"
                title="Zoom out (-)"
              >
                <ZoomOut size={16} />
              </button>
              <span className="min-w-[54px] text-center text-xs font-semibold text-stone-200 tabular-nums">
                {zoom === 0 ? "Fit" : `${zoom}%`}
              </span>
              <button
                type="button"
                onClick={zoomIn}
                className="flex h-8 w-8 items-center justify-center rounded-full text-stone-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2"
                aria-label="Zoom in"
                title="Zoom in (+)"
              >
                <ZoomIn size={16} />
              </button>
              <span className="mx-1 h-4 w-px bg-white/20" aria-hidden />
              <button
                type="button"
                onClick={resetView}
                className="flex h-8 w-8 items-center justify-center rounded-full text-stone-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2"
                aria-label="Fit to screen"
                title="Fit to screen (0)"
              >
                <Maximize size={15} />
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Candling feed journal card ──────────────────────────────────────────────
function JournalEntryCard({
  entry,
  modeName,
  onAddPhotos,
  onUpdateNote,
  onDeletePhoto,
}: {
  entry: CandlingLogEntry;
  modeName: string;
  onAddPhotos: (day: number, urls: string[]) => void;
  onUpdateNote: (day: number, note: string) => void;
  onDeletePhoto: (day: number, photoIndex: number) => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const [noteDraft, setNoteDraft] = useState(entry.note);
  const [noteEdited, setNoteEdited] = useState(false);
  const [noteEditing, setNoteEditing] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const readFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: File[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" isn't an image — skipped`);
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`"${file.name}" is over 5 MB — skipped`);
        return;
      }
      accepted.push(file);
    });
    if (accepted.length === 0) return;
    const urls: string[] = [];
    let loaded = 0;
    accepted.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) urls.push(e.target.result as string);
        loaded++;
        if (loaded === accepted.length) onAddPhotos(entry.day, urls);
      };
      reader.readAsDataURL(file);
    });
  };

  const total = entry.fertile + entry.clear + entry.uncertain;
  const fertilePct = total > 0 ? `${((entry.fertile / total) * 100).toFixed(1)}%` : undefined;

  // Thumbnail grid calculation
  const photos = (entry.photos || []).filter((p) => typeof p === "string" && p.trim().length > 0);
  const hasOverflow = photos.length > 4;
  const visiblePhotos = hasOverflow ? photos.slice(0, 3) : photos.slice(0, 4);
  const overflowCount = photos.length - 3;

  return (
    <>
      <Card style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW }}>
        <CardContent style={{ padding: 18 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "#1C1917", marginBottom: 8 }}>
            Candling Status
          </p>

          {/* Flat Stat Chips */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-block whitespace-nowrap"
              style={{
                backgroundColor: "#DCFCE7",
                color: "#15803D",
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {entry.fertile} Fertile
            </span>
            <span
              className="inline-block whitespace-nowrap"
              style={{
                backgroundColor: "#F1F5F9",
                color: "#475569",
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {entry.clear} Clear
            </span>
            <span
              className="inline-block whitespace-nowrap"
              style={{
                backgroundColor: "#FEF3C7",
                color: "#B45309",
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {entry.uncertain} Uncertain
            </span>
          </div>

          {/* Development checklist tags */}
          {entry.checks.length > 0 && (
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              {entry.checks.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1"
                  style={{ backgroundColor: "#FFFFFF", border: `1px solid ${BORDER}`, color: "#3D3228", fontSize: 11, fontWeight: 600 }}
                >
                  <Check size={12} color={OK.fg} strokeWidth={3} /> {developmentCheckLabels[c]}
                </span>
              ))}
            </div>
          )}

          {/* Position 2 (Note Section Label) */}
          <span className="block" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "#1C1917", marginBottom: 6 }}>
            Note:
          </span>

          {/* 2-Row Stack Inside Note Section */}
          <div className="space-y-3">
            {/* Row 1: Note Text Box spanning full width (width: 100%) */}
            <div className="w-full">
              {noteEditing ? (
                <>
                  <textarea
                    value={noteDraft}
                    autoFocus
                    onChange={(e) => { setNoteDraft(e.target.value.slice(0, NOTES_MAX)); setNoteEdited(e.target.value !== entry.note); }}
                    maxLength={NOTES_MAX}
                    placeholder="Add observations — veining, air cell development, movement…"
                    rows={3}
                    className="w-full resize-none rounded-xl px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                    style={{ border: `1px solid ${INPUT_BORDER}`, backgroundColor: "#F2EEE5", fontSize: 13, color: TEXT }}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" className="rounded-full" onClick={() => { setNoteDraft(entry.note); setNoteEdited(false); setNoteEditing(false); }}>
                      Cancel
                    </Button>
                    <Button size="sm" className="rounded-full" style={{ backgroundColor: RUST, color: "#fff" }}
                      onClick={() => { onUpdateNote(entry.day, noteDraft); setNoteEdited(false); setNoteEditing(false); toast.success("Note saved"); }}>
                      Save note
                    </Button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setNoteEditing(true)}
                  className="w-full rounded-xl px-3.5 py-3 text-left transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{
                    backgroundColor: "#FAF9F6",
                    border: `1px solid ${BORDER}`,
                    borderLeft: `3px solid #C85A32`,
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                  aria-label="Edit inspector notes"
                >
                  {entry.note ? (
                    <span className="block" style={{ fontSize: 13, fontStyle: "italic", color: "#44403C", lineHeight: 1.45 }}>
                      {entry.note}
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: MUTED }}>
                      + Add note observations…
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Row 2 (Positioned directly BELOW Row 1): Photo Thumbnails Grid + "+ Photo" uploader button */}
            <div className="flex flex-wrap items-center gap-2">
              {visiblePhotos.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLightboxIndex(i);
                  }}
                  className="relative overflow-hidden rounded-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2"
                  style={{ width: 56, height: 56, border: `1px solid ${BORDER}`, cursor: "pointer" }}
                  aria-label={`View photo ${i + 1}`}
                >
                  <img
                    src={url}
                    alt={`Candling photo ${i + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </button>
              ))}

              {hasOverflow && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLightboxIndex(3);
                  }}
                  className="relative overflow-hidden rounded-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2"
                  style={{ width: 56, height: 56, border: `1px solid ${BORDER}`, cursor: "pointer" }}
                  aria-label={`View all ${photos.length} photos`}
                >
                  <img
                    src={photos[3]}
                    alt="Additional candling photos"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center font-bold text-white backdrop-blur-[1px]"
                    style={{ backgroundColor: "rgba(0, 0, 0, 0.60)", fontSize: 13 }}
                  >
                    +{overflowCount}
                  </div>
                </button>
              )}

              {/* "+ Photo" uploader tile */}
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="flex flex-col items-center justify-center gap-0.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 transition-colors hover:bg-stone-50"
                style={{ width: 56, height: 56, border: `1.5px dashed #C9B182`, backgroundColor: SURFACE, cursor: "pointer" }}
                aria-label="Add candling photo"
              >
                <Plus size={15} color={MUTED} />
                <span style={{ fontSize: 9, color: MUTED, fontWeight: 600 }}>Photo</span>
              </button>
              <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => readFiles(e.target.files)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Photo Lightbox Modal */}
      <PhotoLightboxModal
        open={lightboxIndex !== null}
        photos={photos}
        initialIndex={lightboxIndex ?? 0}
        day={entry.day}
        onClose={() => setLightboxIndex(null)}
        onDelete={(idx) => onDeletePhoto(entry.day, idx)}
      />
    </>
  );
}

// ─── "Record / Edit Candling Session" modal ──────────────────────────────────
function LogModal({
  open,
  onOpenChange,
  candling,
  candled,
  currentDay,
  totalDays,
  totalEggsSet,
  modeName,
  initialEntry,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candling: { day: number; label: string; dayRange: string }[];
  candled: Record<number, boolean>;
  currentDay: number;
  totalDays: number;
  totalEggsSet: number;
  modeName: string;
  initialEntry?: CandlingLogEntry | null;
  onSubmit: (form: CandleForm) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] overflow-y-auto p-0 shadow-2xl sm:max-w-[480px]"
        style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}
      >
        {/* Body lives in a child so its draft state resets each time the modal opens. */}
        <LogModalBody
          candling={candling}
          candled={candled}
          currentDay={currentDay}
          totalDays={totalDays}
          totalEggsSet={totalEggsSet}
          modeName={modeName}
          initialEntry={initialEntry}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function LogModalBody({
  candling,
  candled,
  currentDay,
  totalDays,
  totalEggsSet,
  modeName,
  initialEntry,
  onSubmit,
  onCancel,
}: {
  candling: { day: number; label: string; dayRange: string }[];
  candled: Record<number, boolean>;
  currentDay: number;
  totalDays: number;
  totalEggsSet: number;
  modeName: string;
  initialEntry?: CandlingLogEntry | null;
  onSubmit: (form: CandleForm) => void;
  onCancel: () => void;
}) {
  const isEditing = !!initialEntry;
  const available = candling.filter((c) => !candled[c.day] || (initialEntry && c.day === initialEntry.day));
  const photoRef = useRef<HTMLInputElement>(null);

  const defaultCustomDay = String(Math.min(totalDays, currentDay > 0 ? currentDay : 8));

  const initialOpt = initialEntry
    ? String(initialEntry.day)
    : available[0]
    ? String(available[0].day)
    : "custom";

  const [selectedOption, setSelectedOption] = useState<string>(
    initialEntry && !candling.some((c) => c.day === initialEntry.day) ? "custom" : initialOpt
  );
  const [customDayRaw, setCustomDayRaw] = useState<string>(
    initialEntry ? String(initialEntry.day) : defaultCustomDay
  );

  const defaultTargetDay = initialEntry
    ? initialEntry.day
    : available[0]?.day ?? Number(defaultCustomDay) ?? 8;

  const initialForm: CandleForm = initialEntry
    ? {
        targetDay: initialEntry.day,
        fertile: initialEntry.fertile,
        clear: initialEntry.clear,
        uncertain: initialEntry.uncertain,
        note: initialEntry.note,
        photos: initialEntry.photos,
        checks: initialEntry.checks,
      }
    : emptyForm(defaultTargetDay);

  const [form, setForm] = useState<CandleForm>(initialForm);
  const [dragging, setDragging] = useState(false);

  const customDayNum = Number(customDayRaw);
  const isCustomDayValid =
    selectedOption !== "custom" ||
    (customDayRaw.trim() !== "" &&
      !isNaN(customDayNum) &&
      customDayNum >= 1 &&
      customDayNum <= totalDays);
  const customDayError = selectedOption === "custom" && !isCustomDayValid;

  const inspected = form.fertile + form.clear + form.uncertain;
  const isTallyOverCapacity = inspected > totalEggsSet;
  const isZeroTally = inspected === 0;

  const isSaveDisabled = isZeroTally || isTallyOverCapacity || customDayError;

  const readFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: File[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" isn't an image — skipped`);
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`"${file.name}" is over 5 MB — skipped`);
        return;
      }
      accepted.push(file);
    });
    if (accepted.length === 0) return;
    const urls: string[] = [];
    let loaded = 0;
    accepted.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) urls.push(e.target.result as string);
        loaded++;
        if (loaded === accepted.length) setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); readFiles(e.dataTransfer.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const target = candling.find((c) => c.day === form.targetDay);

  const setCount = (key: "fertile" | "clear" | "uncertain", raw: string) => {
    const clean = raw.replace(/[^0-9]/g, "").slice(0, 3);
    setForm((f) => ({ ...f, [key]: Math.min(totalEggsSet, Number(clean) || 0) }));
  };

  const tallyFields = [
    { key: "fertile" as const, label: "Fertile" },
    { key: "clear" as const, label: "Clear" },
    { key: "uncertain" as const, label: "Uncertain" },
  ];

  return (
    <>
      <DialogHeader className="px-5 pt-5 text-left">
        <DialogTitle style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>
          {isEditing ? `Edit Inspection Log — Day ${form.targetDay}` : "Candling Journal"}
        </DialogTitle>
        <DialogDescription className="text-xs font-medium text-[#2D241E]">
          {modeName}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-5 pb-1">
        {/* Checkpoint Selection (disabled or fixed during editing to protect timeline consistency) */}
        <div>
          <Label style={{ fontSize: 13, color: TEXT }}>Checkpoint</Label>
          {isEditing ? (
            <div
              className="mt-1.5 flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>
                {target?.label ?? `Day ${form.targetDay} Candling`} (Day {form.targetDay})
              </span>
              <span className="rounded-full px-2 py-0.5" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#EAE7E1", color: "#78716C" }}>
                LOCKED
              </span>
            </div>
          ) : (
            <Select
              value={selectedOption}
              onValueChange={(val) => {
                setSelectedOption(val);
                if (val === "custom") {
                  const day = Number(customDayRaw) || 1;
                  setForm((f) => ({ ...f, targetDay: day }));
                } else {
                  const day = Number(val);
                  setForm((f) => ({ ...f, targetDay: day }));
                }
              }}
            >
              <SelectTrigger className="mt-1.5 rounded-xl" style={{ borderColor: INPUT_BORDER, backgroundColor: SURFACE }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {candling.map((c) => (
                  <SelectItem key={c.day} value={String(c.day)}>{c.label} (Day {c.day})</SelectItem>
                ))}
                <SelectItem value="custom">Custom Day...</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Dynamic Custom Day Number Input when "Custom Day..." is selected */}
          {!isEditing && selectedOption === "custom" && (
            <div className="mt-3">
              <Label htmlFor="custom-day-input" style={{ fontSize: 13, color: TEXT }}>
                Day Number
              </Label>
              <div className="mt-1.5 flex items-center gap-2">
                <span style={{ fontSize: 14, fontWeight: 600, color: MUTED }}>Day</span>
                <Input
                  id="custom-day-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={customDayRaw}
                  onKeyDown={(e) => {
                    if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
                  }}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                    setCustomDayRaw(sanitized);
                    const val = Number(sanitized) || 0;
                    setForm((f) => ({ ...f, targetDay: val }));
                  }}
                  placeholder="8"
                  className="w-24 rounded-xl"
                  style={{
                    borderColor: customDayError ? "#DC2626" : INPUT_BORDER,
                    backgroundColor: SURFACE,
                    color: TEXT,
                  }}
                />
              </div>
              {customDayError && (
                <p className="mt-1.5 flex items-center gap-1" style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
                  <AlertCircle size={13} /> Day must be between 1 and {totalDays}
                </p>
              )}
            </div>
          )}

          {!isEditing && selectedOption !== "custom" && target && target.day > currentDay && (
            <p className="mt-1.5 rounded-lg px-2.5 py-1.5" style={{ fontSize: 12, color: WARN.fg, backgroundColor: WARN.bg }}>
              Not yet due (Day {target.day}) — you can still log it if candling was performed early.
            </p>
          )}
        </div>

        {/* Tally inputs — three numbers in one row */}
        <div>
          <Label style={{ fontSize: 13, color: TEXT }}>Egg tally</Label>
          <div className="mt-1.5 grid grid-cols-3 gap-3">
            {tallyFields.map((f) => (
              <div key={f.key}>
                <Input
                  id={`tally-${f.key}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={form[f.key] === 0 ? "" : String(form[f.key])}
                  onKeyDown={(e) => {
                    if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
                  }}
                  onChange={(e) => setCount(f.key, e.target.value)}
                  placeholder="0"
                  className="rounded-xl text-center"
                  style={{
                    borderColor: isTallyOverCapacity ? "#DC2626" : INPUT_BORDER,
                    backgroundColor: SURFACE,
                    color: TEXT,
                  }}
                />
                <label
                  htmlFor={`tally-${f.key}`}
                  className="mt-1 flex justify-center text-xs font-medium"
                  style={{ color: fertilityTones[f.key].text }}
                >
                  {f.label}
                </label>
              </div>
            ))}
          </div>

          {isTallyOverCapacity ? (
            <p className="mt-1.5 flex items-center gap-1" style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
              <AlertCircle size={13} /> Total inspected eggs cannot exceed eggs set ({totalEggsSet})
            </p>
          ) : (
            <p className="mt-1.5 text-center text-xs font-semibold text-[#2D241E]">
              Recorded eggs: {inspected}/{totalEggsSet}
            </p>
          )}
        </div>

        {/* Quick tag chips */}
        <div>
          <Label style={{ fontSize: 13, color: TEXT }}>Development observed</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(Object.keys(developmentCheckLabels) as DevelopmentCheck[]).map((c) => {
              const on = form.checks.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, checks: on ? form.checks.filter((x) => x !== c) : [...form.checks, c] })}
                  aria-pressed={on}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{
                    backgroundColor: on ? OK.bg : SURFACE,
                    border: `1px solid ${on ? OK.fg : BORDER}`,
                    color: on ? "#166534" : MUTED,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {on ? <Check size={13} strokeWidth={3} /> : <Circle size={13} />}
                  {developmentCheckLabels[c]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="lf-note" style={{ fontSize: 13, color: TEXT }}>Notes</Label>
          <textarea
            id="lf-note"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Observation notes…"
            rows={3}
            className="mt-1.5 w-full resize-none rounded-xl px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ border: `1px solid ${INPUT_BORDER}`, backgroundColor: SURFACE, fontSize: 14, color: TEXT }}
          />
        </div>

        {/* Photo dropzone */}
        <div>
          <Label style={{ fontSize: 13, color: TEXT }}>Photos</Label>
          <div
            onClick={() => photoRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl py-5"
            style={{
              border: `1.5px dashed ${dragging ? RUST : "#C9B182"}`,
              backgroundColor: dragging ? `${RUST}0A` : SURFACE,
              transition: "border-color 0.15s, background-color 0.15s",
            }}
          >
            <Camera size={20} color={dragging ? RUST : "#9E8B72"} />
            <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>Add photos from candling</span>
            <span style={{ color: MUTED, fontSize: 12 }}>Click or drag &amp; drop</span>
          </div>
          <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => readFiles(e.target.files)} />
          {form.photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {form.photos.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="rounded-lg object-cover" style={{ width: 60, height: 60, border: `1px solid ${BORDER}` }} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setForm((f) => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }));
                    }}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-transform active:scale-95"
                    aria-label="Remove photo"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div
        className="sticky bottom-0 flex justify-end gap-2 px-5 py-4"
        style={{ backgroundColor: CARD, borderTop: `1px solid ${BORDER}` }}
      >
        <Button variant="ghost" className="rounded-full" onClick={onCancel}>Cancel</Button>
        <Button
          className="rounded-full"
          style={{ backgroundColor: RUST, color: "#fff", opacity: isSaveDisabled ? 0.5 : 1 }}
          disabled={isSaveDisabled}
          title={
            isTallyOverCapacity
              ? `Total inspected eggs cannot exceed eggs set (${totalEggsSet})`
              : customDayError
              ? `Day must be between 1 and ${totalDays}`
              : isZeroTally
              ? "Enter at least one egg count"
              : undefined
          }
          onClick={() => onSubmit(form)}
        >
          <CheckCircle2 size={15} /> {isEditing ? "Update Inspection" : "Save Inspection"}
        </Button>
      </div>
    </>
  );
}

// ─── Key/value row for device grid ──────────────────────────────────────────────
function KeyValue({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
      <p style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: accent ?? TEXT }}>{value}</p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function DetailScreen({ unit, modes, onUpdate }: {
  unit: Incubator; modes: Mode[];
  onUpdate: (patch: Partial<Incubator>) => void;
}) {
  const mode = modes.find((m) => m.id === unit.modeId) ?? modes[0];
  const candling = computeCandling(mode.incubationDays);

  const [tab, setTab] = useState<DetailTab>("monitor");
  const [settingTab, setSettingTab] = useState<"mode" | "turning" | "device">("mode");
  const [pendingModeId, setPendingModeId] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [earlyTurnOpen, setEarlyTurnOpen] = useState(false);
  const [syncChoice, setSyncChoice] = useState<"reset" | "maintain">("reset");
  const [showLogForm, setShowLogForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CandlingLogEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<CandlingLogEntry | null>(null);

  const deleteJournalEntry = (day: number) => {
    onUpdate({
      candled: { ...unit.candled, [day]: false },
      candlingLog: unit.candlingLog.filter((e) => e.day !== day),
    });
    toast.success(`Day ${day} journal entry deleted`);
  };

  const heaterOn = unit.temp < mode.targetTemp.max;
  const overheating = unit.temp > mode.targetTemp.max;
  const fanOn = heaterOn || overheating;
  const mistOn = unit.humidity < mode.targetHumidity.max && unit.waterLevel > 0;

  const waterInfo = getWaterStatusInfo(unit.waterLevel);

  const nextTurnLabel = () => {
    const diffMin = Math.round((new Date(unit.nextTurn).getTime() - Date.now()) / 60000);
    if (diffMin < 0) return { text: `Overdue by ${Math.abs(diffMin)} min`, overdue: true };
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return { text: `in ${h > 0 ? `${h}h ` : ""}${m}m`, overdue: false };
  };
  const next = nextTurnLabel();

  const submitInspection = (form: CandleForm) => {
    const c = candling.find((cp) => cp.day === form.targetDay);
    const label = c
      ? c.label
      : form.targetDay === candling[0]?.day
      ? "1st Candling"
      : form.targetDay === candling[1]?.day
      ? "2nd Candling"
      : form.targetDay === candling[2]?.day
      ? "Lockdown Check"
      : `Day ${form.targetDay} Candling`;
    const entry: CandlingLogEntry = {
      day: form.targetDay, label, date: editingEntry?.date ?? todayStr(),
      fertile: form.fertile, clear: form.clear, uncertain: form.uncertain,
      note: form.note.trim(), photos: form.photos, checks: form.checks,
    };
    onUpdate({
      candled: { ...unit.candled, [form.targetDay]: true },
      candlingLog: [entry, ...unit.candlingLog.filter((e) => e.day !== form.targetDay)],
    });
    const wasEditing = !!editingEntry;
    setShowLogForm(false);
    setEditingEntry(null);
    toast.success(wasEditing ? `Day ${entry.day} inspection updated` : `${label} saved`, {
      description: `${entry.fertile} fertile · ${entry.clear} clear · ${entry.uncertain} uncertain.`,
    });
  };

  const addPhotosToEntry = (day: number, urls: string[]) =>
    onUpdate({ candlingLog: unit.candlingLog.map((e) => e.day === day ? { ...e, photos: [...e.photos, ...urls] } : e) });

  const deletePhotoFromEntry = (day: number, photoIndex: number) =>
    onUpdate({
      candlingLog: unit.candlingLog.map((e) =>
        e.day === day ? { ...e, photos: e.photos.filter((_, idx) => idx !== photoIndex) } : e
      ),
    });

  const updateEntryNote = (day: number, note: string) =>
    onUpdate({ candlingLog: unit.candlingLog.map((e) => e.day === day ? { ...e, note } : e) });

  const changeMode = (modeId: string) => {
    const m = modes.find((x) => x.id === modeId)!;
    onUpdate({ modeId, turnInterval: m.defaultTurnInterval });
    toast(`Mode changed to ${m.name}`, { description: "Turning interval reset to mode default." });
  };

  const confirmForceSwitch = () => {
    if (!pendingModeId) return;
    changeMode(pendingModeId);
    setPendingModeId(null);
    setAcknowledged(false);
  };

  const handleTurn = () => {
    onUpdate({
      lastTurned: new Date().toISOString(),
      nextTurn: new Date(Date.now() + unit.turnInterval * 3_600_000).toISOString(),
    });
    toast.success(`${unit.name}: eggs turned`, { description: `Next turn in ${unit.turnInterval} hours.` });
  };

  // Warn before manual turns that are too soon after the last one.
  const lastTurnMin = Math.round((Date.now() - new Date(unit.lastTurned).getTime()) / 60000);
  const handleTurnClick = () => {
    if (lastTurnMin < 30) {
      setSyncChoice("reset");
      setEarlyTurnOpen(true);
    } else {
      handleTurn();
    }
  };

  const confirmEarlyTurn = () => {
    onUpdate({
      lastTurned: new Date().toISOString(),
      nextTurn: syncChoice === "reset"
        ? new Date(Date.now() + unit.turnInterval * 3_600_000).toISOString()
        : unit.nextTurn,
    });
    setEarlyTurnOpen(false);
    toast.success(`${unit.name}: eggs turned`, {
      description: syncChoice === "reset"
        ? `Next turn in ${unit.turnInterval} hours.`
        : "Original turning schedule maintained.",
    });
  };

  const handleRefill = () => {
    onUpdate({ waterLevel: 100, lastRefilled: new Date().toISOString() });
    toast.success(`${unit.name}: reservoir refilled to 100%`);
  };

  const totalDays = mode.incubationDays;
  const currentDay = unit.dayOfIncubation;
  // Newest recorded checkpoint first, so the feed reads top-down by recency.
  const loggedEntries = [...unit.candlingLog].sort((a, b) => b.day - a.day);
  const unloggedCount = candling.filter((c) => !unit.candled[c.day]).length;
  // Checkpoints not yet logged — rendered as hollow nodes below the recorded ones.
  const futureCheckpoints = candling.filter((c) => !unit.candled[c.day]);
  // One axis node per logged entry plus one per unlogged checkpoint, day-ordered.
  const feedNodes = [
    ...loggedEntries.map((entry) => ({
      day: entry.day, kind: "logged" as const, entry,
      idx: candling.findIndex((x) => x.day === entry.day),
    })),
    ...futureCheckpoints.map((cp) => ({
      day: cp.day, kind: "future" as const, cp,
      idx: candling.findIndex((x) => x.day === cp.day),
    })),
  ].sort((a, b) => a.day - b.day);

  // Aggregate candling summary for the current cycle.
  const candSummary = loggedEntries.reduce(
    (a, e) => ({ fertile: a.fertile + e.fertile, clear: a.clear + e.clear, uncertain: a.uncertain + e.uncertain }),
    { fertile: 0, clear: 0, uncertain: 0 },
  );
  const candTotal = candSummary.fertile + candSummary.clear + candSummary.uncertain;
  const viabilityRate = candTotal > 0 ? Math.round((candSummary.fertile / candTotal) * 100) : 0;
  const nextCheckpoint = candling.find((c) => !unit.candled[c.day] && c.day >= currentDay)
    ?? candling.find((c) => !unit.candled[c.day]);

  const rustBtn = { backgroundColor: RUST, color: "#fff" };
  const outlineBtn = { borderColor: BORDER, color: RUST, backgroundColor: SURFACE };

  return (
    <div className="space-y-5" style={{ color: TEXT }}>
      {/* Row 3 — sub-navigation. Rows 1 and 2 (back link, title, badges) are
          owned by PageHeader, which already supplies the gap above this bar. */}
      <SubTabNav active={tab} onChange={setTab} />

      {/* ════════════════ LIVE MONITOR ════════════════ */}
      {tab === "monitor" && (
        <div className="space-y-5">

          {/* Hero: Incubation Timeline */}
          <SectionCard title="Incubation Timeline">
            <Timeline currentDay={currentDay} totalDays={totalDays} candling={candling} candled={unit.candled} />
            <div className="my-4" style={{ height: 1, backgroundColor: BORDER }} />
            {/* Three equal dials — temperature, water, humidity. */}
            <div
              className="grid grid-cols-1 items-start sm:grid-cols-3"
              style={{ gap: 24 }}
            >
              <GaugeDial
                value={unit.temp}
                min={35}
                max={40}
                safe={mode.targetTemp}
                unit="°C"
                label="Temperature"
                size={120}
              />
              <GaugeDial
                value={unit.humidity}
                min={40}
                max={80}
                safe={mode.targetHumidity}
                unit="%"
                label="Humidity"
                size={120}
              />
              <GaugeDial
                value={unit.waterLevel}
                min={0}
                max={100}
                safe={{ min: 20, max: 100 }}
                unit="%"
                label="Water Level"
                size={120}
                decimals={0}
                safeLabel={`Safe range: ${waterInfo.label}`}
                footer={
                  <>
                    <p className="mt-0.5" style={{ color: MUTED, fontSize: 12 }}>
                      Refilled {relTime(unit.lastRefilled)}
                    </p>
                    <Button
                      onClick={handleRefill}
                      variant="outline"
                      size="sm"
                      className="mt-2 rounded-full"
                      style={outlineBtn}
                    >
                      <Droplet size={14} /> Mark Refilled
                    </Button>
                  </>
                }
              />
            </div>
          </SectionCard>

          {/* Lower grid */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SectionCard title="Active systems">
              <div className="space-y-3">
                <ActuatorRow icon={<Flame size={19} />} name="Heater" sub="PTC element"
                  on={heaterOn} tone={WARN} label="Heating" offLabel="Standby" pulse />
                <ActuatorRow icon={<Fan size={19} className={fanOn ? "animate-spin" : ""} style={fanOn ? { animationDuration: "2.4s" } : undefined} />}
                  name="Fan" sub="Air circulation" on={fanOn} tone={OK} label="Running" offLabel="Off" />
                <ActuatorRow icon={<Waves size={19} />} name="Mist maker" sub="Humidity control"
                  on={mistOn} tone={OK} label="Active" offLabel="Standby" pulse />
              </div>
            </SectionCard>

            {/* Water now lives in the snapshot dials, so turning fills this column. */}
            <SectionCard title="Turning schedule" subtitle={`Every ${unit.turnInterval}h · ${unit.autoTurn ? "auto-turn on" : "manual"}`}>
              <InnerTile>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2" style={{ color: MUTED, fontSize: 13 }}>
                    <Clock size={14} /> Next turn
                  </span>
                  {next.overdue
                    ? <StatusPill tone={CRIT}>{next.text}</StatusPill>
                    : <span style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{next.text}</span>}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span style={{ color: MUTED, fontSize: 13 }}>Last turned</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>{relTime(unit.lastTurned)}</span>
                </div>
              </InnerTile>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ════════════════ CANDLING & INSPECTION ════════════════ */}
      {tab === "candling" && (
        <div className="space-y-5">

          {/* Timeline header with dynamic completion disabling */}
          <SectionCard
            title="Incubation Timeline"
            action={
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                      setEditingEntry(null);
                      setShowLogForm(true);
                  }}
                  className="rounded-full transition-all"
                  style={{ ...rustBtn, fontSize: 13 }}
                  title="Log Candling Inspection"
                >
                  <Plus size={14} /> Log Inspection
                </Button>
              </div>
            }
          >
            <Timeline currentDay={currentDay} totalDays={totalDays} candling={candling} candled={unit.candled} interactive />
          </SectionCard>

          <LogModal
            open={showLogForm}
            onOpenChange={(open) => {
              setShowLogForm(open);
              if (!open) setEditingEntry(null);
            }}
            candling={candling}
            candled={unit.candled}
            currentDay={currentDay}
            totalDays={totalDays}
            totalEggsSet={EGGS_PER_MODE[unit.modeId] ?? 42}
            modeName={mode.name}
            initialEntry={editingEntry}
            onSubmit={submitInspection}
          />

          {/* 2-column: 60% inspection history / 40% summary + actions */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            {/* LEFT — inspection history feed */}
            <div className="space-y-4 lg:col-span-3">
              <div>
                <p style={{ fontSize: 18, fontWeight: 600, color: "#1C1917", marginBottom: 20 }}>
                  Candling Journal
                </p>
              </div>
              {/* Timeline Section Container with 24px top padding */}
              <div className="relative pt-[24px]">
                {/* Left 40px Vertical Axis Column */}
                <div
                  className="absolute top-0 bottom-0 left-0 flex flex-col items-center"
                  style={{ width: 40 }}
                >
                  {/* Top Header: "DAY" label (11px, font-weight 700, uppercase, color #78716C) - sits 8px directly above Node Circle 5, centered over axis line */}
                  <span
                    className="absolute font-bold"
                    style={{
                      top: 0,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#78716C",
                      lineHeight: "1",
                      zIndex: 20,
                      whiteSpace: "nowrap",
                    }}
                  >
                    DAY
                  </span>
                  {/* Continuous Vertical Axis Line with 24px top margin to start beneath DAY label */}
                  <div
                    className="w-0.5 flex-1"
                    style={{
                      marginTop: 24,
                      backgroundColor: "#EAE7E1",
                    }}
                  />
                </div>

                {/* Right Content Column / Rows List attached to Nodes */}
                <ul className="space-y-5">
                  {feedNodes.map((n) =>
                    n.kind === "logged" ? (
                      <li key={`log-${n.day}`} className="relative flex items-start">
                        {/* 40px Left Axis Column Container for Node Circle */}
                        <div className="shrink-0 flex justify-center relative z-10" style={{ width: 40 }}>
                          {/* Node Circle (32x32px solid rust circle #C85A32 with white day number) */}
                          <span
                            className="flex items-center justify-center rounded-full"
                            style={{
                              width: 32,
                              height: 32,
                              backgroundColor: RUST_NODE,
                              color: "#FFFFFF",
                              fontSize: 13,
                              fontWeight: 700,
                              boxShadow: `0 0 0 3px ${BG}`,
                            }}
                          >
                            {formatNodeDay(n.day)}
                          </span>
                        </div>

                        {/* Right Content Column */}
                        <div className="flex-1 min-w-0 pl-3">
                          {/* Header bar: "1st Candling" + Date + Edit & Delete actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2" style={{ minHeight: 32 }}>
                            <p className="flex flex-wrap items-center gap-1.5" style={{ fontSize: 16, fontWeight: 700, color: "#1C1917" }}>
                              {n.idx >= 0 ? (CANDLE_SHORT_LABELS[n.idx] ?? n.entry.label) : n.entry.label}
                              <CheckCircle2 size={18} fill="#16A34A" color="#FFFFFF" strokeWidth={2.5} />
                            </p>
                            <div className="flex items-center gap-1.5">
                              <span className="whitespace-nowrap mr-3" style={{ fontSize: 13, color: "#6E6259" }}>
                                {fmtTimestamp(n.entry.date)}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingEntry(n.entry);
                                  setShowLogForm(true);
                                }}
                                className="inline-flex items-center justify-center rounded-lg p-1.5 text-[#A8A29E] transition-colors hover:bg-[#FFF5F2] hover:text-[#C85A32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                                aria-label={`Edit entry for Day ${n.entry.day}`}
                                title="Edit Inspection"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => setEntryToDelete(n.entry)}
                                className="inline-flex items-center justify-center rounded-lg p-1.5 text-[#A8A29E] transition-colors hover:bg-[#FEE2E2] hover:text-[#DC2626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                                aria-label={`Delete entry for Day ${n.entry.day}`}
                                title="Delete Journal Entry"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          {/* Journal Card */}
                          <div style={{ marginTop: 12 }}>
                            <JournalEntryCard
                              entry={n.entry}
                              modeName={mode.name}
                              onAddPhotos={addPhotosToEntry}
                              onUpdateNote={updateEntryNote}
                              onDeletePhoto={deletePhotoFromEntry}
                            />
                          </div>
                        </div>
                      </li>
                    ) : (() => {
                      const isDue = n.cp.day <= currentDay;
                      return (
                        <li key={`cp-${n.day}`} className="relative flex items-center min-h-[32px]">
                          {/* 40px Left Axis Column Container for Node Circle */}
                          <div className="shrink-0 flex justify-center relative z-10" style={{ width: 40 }}>
                            {/* Node Circle (32x32px outlined circle with day number) */}
                            <span
                              className="flex items-center justify-center rounded-full"
                              style={{
                                width: 32,
                                height: 32,
                                backgroundColor: "#FFFFFF",
                                border: isDue ? "2px solid #D97706" : "2px solid #EAE7E1",
                                color: isDue ? "#D97706" : "#78716C",
                                fontSize: 13,
                                fontWeight: 700,
                                boxShadow: `0 0 0 3px ${BG}`,
                              }}
                            >
                              {formatNodeDay(n.day)}
                            </span>
                          </div>

                          {/* Right Content Column */}
                          <div className="flex-1 min-w-0 pl-3">
                            {isDue ? (
                              <p className="flex flex-wrap items-center gap-1.5" style={{ fontSize: 16, fontWeight: 700, color: "#1C1917" }}>
                                {CANDLE_SHORT_LABELS[n.idx] ?? n.cp.label}
                                <AlertCircle size={18} fill="#D97706" color="#FFFFFF" strokeWidth={2.5} />
                              </p>
                            ) : (
                              <p style={{ fontSize: 13, fontWeight: 600, color: "#78716C" }}>
                                {CANDLE_SHORT_LABELS[n.idx] ?? n.cp.label}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })(),
                  )}
                </ul>

                {/* Delete Confirmation Modal Dialog */}
                <Dialog open={entryToDelete !== null} onOpenChange={(open) => !open && setEntryToDelete(null)}>
                  <DialogContent
                    className="max-w-[400px] w-[90vw] p-6 rounded-2xl bg-white shadow-xl border border-[#EAE7E1] [&>[data-slot=dialog-close]]:hidden"
                    style={{ borderRadius: 16 }}
                  >
                    <DialogHeader className="gap-2 text-left">
                      <DialogTitle style={{ fontSize: 18, fontWeight: 700, color: "#1C1917" }}>
                        Delete Journal Entry?
                      </DialogTitle>
                      <DialogDescription style={{ fontSize: 13, color: "#525252", lineHeight: 1.5 }}>
                        Are you sure you want to delete this inspection log for Day {entryToDelete?.day}? This will recalculate the cycle's viability rate and cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 flex items-center justify-end gap-2.5">
                      <Button
                        variant="outline"
                        onClick={() => setEntryToDelete(null)}
                        className="rounded-xl border-[#EAE7E1] text-[#44403C] hover:bg-stone-50"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (entryToDelete) {
                            deleteJournalEntry(entryToDelete.day);
                            setEntryToDelete(null);
                          }
                        }}
                        className="rounded-xl text-white font-medium transition-colors"
                        style={{ backgroundColor: "#DC2626" }}
                      >
                        Delete Entry
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* RIGHT — calendar + summary */}
            <div className="space-y-4 lg:col-span-2">
              <MiniIncubationCalendar
                currentDay={currentDay}
                totalDays={totalDays}
                candling={candling}
              />
              <SectionCard title="Current Cycle Summary">
                <div className="space-y-2.5">
                  {[
                    { label: "Total Fertile", value: candSummary.fertile, border: "#DCFCE7", text: "#16A34A" },
                    { label: "Total Clear", value: candSummary.clear, border: "#F1F5F9", text: "#475569" },
                    { label: "Total Uncertain", value: candSummary.uncertain, border: "#FEF3C7", text: "#D97706" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-2">
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#78716C" }}>
                        {row.label}
                      </span>
                      <span
                        className="rounded-full px-3 py-0.5"
                        style={{
                          backgroundColor: "#FFFFFF",
                          border: `1px solid ${row.border}`,
                          color: row.text,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                  <div className="mt-3">
                    <TrayFertilityBar
                      fertile={candSummary.fertile}
                      clear={candSummary.clear}
                      uncertain={candSummary.uncertain}
                    />
                  </div>
                  <div className="my-1" style={{ borderTop: `1px solid ${BORDER}` }} />
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#78716C" }}>
                      Viability Rate
                    </span>
                    <span style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 22, fontWeight: 700, color: "#C85A32" }}>
                      {viabilityRate}%
                    </span>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ DEVICE SETTINGS ════════════════ */}
      {tab === "settings" && (
        <>
          {/* Unified outer frame — one white card split by a vertical divider */}
          <div
            className="flex flex-col overflow-hidden lg:flex-row"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5DACB", borderRadius: 16 }}
          >
          {/* ── Left pane — sub-settings pill menu ──────────────────────── */}
          <nav
            className="shrink-0 p-4"
            style={{ width: "100%", maxWidth: 220 }}
            aria-label="Device settings"
          >
            <ul className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
              {[
                { id: "mode" as const, label: "Incubation Mode", Icon: Egg },
                { id: "turning" as const, label: "Turning Schedule", Icon: RotateCw },
                { id: "device" as const, label: "Device & Connection", Icon: Zap },
              ].map(({ id, label, Icon }) => {
                const isActive = settingTab === id;
                return (
                  <li key={id} className="min-w-0 shrink-0 lg:shrink lg:w-full">
                    <button
                      onClick={() => setSettingTab(id)}
                      className="flex w-full items-center gap-2.5 rounded-full px-3 transition-colors hover:bg-[#FAF6EE]"
                      style={{
                        height: 40,
                        backgroundColor: isActive ? "#8B3A1C" : "transparent",
                        color: isActive ? "#FFFFFF" : "#1A1A1A",
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                      <span className="min-w-0 truncate">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Vertical divider */}
          <div className="hidden lg:block" style={{ width: 1, backgroundColor: "#E5DACB" }} />

          {/* ── Right pane — active sub-setting content ─────────────────── */}
          <section className="min-w-0 flex-1 p-6">
              {settingTab === "mode" && (
                <>
                  <h2 style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 20, fontWeight: 700, color: TEXT }}>
                    Incubation Mode
                  </h2>
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate" style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{mode.name}</p>
                        <span className="shrink-0 rounded-full px-2 py-0.5" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#F5EFE6", color: "#8B3A1C" }}>
                          {mode.builtIn ? "Built-in" : "Custom"}
                        </span>
                      </div>
                      <Select
                        value={unit.modeId}
                        onValueChange={(val) => {
                          if (val !== unit.modeId) {
                            setAcknowledged(false);
                            setPendingModeId(val);
                          }
                        }}
                      >
                        <SelectTrigger
                          className="h-auto w-fit rounded-lg [&_svg]:!text-[#1A1A1A]"
                          style={{ backgroundColor: "#F4ECE1", border: "1px solid #E5DACB", color: "#1A1A1A", fontSize: 13, fontWeight: 600, padding: "8px 14px" }}
                        >
                          Switch Mode
                        </SelectTrigger>
                        <SelectContent>
                          {modes.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <KeyValue label="Target Temperature" value={`${mode.targetTemp.min}–${mode.targetTemp.max}°C`} />
                      <KeyValue label="Target Humidity" value={`${mode.targetHumidity.min}–${mode.targetHumidity.max}% RH`} />
                      <KeyValue label="Turning Cadence" value={`Every ${mode.defaultTurnInterval} hours`} />
                      <KeyValue label="Scheduled Candling Days" value={candling.map((c) => `Day ${c.day}`).join(", ")} />
                    </div>
                    <button
                      onClick={() => toast("Mode Library", { description: "Edit this preset under Settings → Mode Library." })}
                      className="inline-flex items-center gap-1.5 text-[#C85A32] transition-colors hover:text-[#8B3A1C]"
                      style={{ fontSize: 13, fontWeight: 600 }}
                    >
                      Edit Preset in Mode Library <ChevronRight size={14} />
                    </button>
                  </div>
                </>
              )}

              {settingTab === "turning" && (
                <>
                  <h2 style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 20, fontWeight: 700, color: TEXT }}>
                    Turning Schedule
                  </h2>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>Automatic turning</p>
                        <p style={{ color: MUTED, fontSize: 12 }}>Turn eggs on schedule automatically.</p>
                      </div>
                      <Switch checked={unit.autoTurn} onCheckedChange={(v) => onUpdate({ autoTurn: v })} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Turn every</span>
                      <Select value={String(unit.turnInterval)} onValueChange={(v) => onUpdate({ turnInterval: Number(v) })}>
                        <SelectTrigger className="h-9 w-[110px] rounded-xl" style={{ borderColor: "rgba(120,53,15,0.20)", backgroundColor: SURFACE, fontSize: 13 }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 4, 6, 8, 12].map((h) => <SelectItem key={h} value={String(h)}>{h} Hours</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate" style={{ fontSize: 12, color: next.overdue ? CRIT.fg : MUTED }}>
                        Next: {next.text} • Last: {relTime(unit.lastTurned)}
                      </span>
                      <Button onClick={handleTurnClick} variant="outline" size="sm" className="shrink-0 rounded-full" style={outlineBtn}>
                        <RotateCw size={14} /> Turn Now
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {settingTab === "device" && (
                <>
                  <h2 style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 20, fontWeight: 700, color: TEXT }}>
                    Device & Connection
                  </h2>
                  <div className="mt-4 space-y-3">
                    <KeyValue label="Device ID" value={unit.deviceId} />
                    <KeyValue
                      label="Connection Status"
                      accent={unit.paired ? OK.fg : CRIT.fg}
                      value={
                        <span className="flex items-center gap-1.5">
                          {unit.paired ? <Wifi size={15} /> : <WifiOff size={15} />}
                          {unit.paired ? "Connected & Paired" : "Connection Lost"}
                          {!unit.paired && (
                            <Button
                              onClick={() => { onUpdate({ paired: true }); toast.success(`${unit.name} reconnected`); }}
                              variant="outline" size="sm"
                              className="ml-1 rounded-full"
                              style={outlineBtn}
                            >
                              <WifiOff size={13} /> Reconnect
                            </Button>
                          )}
                        </span>
                      }
                    />
                    <div className="rounded-xl p-3.5" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
                      <div className="flex items-center justify-between">
                        <p style={{ fontSize: 12, color: MUTED }}>Battery</p>
                        <span style={{ fontSize: 13, fontWeight: 700, color: unit.batteryPct <= 25 ? CRIT.fg : TEXT }}>{unit.batteryPct}%</span>
                      </div>
                      <Progress value={unit.batteryPct} className="mt-1.5 h-2" />
                    </div>
                  </div>
                </>
              )}
          </section>
        </div>

        {/* Safety gate — mid-cycle mode switch requires explicit acknowledgement */}
        <Dialog open={pendingModeId !== null} onOpenChange={(open) => !open && setPendingModeId(null)}>
          <DialogContent
            className="w-[90vw] max-w-[480px] bg-white p-6 shadow-xl border border-[#EAE7E1] [&>[data-slot=dialog-close]]:hidden"
            style={{ borderRadius: 16 }}
          >
            <div className="flex items-start gap-3">
              <ShieldAlert size={32} color="#F2994A" fill="#F2994A" className="mt-0.5 shrink-0" strokeWidth={2} />
              <div>
                <DialogTitle style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A" }}>
                  Active Incubation in Progress
                </DialogTitle>
                <DialogDescription className="mt-1.5" style={{ fontSize: 13, color: "#525252", lineHeight: 1.5 }}>
                  {unit.name} is currently at Day {currentDay} of {totalDays} ({mode.name}). Switching modes mid-cycle will alter temperature, humidity, and turning schedules immediately.
                </DialogDescription>
              </div>
            </div>

            <label
              className="flex cursor-pointer items-start gap-2.5 rounded-xl px-3.5 py-3"
              style={{ backgroundColor: "#FFF8E7", border: "1px solid #F2C94C" }}
            >
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(v === true)}
                className="mt-0.5 data-[state=checked]:bg-[#8B3A1C] data-[state=checked]:border-[#8B3A1C]"
                style={{ borderColor: "#D97706", backgroundColor: "#FFFFFF", borderRadius: 5 }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: "#5A4838", lineHeight: 1.45 }}>
                I understand that changing parameters mid-cycle may impact embryo hatch rate.
              </span>
            </label>

            <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <Button
                onClick={confirmForceSwitch}
                disabled={!acknowledged}
                variant="outline"
                className="rounded-xl"
                style={{
                  borderColor: "#D9534F",
                  color: "#D9534F",
                  backgroundColor: "#FFFFFF",
                  opacity: acknowledged ? 1 : 0.5,
                }}
              >
                Force Switch Mode
              </Button>
              <Button
                onClick={() => setPendingModeId(null)}
                autoFocus
                className="rounded-xl text-white"
                style={{ backgroundColor: "#8B3A1C" }}
              >
                Keep Current Mode
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </>
      )}

      {/* Early manual turn warning — fires when Turn Now is used too soon */}
      <Dialog open={earlyTurnOpen} onOpenChange={(open) => !open && setEarlyTurnOpen(false)}>
        <DialogContent
          className="w-[90vw] max-w-[460px] bg-white p-6 shadow-xl border border-[#EAE7E1] [&>[data-slot=dialog-close]]:hidden"
          style={{ borderRadius: 16 }}
        >
          <div className="flex items-start gap-3">
            <RotateCw size={28} color="#F2994A" className="mt-0.5 shrink-0" />
            <div>
              <DialogTitle style={{ fontSize: 18, fontWeight: 700, color: "#1A1A1A" }}>
                Early Manual Egg Turn
              </DialogTitle>
              <DialogDescription className="mt-1.5" style={{ fontSize: 13, color: "#525252", lineHeight: 1.5 }}>
                Eggs in {unit.name} were last turned {Math.max(1, lastTurnMin)} minutes ago. The next automatic turn is scheduled in {next.text}. Turning too frequently can disrupt embryo orientation.
              </DialogDescription>
            </div>
          </div>

          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>Schedule Sync Preference:</p>
            <RadioGroup value={syncChoice} onValueChange={(v) => setSyncChoice(v as "reset" | "maintain")} className="mt-2 gap-2">
              <label
                className="flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5"
                style={
                  syncChoice === "reset"
                    ? { backgroundColor: "#FFF8E7", border: "1px solid #F2C94C" }
                    : { border: "1px solid #E5DACB" }
                }
              >
                <RadioGroupItem value="reset" id="sync-reset" className="mt-0.5" />
                <span style={{ fontSize: 13, color: "#5A4838", lineHeight: 1.45 }}>
                  Reset {unit.turnInterval}-hour timer from now (Next turn in {unit.turnInterval}h 0m)
                </span>
              </label>
              <label
                className="flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5"
                style={
                  syncChoice === "maintain"
                    ? { backgroundColor: "#FFF8E7", border: "1px solid #F2C94C" }
                    : { border: "1px solid #E5DACB" }
                }
              >
                <RadioGroupItem value="maintain" id="sync-maintain" className="mt-0.5" />
                <span style={{ fontSize: 13, color: "#5A4838", lineHeight: 1.45 }}>
                  Maintain original schedule (Next turn in {next.text.replace(/^in\s+/, "")})
                </span>
              </label>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <Button onClick={() => setEarlyTurnOpen(false)} autoFocus className="rounded-xl text-white" style={{ backgroundColor: "#8B3A1C" }}>
              Cancel
            </Button>
            <Button onClick={confirmEarlyTurn} variant="outline" className="rounded-xl" style={{ borderColor: "#F2994A", color: "#F2994A", backgroundColor: "#FFFFFF" }}>
              Confirm Early Turn
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
