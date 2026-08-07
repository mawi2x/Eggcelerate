import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  RotateCw, Clock, Check, CheckCircle2, Circle, AlertCircle, Calendar, X,
  Zap, BatteryLow, Waves, Droplet, Wifi, WifiOff,
  Flame, Fan, Camera, Egg, Plus,
  Activity, ScanSearch, Settings2, Plug, Sun,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { GaugeDial } from "../GaugeDial";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../ui/dialog";
import { FertilityIcon, TrayFertilityBar, fertilityTones } from "../candling/EggIcons";
import {
  Incubator, Mode, CandlingLogEntry, DevelopmentCheck, developmentCheckLabels,
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
const CANDLE_SHORT_LABELS = ["1ST CANDLING", "2ND CANDLING", "LOCKDOWN"];

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
function SectionCard({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW }}>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 min-h-[32px]">
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

// ─── Journal entry card (hangs off the vertical timeline axis) ───────────────
function JournalEntryCard({ entry, modeName, onAddPhotos, onUpdateNote }: {
  entry: CandlingLogEntry; modeName: string;
  onAddPhotos: (day: number, urls: string[]) => void;
  onUpdateNote: (day: number, note: string) => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const [noteDraft, setNoteDraft] = useState(entry.note);
  const [noteEdited, setNoteEdited] = useState(false);
  const [noteEditing, setNoteEditing] = useState(false);

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
    const room = Math.max(0, MAX_PHOTOS - entry.photos.length);
    const allowed = accepted.slice(0, room);
    if (accepted.length > room) {
      toast.error(`Max ${MAX_PHOTOS} photos per entry — extra files skipped`);
    }
    const urls: string[] = [];
    let loaded = 0;
    allowed.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) urls.push(e.target.result as string);
        loaded++;
        if (loaded === allowed.length) onAddPhotos(entry.day, urls);
      };
      reader.readAsDataURL(file);
    });
  };

  const total = entry.fertile + entry.clear + entry.uncertain;
  // One decimal reads as a real hatchery figure without implying false precision.
  const fertilePct = total > 0 ? `${((entry.fertile / total) * 100).toFixed(1)}%` : undefined;

  const summary = [
    { kind: "fertile" as const, label: "Fertile", value: entry.fertile },
    { kind: "clear" as const, label: "Clear", value: entry.clear },
    { kind: "uncertain" as const, label: "Uncertain", value: entry.uncertain },
  ];

  return (
    <Card style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW }}>
      <CardContent style={{ padding: 18 }}>
        {/* Subtitle — session identity line inside the card body. */}
        <p className="mb-3" style={{ color: "#8A6B52", fontSize: 13, fontWeight: 600 }}>
          Day {entry.day} · {modeName}
          {fertilePct ? ` · ${fertilePct} Viable` : ""}
        </p>

        {/* Summary badges — fertile / clear / uncertain tallies */}
        <div className="mb-3 flex flex-wrap gap-2">
          {summary.map((s) => (
            <span
              key={s.kind}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1"
              style={{ backgroundColor: fertilityTones[s.kind].bg, color: fertilityTones[s.kind].text, fontSize: 12, fontWeight: 700 }}
            >
              <FertilityIcon kind={s.kind} size={13} /> {s.value} {s.label}
            </span>
          ))}
        </div>

        {/* Development checklist tags */}
        {entry.checks.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
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

        {/* Notes snippet beside the 60×60 photo thumbnails */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[180px] flex-1">
          {noteEditing ? (
            <>
              <textarea
                value={noteDraft}
                autoFocus
                onChange={(e) => { setNoteDraft(e.target.value.slice(0, NOTES_MAX)); setNoteEdited(e.target.value !== entry.note); }}
                maxLength={NOTES_MAX}
                placeholder="Add observations — veining, air cell development, movement…"
                rows={3}
                className="w-full resize-none rounded-xl px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{ border: `1px solid ${INPUT_BORDER}`, backgroundColor: "#F2EEE5", fontSize: 14, color: TEXT }}
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
              onClick={() => setNoteEditing(true)}
              className="w-full rounded-xl px-3.5 py-3 text-left transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{
                backgroundColor: "#F2EEE5",
                border: `1px solid ${INPUT_BORDER}`,
                borderLeft: `3px solid ${RUST}66`,
                cursor: "pointer",
              }}
              aria-label="Edit inspector notes"
            >
              <span style={{ fontSize: 14, color: entry.note ? TEXT : MUTED, fontStyle: entry.note ? "italic" : "normal" }}>
                {entry.note ? `“${entry.note}”` : "Add observations — veining, air cell development, movement…"}
              </span>
            </button>
          )}
        </div>

        {/* 60×60 photo thumbnails + add tile */}
        <div className="flex shrink-0 flex-wrap gap-2">
          {entry.photos.map((url, i) => (
            <img key={i} src={url} alt={`Candling photo ${i + 1}`} className="rounded-lg object-cover" style={{ width: 60, height: 60, border: `1px solid ${BORDER}` }} />
          ))}
          <button
            onClick={() => photoRef.current?.click()}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ width: 60, height: 60, border: `1.5px dashed #C9B182`, backgroundColor: SURFACE, cursor: "pointer" }}
            aria-label="Add photo"
          >
            <Plus size={15} color={MUTED} />
            <span style={{ fontSize: 9, color: MUTED, fontWeight: 600 }}>Photo</span>
          </button>
          <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => readFiles(e.target.files)} />
        </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── "Record Candling Session" modal ─────────────────────────────────────────
