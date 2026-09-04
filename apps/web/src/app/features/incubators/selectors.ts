import { daysUntilHatch } from "../../domain/incubator";
import type { Incubator, Mode, UnitStatus } from "../../domain/types";

export type IncubatorStatusFilter = "all" | UnitStatus;

export function selectFilteredIncubators(
  units: Incubator[],
  modes: Mode[],
  opts: { search: string; status: IncubatorStatusFilter; modeId: string },
): Incubator[] {
  const modeOf = (id: string) => modes.find((m) => m.id === id) ?? modes[0];
  const q = opts.search.trim().toLowerCase();
  return units.filter((u) => {
    if (opts.status !== "all" && u.status !== opts.status) return false;
    if (opts.modeId !== "all" && u.modeId !== opts.modeId) return false;
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      modeOf(u.modeId).name.toLowerCase().includes(q)
    );
  });
}

export type IncubatorSortKey = "progress" | "name";

const WORD_TO_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

function getChamberNaturalOrder(name: string): number {
  const lower = name.toLowerCase().trim();
  const digitMatch = lower.match(/\d+/);
  if (digitMatch) return parseInt(digitMatch[0], 10);
  for (const [word, num] of Object.entries(WORD_TO_NUM)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(lower)) return num;
  }
  return 999;
}

export function selectSortedIncubators(
  filtered: Incubator[],
  modes: Mode[],
  opts: { sort: IncubatorSortKey; sortAsc: boolean },
): Incubator[] {
  const modeOf = (id: string) => modes.find((m) => m.id === id) ?? modes[0];
  const remaining = (u: Incubator) => {
    const m = modeOf(u.modeId);
    return daysUntilHatch(u.dayOfIncubation, m.incubationDays);
  };
  const pct = (u: Incubator) => {
    const days = modeOf(u.modeId).incubationDays;
    return days > 0 ? Math.min(1, Math.max(0, u.dayOfIncubation / days)) : 0;
  };
  const byName = (a: Incubator, b: Incubator) => {
    const numA = getChamberNaturalOrder(a.name);
    const numB = getChamberNaturalOrder(b.name);
    if (numA !== numB) return numA - numB;
    return a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  };

  // Action-needed chambers pin to the top regardless of sort key or
  // direction: completed (harvest now — time-critical) first, then ready
  // (setup needed). Everything else keeps the requested ordering.
  const actionRank = (u: Incubator) =>
    u.cyclePhase === "completed" ? 0 : u.cyclePhase === "ready" ? 1 : 2;

  // Copy first — `filtered` is derived state and must not be mutated in place.
  return [...filtered].sort((a, b) => {
    const pin = actionRank(a) - actionRank(b);
    if (pin !== 0) return pin;
    const dir = opts.sortAsc ? 1 : -1;
    if (opts.sort === "progress") {
      return (
        dir * (remaining(a) - remaining(b) || pct(b) - pct(a)) || byName(a, b)
      );
    }
    return dir * byName(a, b);
  });
}
