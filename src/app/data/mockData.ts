// Eggcelerate — mock data & types. Single source of truth for the dashboard.

export type UnitStatus = "optimal" | "warning" | "alert";
export type PowerSource = "grid" | "solar" | "battery";
export type AlertSeverity = "critical" | "warning" | "info";

export interface Range {
  min: number;
  max: number;
}

export interface CandlingCheckpoint {
  label: string;
  dayRange: string;
  day: number;
}

// A Mode is a reusable preset/template — NOT edited per-chamber.
export interface Mode {
  id: string;
  name: string;
  builtIn: boolean;
  targetTemp: Range;
  targetHumidity: Range;
  incubationDays: number;
  defaultTurnInterval: number; // hours
}

// Nominal tray capacity used when an older cycle does not have a stored
// loaded-egg count. Active cycles should always prefer totalEggsLoaded.
export const NOMINAL_EGGS_PER_MODE: Record<string, number> = {
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

export function nominalEggCapacity(modeId: string): number {
  return NOMINAL_EGGS_PER_MODE[modeId] ?? 30;
}

export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Candling days are auto-calculated proportionally to the mode duration.
// Reference: a 21-day cycle candles around days 6 / 13 / 18.
const CANDLE_PROPORTIONS = [6 / 21, 13 / 21, 18 / 21];
const CANDLE_LABELS = ["First candling", "Second candling", "Lockdown check"];

export function computeCandling(durationDays: number): CandlingCheckpoint[] {
  return CANDLE_PROPORTIONS.map((p, i) => {
    const day = Math.max(1, Math.round(p * durationDays));
    const isLast = i === CANDLE_PROPORTIONS.length - 1;
    const dayRange = isLast ? `Day ${day}` : `Day ${Math.max(1, day - 1)}–${day + 1}`;
    return { label: CANDLE_LABELS[i], dayRange, day };
  });
}

// Development observations confirmed during a candling session.
export type DevelopmentCheck = "veining" | "airCell" | "movement";

export const developmentCheckLabels: Record<DevelopmentCheck, string> = {
  veining: "Veining Visible",
  airCell: "Air Cell Normal",
  movement: "Embryo Movement",
};

export interface CandlingLogEntry {
  day: number; // checkpoint day this entry documents
  label: string;
  date: string; // YYYY-MM-DD
  fertile: number;
  clear: number;
  uncertain: number;
  note: string;
  photos: string[]; // data-URLs from candling session
  checks: DevelopmentCheck[]; // development checklist confirmed by the farmer
}

export interface Incubator {
  id: string;
  name: string;
  deviceId: string;
  modeId: string;
  dayOfIncubation: number;
  /** Eggs loaded at cycle start — used for hatch-rate calculation. */
  totalEggsLoaded?: number;
  temp: number; // °C
  humidity: number; // %
  /** Binary float switch: true = closed (water sufficient), false = open (low). */
  waterOk: boolean;
  tempTrend: number;
  humidityTrend: number;
  powerSource: PowerSource;
  batteryPct: number;
  status: UnitStatus;
  lastTurned: string; // ISO
  nextTurn: string; // ISO
  turnInterval: number; // hours (defaults to mode's, editable per-chamber)
  autoTurn: boolean;
  paired: boolean;
  candled: Record<number, boolean>; // keyed by candling day
  candlingLog: CandlingLogEntry[];
}

export type ReadingState = "ok" | "warning" | "critical";

// Binary float switch: closed = sufficient, open = low.
export function waterState(ok: boolean): ReadingState {
  return ok ? "ok" : "critical";
}

export function getWaterStatusInfo(ok: boolean): { label: string; color: string } {
  return ok
    ? { label: "Normal", color: "#16A34A" }
    : { label: "Low", color: "#DC2626" };
}

export function rangeState(value: number, safe: Range): ReadingState {
  return value >= safe.min && value <= safe.max ? "ok" : "critical";
}

export const readingStateColors: Record<ReadingState, string> = {
  ok: "#1A1A1A",
  warning: "#D97706",
  critical: "#DC2626",
};

// Human-readable list of what's wrong with a chamber right now.
export function getUnitIssues(unit: Incubator, mode: Mode): string[] {
  const issues: string[] = [];
  if (unit.temp > mode.targetTemp.max) issues.push("temperature high");
  else if (unit.temp < mode.targetTemp.min) issues.push("temperature low");
  if (unit.humidity > mode.targetHumidity.max) issues.push("humidity high");
  else if (unit.humidity < mode.targetHumidity.min) issues.push("humidity low");
  if (waterState(unit.waterOk) !== "ok") issues.push("water reservoir low");
  if (unit.powerSource === "battery" && unit.batteryPct <= 25) issues.push("battery low");
  if (new Date(unit.nextTurn).getTime() < Date.now()) issues.push("turning overdue");
  if (!unit.paired) issues.push("device disconnected");
  return issues;
}

export interface Reading {
  ts: number; // epoch ms
  time: string; // short label
  temp: number;
  humidity: number;
  water: number;
}

export interface AlertEntry {
  id: string;
  severity: AlertSeverity;
  /** Short headline shown above the message snippet. */
  title: string;
  unit: string;
  message: string;
  timestamp: string; // ISO
  acknowledged: boolean;
}

export const initialModes: Mode[] = [
  { id: "broiler",  name: "Broiler",  builtIn: true, targetTemp: { min: 37.5, max: 37.8 }, targetHumidity: { min: 55, max: 60 }, incubationDays: 21, defaultTurnInterval: 4 },
  { id: "duck",     name: "Duck",     builtIn: true, targetTemp: { min: 37.4, max: 37.6 }, targetHumidity: { min: 62, max: 68 }, incubationDays: 28, defaultTurnInterval: 6 },
  { id: "quail",    name: "Quail",    builtIn: true, targetTemp: { min: 37.5, max: 37.8 }, targetHumidity: { min: 55, max: 60 }, incubationDays: 18, defaultTurnInterval: 4 },
  { id: "goose",    name: "Goose",    builtIn: true, targetTemp: { min: 37.3, max: 37.6 }, targetHumidity: { min: 60, max: 65 }, incubationDays: 30, defaultTurnInterval: 6 },
  { id: "turkey",   name: "Turkey",   builtIn: true, targetTemp: { min: 37.5, max: 37.8 }, targetHumidity: { min: 55, max: 60 }, incubationDays: 28, defaultTurnInterval: 4 },
  { id: "pheasant", name: "Pheasant", builtIn: true, targetTemp: { min: 37.5, max: 37.8 }, targetHumidity: { min: 55, max: 60 }, incubationDays: 24, defaultTurnInterval: 6 },
  { id: "peafowl",  name: "Peafowl",  builtIn: true, targetTemp: { min: 37.2, max: 37.5 }, targetHumidity: { min: 60, max: 65 }, incubationDays: 28, defaultTurnInterval: 6 },
  { id: "swan",     name: "Swan",     builtIn: true, targetTemp: { min: 37.2, max: 37.5 }, targetHumidity: { min: 65, max: 72 }, incubationDays: 36, defaultTurnInterval: 8 },
  { id: "broiler-hh", name: "Broiler High-Humidity", builtIn: false, targetTemp: { min: 37.5, max: 37.8 }, targetHumidity: { min: 62, max: 68 }, incubationDays: 21, defaultTurnInterval: 4 },
  { id: "rapid-quail", name: "Rapid Quail Experimental", builtIn: false, targetTemp: { min: 37.8, max: 38.2 }, targetHumidity: { min: 50, max: 55 }, incubationDays: 17, defaultTurnInterval: 3 },
];

const now = Date.now();
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
const isoAhead = (minutesAhead: number) => new Date(now + minutesAhead * 60_000).toISOString();

// A day-N date string (YYYY-MM-DD) relative to today, for candling log entries.
const dayAgo = (days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return localDateString(date);
};

// Chamber One has a rich inspection history spanning its 9 elapsed days.
const chamberOneLog: CandlingLogEntry[] = [
  { day: 2, label: "Initial candling",     date: dayAgo(7), fertile: 24, clear: 0, uncertain: 0, note: "Fresh set — no development expected yet, baseline air cells marked.", photos: [], checks: ["airCell"] },
  { day: 3, label: "Early veining check",  date: dayAgo(6), fertile: 23, clear: 1, uncertain: 0, note: "Faint spider veining appearing in most eggs. One appears clear.", photos: [], checks: ["veining", "airCell"] },
  { day: 5, label: "Air cell check",       date: dayAgo(4), fertile: 23, clear: 1, uncertain: 0, note: "Air cells developing evenly. Good progress across the tray.", photos: [], checks: ["veining", "airCell"] },
  { day: 6, label: "First candling",       date: dayAgo(3), fertile: 22, clear: 2, uncertain: 0, note: "Strong spider veining observed across 22 eggs. 2 clear infertile eggs removed from tray.", photos: [], checks: ["veining", "airCell"] },
  { day: 7, label: "Fertility recount",    date: dayAgo(2), fertile: 22, clear: 2, uncertain: 0, note: "Recounted after removals — 22 viable, strong dark spots forming.", photos: [], checks: ["veining", "airCell"] },
  { day: 9, label: "Development check",    date: dayAgo(0), fertile: 21, clear: 2, uncertain: 1, note: "Movement observed in several eggs. One uncertain — will recheck at day 13.", photos: [], checks: ["veining", "airCell", "movement"] },
];

// Chamber Twelve is past its 21-day hatch window with fertile eggs still in the
// tray — the "Completed" badge, Extend (+24h), and Harvest & Reset all show.
const chamberTwelveLog: CandlingLogEntry[] = [
  { day: 6, label: "First candling",    date: dayAgo(15), fertile: 36, clear: 4, uncertain: 2, note: "Strong veining across 36 eggs. 4 clears culled, 2 uncertain kept for recheck.", photos: [], checks: ["veining", "airCell"] },
  { day: 13, label: "Second candling",  date: dayAgo(8), fertile: 34, clear: 4, uncertain: 4, note: "Healthy dark spots on 34 eggs. 2 more clears removed; uncertains set aside.", photos: [], checks: ["veining", "airCell", "movement"] },
  { day: 18, label: "Lockdown check",   date: dayAgo(3), fertile: 33, clear: 5, uncertain: 4, note: "Air cells tilted for hatch position. No internal pip yet at lockdown.", photos: [], checks: ["veining", "airCell", "movement"] },
];

export const initialIncubators: Incubator[] = [
  {
    id: "chamber-1", name: "Chamber One", deviceId: "EGG-1003", modeId: "broiler",
    dayOfIncubation: 9,
    totalEggsLoaded: 42, temp: 37.6, humidity: 57, waterOk: true,
    tempTrend: 0.1, humidityTrend: 0.3, powerSource: "grid", batteryPct: 100, status: "optimal",
    lastTurned: iso(95), nextTurn: isoAhead(145), turnInterval: 4, autoTurn: true, paired: true,
    candled: { 6: true }, candlingLog: chamberOneLog,
  },
  {
    id: "chamber-2", name: "Chamber Two", deviceId: "EGG-1004", modeId: "duck",
    dayOfIncubation: 14,
    totalEggsLoaded: 32, temp: 37.5, humidity: 51, waterOk: true,
    tempTrend: -0.1, humidityTrend: -1.4, powerSource: "solar", batteryPct: 82, status: "warning",
    lastTurned: iso(50), nextTurn: isoAhead(190), turnInterval: 6, autoTurn: true, paired: true,
    candled: {}, candlingLog: [],
  },
  {
    id: "chamber-3", name: "Chamber Three", deviceId: "EGG-1005", modeId: "quail",
    dayOfIncubation: 15,
    totalEggsLoaded: 60, temp: 39.2, humidity: 64, waterOk: false,
    tempTrend: 1.3, humidityTrend: 0.2, powerSource: "battery", batteryPct: 23, status: "alert",
    lastTurned: iso(220), nextTurn: isoAhead(-40), turnInterval: 4, autoTurn: false, paired: false,
    candled: {}, candlingLog: [],
  },
  {
    id: "chamber-4", name: "Chamber Four", deviceId: "EGG-1006", modeId: "goose",
    dayOfIncubation: 22,
    totalEggsLoaded: 24, temp: 37.4, humidity: 62, waterOk: true,
    tempTrend: -0.1, humidityTrend: 0.4, powerSource: "grid", batteryPct: 100, status: "optimal",
    lastTurned: iso(40), nextTurn: isoAhead(320), turnInterval: 6, autoTurn: true, paired: true,
    candled: {}, candlingLog: [],
  },
  {
    id: "chamber-5", name: "Chamber Five", deviceId: "EGG-1007", modeId: "turkey",
    dayOfIncubation: 5,
    totalEggsLoaded: 30, temp: 37.7, humidity: 58, waterOk: true,
    tempTrend: 0.2, humidityTrend: -0.2, powerSource: "solar", batteryPct: 91, status: "optimal",
    lastTurned: iso(70), nextTurn: isoAhead(170), turnInterval: 4, autoTurn: true, paired: true,
    candled: {}, candlingLog: [],
  },
  {
    id: "chamber-6", name: "Chamber Six", deviceId: "EGG-1008", modeId: "pheasant",
    dayOfIncubation: 11,
    totalEggsLoaded: 40, temp: 38.1, humidity: 49, waterOk: false,
    tempTrend: 0.5, humidityTrend: -1.1, powerSource: "grid", batteryPct: 100, status: "warning",
    lastTurned: iso(120), nextTurn: isoAhead(240), turnInterval: 6, autoTurn: true, paired: true,
    candled: {}, candlingLog: [],
  },
  {
    id: "chamber-7", name: "Chamber Seven", deviceId: "EGG-1009", modeId: "broiler",
    dayOfIncubation: 1,
    totalEggsLoaded: 42, temp: 37.6, humidity: 56, waterOk: true,
    tempTrend: 0, humidityTrend: 0, powerSource: "grid", batteryPct: 100, status: "optimal",
    lastTurned: iso(20), nextTurn: isoAhead(220), turnInterval: 4, autoTurn: true, paired: true,
    candled: {}, candlingLog: [],
  },
  {
    id: "chamber-8", name: "Chamber Eight", deviceId: "EGG-1010", modeId: "peafowl",
    dayOfIncubation: 18,
    totalEggsLoaded: 24, temp: 39.8, humidity: 42, waterOk: false,
    tempTrend: 1.8, humidityTrend: -2.2, powerSource: "battery", batteryPct: 15, status: "alert",
    lastTurned: iso(300), nextTurn: isoAhead(-90), turnInterval: 6, autoTurn: false, paired: false,
    candled: {}, candlingLog: [],
  },
  {
    id: "chamber-9", name: "Chamber Nine", deviceId: "EGG-1011", modeId: "quail",
    dayOfIncubation: 17,
    totalEggsLoaded: 60, temp: 37.5, humidity: 68, waterOk: true,
    tempTrend: 0, humidityTrend: 0.6, powerSource: "battery", batteryPct: 82, status: "optimal",
    lastTurned: iso(35), nextTurn: isoAhead(205), turnInterval: 4, autoTurn: true, paired: true,
    candled: {}, candlingLog: [],
  },
  {
    id: "chamber-10", name: "Chamber Ten", deviceId: "EGG-1012", modeId: "duck",
    dayOfIncubation: 3,
    totalEggsLoaded: 32, temp: 37.6, humidity: 55, waterOk: true,
    tempTrend: 0.1, humidityTrend: -0.1, powerSource: "grid", batteryPct: 100, status: "optimal",
    lastTurned: iso(60), nextTurn: isoAhead(300), turnInterval: 6, autoTurn: true, paired: true,
    candled: {}, candlingLog: [],
  },
  {
    id: "chamber-11", name: "Chamber Eleven", deviceId: "EGG-1013", modeId: "swan",
    dayOfIncubation: 29,
    totalEggsLoaded: 16, temp: 36.9, humidity: 71, waterOk: false,
    tempTrend: -0.4, humidityTrend: 0.3, powerSource: "battery", batteryPct: 64, status: "warning",
    lastTurned: iso(90), nextTurn: isoAhead(390), turnInterval: 8, autoTurn: true, paired: true,
    candled: {}, candlingLog: [],
  },
  {
    id: "chamber-12", name: "Chamber Twelve", deviceId: "EGG-1014", modeId: "broiler-hh",
    dayOfIncubation: 22,
    totalEggsLoaded: 37, temp: 37.5, humidity: 65, waterOk: true,
    tempTrend: 0, humidityTrend: 0.2, powerSource: "grid", batteryPct: 100, status: "optimal",
    lastTurned: iso(25), nextTurn: isoAhead(215), turnInterval: 4, autoTurn: true, paired: true,
    candled: { 6: true, 13: true, 18: true }, candlingLog: chamberTwelveLog,
  },
];

// Build history spanning the elapsed incubation days so each range filter differs.
export function buildHistory(
  unit: Incubator,
  mode: Mode,
): Reading[] {
  const points: Reading[] = [];
  const stepHours = 2;
  const elapsedDays = Math.max(1, unit.dayOfIncubation);
  const totalPoints = Math.round((elapsedDays * 24) / stepHours);
  const baseTemp = (mode.targetTemp.min + mode.targetTemp.max) / 2;
  const baseHum = (mode.targetHumidity.min + mode.targetHumidity.max) / 2;

  for (let i = totalPoints; i >= 0; i--) {
    const ts = now - i * stepHours * 3_600_000;
    const d = new Date(ts);
    const seed = `${unit.id}:${i}`;
    let hash = 0;
    for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    const noise = ((hash >>> 0) % 1000) / 1000 - 0.5;
    const wobbleT = Math.sin(i / 5) * 0.14 + noise * 0.1;
    const wobbleH = Math.cos(i / 4) * 1.2 + noise * 0.8;
    // slow reservoir drawdown that resets on refills (sawtooth)
    const water = 30 + ((i * 3) % 70);
    let temp = baseTemp + wobbleT;
    let humidity = baseHum + wobbleH;
    // recent excursion for the alert chamber
    if (unit.status === "alert" && i < 8) temp += (8 - i) * 0.2;
    if (unit.status === "warning" && i < 12) humidity -= (12 - i) * 0.4;

    points.push({
      ts,
      time:
        i < 24
          ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : d.toLocaleDateString([], { month: "short", day: "numeric" }),
      temp: Number(temp.toFixed(2)),
      humidity: Number(humidity.toFixed(1)),
      water: Number(water.toFixed(0)),
    });
  }
  return points;
}

export const initialAlerts: AlertEntry[] = [
  {
    id: "a1",
    title: "Temperature Too High",
    severity: "critical",
    unit: "Chamber Three",
    message: "Temperature 39.2°C — above safe range. Check heater and ventilation.",
    timestamp: iso(12),
    acknowledged: false,
  },
  {
    id: "a2",
    title: "Water Reservoir Low",
    severity: "warning",
    unit: "Chamber Three",
    message: "Water reservoir low (12%). Refill the mist maker to keep humidity stable.",
    timestamp: iso(25),
    acknowledged: false,
  },
  {
    id: "a3",
    title: "Egg Turning Overdue",
    severity: "critical",
    unit: "Chamber Three",
    message: "Egg turning overdue by 40 minutes. Turn eggs to prevent sticking.",
    timestamp: iso(40),
    acknowledged: false,
  },
  {
    id: "a4",
    title: "Running on Battery",
    severity: "warning",
    unit: "Chamber Three",
    message: "Running on battery — 23% remaining. Restore power soon.",
    timestamp: iso(65),
    acknowledged: false,
  },
  {
    id: "a5",
    title: "Humidity Out of Range",
    severity: "warning",
    unit: "Chamber Two",
    message: "Humidity 51% — below target. Add water to the reservoir.",
    timestamp: iso(88),
    acknowledged: false,
  },
  {
    id: "a6",
    title: "Water Reservoir Low",
    severity: "warning",
    unit: "Chamber Two",
    message: "Water reservoir at 34% — top up soon.",
    timestamp: iso(110),
    acknowledged: true,
  },
  {
    id: "a7",
    title: "Candling Due",
    severity: "info",
    unit: "Chamber Two",
    message: "Candling reminder: second candling due today.",
    timestamp: iso(130),
    acknowledged: true,
  },
  {
    id: "a8",
    title: "Eggs Turned",
    severity: "info",
    unit: "Chamber One",
    message: "Eggs turned successfully.",
    timestamp: iso(160),
    acknowledged: true,
  },
  {
    id: "a9",
    title: "Grid Power Lost",
    severity: "warning",
    unit: "Chamber Three",
    message: "Grid power lost — switched to battery backup automatically.",
    timestamp: iso(200),
    acknowledged: true,
  },
  {
    id: "a10",
    title: "Daily Summary",
    severity: "info",
    unit: "Chamber One",
    message: "Daily summary: all readings within safe range.",
    timestamp: iso(300),
    acknowledged: true,
  },
  {
    id: "a11",
    title: "Reservoir Refilled",
    severity: "info",
    unit: "Chamber One",
    message: "Water reservoir refilled to 100%.",
    timestamp: iso(360),
    acknowledged: true,
  },
  {
    id: "a12",
    title: "Hatch Day Approaching",
    severity: "info",
    unit: "Chamber Three",
    message: "Hatch day approaching — 3 days until expected hatch.",
    timestamp: iso(500),
    acknowledged: true,
  },
];

export interface HatchRecord {
  id: string;
  chamber: string;
  modeName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalEggs: number;
  hatchedEggs: number;
}

// 12 completed cycles — totals: 167 chicks hatched, Duck the top-performing mode.
export const hatchHistory: HatchRecord[] = [
  { id: "h1",  chamber: "Chamber One",    modeName: "Broiler", startDate: "2026-06-01", endDate: "2026-06-22", totalEggs: 18, hatchedEggs: 16 },
  { id: "h2",  chamber: "Chamber Two",    modeName: "Duck",    startDate: "2026-05-10", endDate: "2026-06-07", totalEggs: 16, hatchedEggs: 14 },
  { id: "h3",  chamber: "Chamber Three",  modeName: "Quail",   startDate: "2026-06-15", endDate: "2026-07-03", totalEggs: 20, hatchedEggs: 17 },
  { id: "h4",  chamber: "Chamber One",    modeName: "Broiler", startDate: "2026-05-01", endDate: "2026-05-22", totalEggs: 17, hatchedEggs: 14 },
  { id: "h5",  chamber: "Chamber Two",    modeName: "Duck",    startDate: "2026-06-20", endDate: "2026-07-18", totalEggs: 15, hatchedEggs: 13 },
  { id: "h6",  chamber: "Chamber Four",   modeName: "Goose",   startDate: "2026-04-12", endDate: "2026-05-12", totalEggs: 12, hatchedEggs: 9 },
  { id: "h7",  chamber: "Chamber Five",   modeName: "Turkey",  startDate: "2026-05-18", endDate: "2026-06-15", totalEggs: 18, hatchedEggs: 15 },
  { id: "h8",  chamber: "Chamber Nine",   modeName: "Quail",   startDate: "2026-06-25", endDate: "2026-07-13", totalEggs: 22, hatchedEggs: 18 },
  { id: "h9",  chamber: "Chamber Ten",    modeName: "Duck",    startDate: "2026-05-05", endDate: "2026-06-02", totalEggs: 14, hatchedEggs: 12 },
  { id: "h10", chamber: "Chamber Seven",  modeName: "Broiler", startDate: "2026-06-08", endDate: "2026-06-29", totalEggs: 16, hatchedEggs: 14 },
  { id: "h11", chamber: "Chamber Eleven", modeName: "Swan",    startDate: "2026-03-20", endDate: "2026-04-25", totalEggs: 10, hatchedEggs: 7 },
  { id: "h12", chamber: "Chamber Twelve", modeName: "Quail",   startDate: "2026-07-01", endDate: "2026-07-19", totalEggs: 20, hatchedEggs: 18 },
];

/** Whole days left before this unit reaches its mode's hatch day. */
export function daysUntilHatch(dayOfIncubation: number, incubationDays: number): number {
  return Math.max(0, incubationDays - dayOfIncubation);
}

/** True within 48 hours of hatch day (e.g. Day 20/21 or Day 27/28). */
export function isHatchingSoon(dayOfIncubation: number, incubationDays: number): boolean {
  return daysUntilHatch(dayOfIncubation, incubationDays) <= 2;
}

/** Save a completed cycle to farm history; returns the hatch rate percentage. */
export function recordHarvest(params: {
  chamber: string; modeName: string; cycleDays: number;
  totalEggs: number; hatchedEggs: number;
}): number {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(0, params.cycleDays - 1));
  const endDate = localDateString(end);
  const startDate = localDateString(start);
  const rate = params.totalEggs > 0 ? Number(((params.hatchedEggs / params.totalEggs) * 100).toFixed(1)) : 0;
  hatchHistory.push({
    id: `h-${Date.now()}`,
    chamber: params.chamber,
    modeName: params.modeName,
    startDate,
    endDate,
    totalEggs: params.totalEggs,
    hatchedEggs: params.hatchedEggs,
  });
  return rate;
}

/** Patch that returns a chamber to the "Ready" state after harvest. */
export function resetChamberToReady(unit: Incubator): Partial<Incubator> {
  const nowIso = new Date().toISOString();
  return {
    dayOfIncubation: 0,
    totalEggsLoaded: 0,
    candled: {},
    candlingLog: [],
    autoTurn: false,
    status: "optimal",
    lastTurned: nowIso,
    nextTurn: new Date(Date.now() + 24 * 3_600_000).toISOString(),
  };
}

export const statusLabels: Record<UnitStatus, string> = {
  optimal: "Optimal",
  warning: "Needs Attention",
  alert: "Alert",
};

export const stateColors = {
  optimal: "#3D9970",
  warning: "#C8623A",
  alert: "#A84323",
  offline: "#E0C068",
  terracotta: "#BE6239",
} as const;