function LogModal({ open, onOpenChange, candling, candled, currentDay, totalDays, totalEggsSet, modeName, onSubmit }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candling: { day: number; label: string; dayRange: string }[];
  candled: Record<number, boolean>;
  currentDay: number;
  totalDays: number;
  totalEggsSet: number;
  modeName: string;
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
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function LogModalBody({ candling, candled, currentDay, totalDays, totalEggsSet, modeName, onSubmit, onCancel }: {
  candling: { day: number; label: string; dayRange: string }[];
  candled: Record<number, boolean>;
  currentDay: number;
  totalDays: number;
  totalEggsSet: number;
  modeName: string;
  onSubmit: (form: CandleForm) => void;
  onCancel: () => void;
}) {
  const available = candling.filter((c) => !candled[c.day]);
  const photoRef = useRef<HTMLInputElement>(null);

  const initialOpt = available[0] ? String(available[0].day) : String(candling[0]?.day ?? 5);
  const [selectedOption, setSelectedOption] = useState<string>(initialOpt);
  const [customDayRaw, setCustomDayRaw] = useState<string>("8");

  const initialTargetDay = available[0]?.day ?? candling[0]?.day ?? 5;
  const [form, setForm] = useState<CandleForm>(emptyForm(initialTargetDay));
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
    const room = Math.max(0, MAX_PHOTOS - form.photos.length);
    const allowed = accepted.slice(0, room);
    if (accepted.length > room) {
      toast.error(`Max ${MAX_PHOTOS} photos per inspection — extra files skipped`);
    }
    const urls: string[] = [];
    let loaded = 0;
    allowed.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) urls.push(e.target.result as string);
        loaded++;
        if (loaded === allowed.length) setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
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
          Record Candling Session
        </DialogTitle>
        <DialogDescription style={{ fontSize: 13, color: MUTED }}>
          Log the tallies and observations from this inspection.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-5 pb-1">
        {/* Checkpoint Selection */}
        <div>
          <Label style={{ fontSize: 13, color: TEXT }}>Checkpoint</Label>
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
              <SelectItem value={String(candling[0]?.day ?? 5)}>1st Candling</SelectItem>
              <SelectItem value={String(candling[1]?.day ?? 11)}>2nd Candling</SelectItem>
              <SelectItem value={String(candling[2]?.day ?? 15)}>3rd Candling (Lockdown)</SelectItem>
              <SelectItem value="custom">Custom Day...</SelectItem>
            </SelectContent>
          </Select>

          {/* Dynamic Custom Day Number Input when "Custom Day..." is selected */}
          {selectedOption === "custom" && (
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
              {customDayError ? (
                <p className="mt-1.5 flex items-center gap-1" style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
                  <AlertCircle size={13} /> Day must be between 1 and {totalDays}
                </p>
              ) : (
                <p className="mt-1" style={{ fontSize: 12, color: MUTED }}>
                  Log an ad-hoc candling inspection on Day {customDayNum || 1}.
                </p>
              )}
            </div>
          )}

          {selectedOption !== "custom" && target && target.day > currentDay && (
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
                  className="mt-1 flex items-center justify-center gap-1"
                  style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}
                >
                  <FertilityIcon kind={f.key} size={12} /> {f.label}
                </label>
              </div>
            ))}
          </div>

          {isTallyOverCapacity ? (
            <p className="mt-1.5 flex items-center gap-1" style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
              <AlertCircle size={13} /> Total inspected eggs cannot exceed eggs set ({totalEggsSet})
            </p>
          ) : (
            <p className="mt-1.5" style={{ fontSize: 12, color: MUTED }}>
              {inspected} egg{inspected === 1 ? "" : "s"} recorded · {modeName} (Max {totalEggsSet})
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
                <img key={i} src={url} alt="" className="rounded-lg object-cover" style={{ width: 60, height: 60, border: `1px solid ${BORDER}` }} />
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
          <CheckCircle2 size={15} /> Save Inspection
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
  const [showLogForm, setShowLogForm] = useState(false);

  const heaterOn = unit.temp < mode.targetTemp.max;
  const overheating = unit.temp > mode.targetTemp.max;
  const fanOn = heaterOn || overheating;
  const mistOn = unit.humidity < mode.targetHumidity.max && unit.waterLevel > 0;

  const waterSt = waterState(unit.waterLevel);
  const waterInfo = getWaterStatusInfo(unit.waterLevel);
  const waterLow = waterSt !== "ok";
  const waterTone = waterSt === "critical" ? CRIT : waterSt === "warning" ? WARN : OK;

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
      day: form.targetDay, label, date: todayStr(),
      fertile: form.fertile, clear: form.clear, uncertain: form.uncertain,
      note: form.note.trim(), photos: form.photos, checks: form.checks,
    };
    onUpdate({
      candled: { ...unit.candled, [form.targetDay]: true },
      candlingLog: [entry, ...unit.candlingLog.filter((e) => e.day !== form.targetDay)],
    });
    setShowLogForm(false);
    toast.success(`${label} saved`, {
      description: `${entry.fertile} fertile · ${entry.clear} clear · ${entry.uncertain} uncertain.`,
    });
  };

  const addPhotosToEntry = (day: number, urls: string[]) =>
    onUpdate({ candlingLog: unit.candlingLog.map((e) => e.day === day ? { ...e, photos: [...e.photos, ...urls] } : e) });

  const updateEntryNote = (day: number, note: string) =>
    onUpdate({ candlingLog: unit.candlingLog.map((e) => e.day === day ? { ...e, note } : e) });

  const changeMode = (modeId: string) => {
    const m = modes.find((x) => x.id === modeId)!;
    onUpdate({ modeId, turnInterval: m.defaultTurnInterval });
    toast(`Mode changed to ${m.name}`, { description: "Turning interval reset to mode default." });
  };

  const handleTurn = () => {
    onUpdate({
      lastTurned: new Date().toISOString(),
      nextTurn: new Date(Date.now() + unit.turnInterval * 3_600_000).toISOString(),
    });
    toast.success(`${unit.name}: eggs turned`, { description: `Next turn in ${unit.turnInterval} hours.` });
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


  const PowerIcon = unit.powerSource === "grid" ? Plug : unit.powerSource === "solar" ? Sun : unit.batteryPct <= 25 ? BatteryLow : Zap;
  const powerLabel = unit.powerSource === "grid" ? "Grid Power" : unit.powerSource === "solar" ? "Solar" : "Battery";

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
          <SectionCard title="Incubation Timeline" titleExtra={<TimelineLegend />}>
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
              <Button onClick={handleTurn} className="mt-3 w-full rounded-full" style={rustBtn}>
                <RotateCw size={15} /> Turn Now
              </Button>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ════════════════ CANDLING & INSPECTION ════════════════ */}
      {tab === "candling" && (
        <div className="space-y-5">

          {/* Timeline header */}
          <SectionCard
            title="Incubation Timeline"
            titleExtra={<TimelineLegend />}
            action={unloggedCount > 0 && (
              <Button onClick={() => setShowLogForm(true)} className="rounded-full" style={{ ...rustBtn, fontSize: 13 }}>
                <Plus size={14} /> Log Inspection
              </Button>
            )}
          >
            <Timeline currentDay={currentDay} totalDays={totalDays} candling={candling} candled={unit.candled} interactive />
          </SectionCard>

          <LogModal
            open={showLogForm}
            onOpenChange={setShowLogForm}
            candling={candling}
            candled={unit.candled}
            currentDay={currentDay}
            totalDays={totalDays}
            totalEggsSet={EGGS_PER_MODE[unit.modeId] ?? 42}
            modeName={mode.name}
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
                    className="z-10 whitespace-nowrap"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#78716C",
                      height: 16,
                      lineHeight: "16px",
                      textAlign: "center",
                    }}
                  >
                    DAY
                  </span>

                  {/* Axis Track Line: 2px vertical stroke (#EAE7E1) starting directly below the "DAY" label */}
                  <span
                    aria-hidden
                    className="absolute z-0"
                    style={{
                      top: 16,
                      bottom: 10,
                      width: 2,
                      backgroundColor: "#EAE7E1",
                      left: "50%",
                      transform: "translateX(-50%)",
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
                          {/* Header bar: "1st Candling Done ✓" + Date */}
                          <div className="flex flex-wrap items-center justify-between gap-2" style={{ minHeight: 32 }}>
                            <p className="flex flex-wrap items-center gap-1.5" style={{ fontSize: 16, fontWeight: 700, color: "#1C1917" }}>
                              {n.idx >= 0 ? (CANDLE_SHORT_LABELS[n.idx] ?? n.entry.label) : n.entry.label} Done
                              <Check size={15} color={OK.fg} strokeWidth={3.5} />
                            </p>
                            <span className="whitespace-nowrap" style={{ fontSize: 13, color: "#8A6B52" }}>
                              {fmtDate(n.entry.date)}
                            </span>
                          </div>
                          {/* Journal Card */}
                          <div style={{ marginTop: 12 }}>
                            <JournalEntryCard
                              entry={n.entry}
                              modeName={mode.name}
                              onAddPhotos={addPhotosToEntry}
                              onUpdateNote={updateEntryNote}
                            />
                          </div>
                        </div>
                      </li>
                    ) : (
                      <li key={`cp-${n.day}`} className="relative flex items-center min-h-[32px]">
                        {/* 40px Left Axis Column Container for Node Circle */}
                        <div className="shrink-0 flex justify-center relative z-10" style={{ width: 40 }}>
                          {/* Node Circle (32x32px outlined circle #EAE7E1 with day number) */}
                          <span
                            className="flex items-center justify-center rounded-full"
                            style={{
                              width: 32,
                              height: 32,
                              backgroundColor: "#FFFFFF",
                              border: "2px solid #EAE7E1",
                              color: "#3D3228",
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
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#8A6B52" }}>
                            {CANDLE_SHORT_LABELS[n.idx] ?? n.cp.label} · {n.cp.day <= currentDay ? "Due" : "Upcoming"}
                          </p>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>

            {/* RIGHT — summary */}
            <div className="space-y-5 lg:col-span-2">
              <SectionCard title="Current Cycle Summary">
                <div className="space-y-2.5">
                  {[
                    { label: "TOTAL FERTILE", value: candSummary.fertile, bg: "#DCFCE7", text: "#16A34A" },
                    { label: "TOTAL CLEAR", value: candSummary.clear, bg: "#F3F4F6", text: "#525252" },
                    { label: "TOTAL UNCERTAIN", value: candSummary.uncertain, bg: "#FEF3C7", text: "#D97706" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-2">
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#78716C" }}>
                        {row.label}
                      </span>
                      <span
                        className="rounded-full px-2.5 py-0.5"
                        style={{
                          backgroundColor: row.bg,
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
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#78716C" }}>
                      VIABILITY RATE
                    </span>
                    <span style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 22, fontWeight: 700, color: viabilityRate >= 70 ? OK.fg : WARN.fg }}>
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
        <div className="space-y-5">

          <SectionCard title="Incubation mode">
            <InnerTile>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{mode.name}</p>
                  <p style={{ color: MUTED, fontSize: 12 }}>
                    {mode.incubationDays} days · {mode.targetTemp.min}–{mode.targetTemp.max}°C · {mode.targetHumidity.min}–{mode.targetHumidity.max}% RH
                  </p>
                </div>
                <Select value={unit.modeId} onValueChange={changeMode}>
                  <SelectTrigger className="w-[180px] rounded-full" style={{ backgroundColor: SURFACE }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modes.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </InnerTile>
          </SectionCard>

          <SectionCard title="Turning configuration">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>Automatic turning</p>
                  <p style={{ color: MUTED, fontSize: 12 }}>Turn eggs on schedule automatically.</p>
                </div>
                <Switch checked={unit.autoTurn} onCheckedChange={(v) => onUpdate({ autoTurn: v })} />
              </div>
              <div>
                <Label htmlFor="interval" style={{ fontSize: 13, color: TEXT }}>Turn every (hours)</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <Input id="interval" type="number" min={1} max={12} value={unit.turnInterval}
                    onChange={(e) => onUpdate({ turnInterval: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })}
                    className="w-28 rounded-xl" style={{ borderColor: "rgba(120,53,15,0.20)", backgroundColor: SURFACE }} />
                  <span style={{ color: MUTED, fontSize: 13 }}>Mode default: {mode.defaultTurnInterval}h</span>
                </div>
              </div>
              <InnerTile>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2" style={{ color: MUTED, fontSize: 13 }}>
                    <Clock size={14} /> Next turn
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: next.overdue ? CRIT.fg : TEXT }}>{next.text}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span style={{ color: MUTED, fontSize: 13 }}>Last turned</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>{relTime(unit.lastTurned)}</span>
                </div>
              </InnerTile>
              <Button onClick={handleTurn} className="w-full rounded-full" style={rustBtn}>
                <RotateCw size={15} /> Turn Now
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Water reservoir">
            <InnerTile tone={waterLow ? waterTone.fg : undefined}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2" style={{ color: waterLow ? waterTone.fg : MUTED, fontSize: 13 }}>
                  <Waves size={14} /> Water level
                </span>
                <span style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 22, fontWeight: 700, color: waterLow ? waterTone.fg : TEXT }}>
                  {unit.waterLevel}%
                </span>
              </div>
              <Progress value={unit.waterLevel} className="mt-2.5 h-2" />
              <div className="mt-2 flex items-center justify-between">
                <span style={{ color: waterInfo.color, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {waterInfo.label}
                </span>
                <span style={{ color: MUTED, fontSize: 12 }}>
                  Last refilled: {relTime(unit.lastRefilled)}
                </span>
              </div>
            </InnerTile>
            <Button onClick={handleRefill} variant="outline" className="mt-3 w-full rounded-full" style={outlineBtn}>
              <Droplet size={15} /> Mark as Refilled
            </Button>
          </SectionCard>

          <SectionCard title="Device & connection">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <KeyValue
                label="Power Source"
                value={
                  <span className="flex items-center gap-1.5">
                    <PowerIcon size={15} color={unit.batteryPct <= 25 && unit.powerSource === "battery" ? CRIT.fg : RUST} />
                    {powerLabel} {unit.batteryPct}%
                  </span>
                }
              />
              <KeyValue label="Device ID" value={unit.deviceId} />
              <KeyValue
                label="Connection Status"
                accent={unit.paired ? OK.fg : CRIT.fg}
                value={
                  <span className="flex items-center gap-1.5">
                    {unit.paired ? <Wifi size={15} /> : <WifiOff size={15} />}
                    {unit.paired ? "Connected & Paired" : "Connection Lost"}
                  </span>
                }
              />
              <div className="rounded-xl p-3.5" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Battery</p>
                <div className="flex items-center gap-2">
                  <Progress value={unit.batteryPct} className="h-2 flex-1" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: unit.batteryPct <= 25 ? CRIT.fg : TEXT }}>{unit.batteryPct}%</span>
                </div>
              </div>
            </div>
            {!unit.paired && (
              <Button variant="outline" className="mt-3 rounded-full" style={outlineBtn}
                onClick={() => { onUpdate({ paired: true }); toast.success(`${unit.name} reconnected`); }}>
                <WifiOff size={14} /> Reconnect device
              </Button>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
