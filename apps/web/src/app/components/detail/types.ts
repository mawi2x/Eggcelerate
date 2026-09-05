import { localDateString } from "../../domain/date";
import type { CandlingLogEntry, DevelopmentCheck } from "../../domain/types";

export type DetailTab = "monitor" | "candling" | "settings";
export type MarkerStatus = "logged" | "due" | "upcoming";

export interface CandleForm {
  targetDay: number;
  date: string;
  note: string;
  photos: string[];
  /** Straight tally inputs. There is no per-egg tray map. */
  fertile: number;
  clear: number;
  uncertain: number;
  developing: number;
  stoppedDeveloping: number;
  checkpointType: "first" | "later";
  checks: DevelopmentCheck[];
}

export type TallyKey =
  | "fertile"
  | "clear"
  | "uncertain"
  | "developing"
  | "stoppedDeveloping";

export const CANDLE_SHORT_LABELS = ["1st Candling", "2nd Candling", "Lockdown"];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const NOTES_MAX = 500;
export const UNREACHABLE_DEVICE_IDS = new Set([
  "EGG-0000",
  "EGG-9999",
  "EGG-1005",
  "EGG-1010",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const todayStr = () => localDateString();
export const formatNodeDay = (day: number) =>
  String(day > 99 ? 99 : day).slice(0, 3);

export const emptyForm = (
  day: number,
  previous?: Pick<
    CandlingLogEntry,
    "fertile" | "clear" | "uncertain" | "developing" | "stoppedDeveloping"
  >,
): CandleForm => ({
  targetDay: day,
  date: todayStr(),
  note: "",
  photos: [],
  fertile: previous?.fertile ?? 0,
  clear: previous?.clear ?? 0,
  uncertain: previous?.uncertain ?? 0,
  developing: previous?.developing ?? previous?.fertile ?? 0,
  stoppedDeveloping: previous?.stoppedDeveloping ?? 0,
  checkpointType: "first",
  checks: [],
});

export function markerStatus(
  day: number,
  currentDay: number,
  logged: boolean,
): MarkerStatus {
  if (logged) return "logged";
  if (day <= currentDay) return "due";
  return "upcoming";
}

export function dayFraction(day: number, total: number) {
  return total <= 1 ? 0 : (day - 1) / (total - 1);
}

export function relTime(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  const h = Math.floor(diff / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function pseudoTime(d: string) {
  let h = 0;
  for (const c of d) h = (h * 31 + c.charCodeAt(0)) % 1000;
  const hour = 8 + (h % 10);
  const minute = h % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function fmtTimestamp(d: string) {
  const date = fmtDate(d);
  const time = new Date(`${d}T${pseudoTime(d)}:00`).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} at ${time}`;
}
