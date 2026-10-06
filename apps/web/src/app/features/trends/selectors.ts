import { calculateHatchabilityRate } from "../../domain/fertility";
import type { HatchRecord } from "../../domain/types";

export type HatchWithPct = HatchRecord & { pct: number | null };
export type HatchSort = "newest" | "oldest" | "highest" | "lowest";

export function selectSortedHatch(
  records: HatchWithPct[],
  sort: HatchSort,
): HatchWithPct[] {
  const completionOrder = (a: HatchWithPct, b: HatchWithPct) => {
    const aDate = Date.parse(a.endDate);
    const bDate = Date.parse(b.endDate);
    if (!Number.isFinite(aDate) || !Number.isFinite(bDate)) {
      if (Number.isFinite(aDate)) return -1;
      if (Number.isFinite(bDate)) return 1;
      return a.id.localeCompare(b.id);
    }
    const direction = sort === "oldest" ? 1 : -1;
    return direction * (aDate - bDate) || a.id.localeCompare(b.id);
  };
  return [...records].sort((a, b) => {
    if (sort === "highest" || sort === "lowest") {
      // Unknown hatchability stays last in either direction.
      if (a.pct === null && b.pct !== null) return 1;
      if (b.pct === null && a.pct !== null) return -1;
      if (a.pct !== null && b.pct !== null) {
        const difference = sort === "highest" ? b.pct - a.pct : a.pct - b.pct;
        if (difference) return difference;
      }
    }
    return completionOrder(a, b);
  });
}

export function selectHatchWithPct(history: HatchRecord[]): HatchWithPct[] {
  return history.map((h) => ({
    ...h,
    pct: calculateHatchabilityRate(h.hatchedEggs, h.fertileEggs),
  }));
}

export function selectFilteredHatch(
  withPct: HatchWithPct[],
  opts: { search: string; species: string },
): HatchWithPct[] {
  const q = opts.search.trim().toLowerCase();
  return withPct.filter((h) => {
    if (opts.species !== "All" && h.modeName !== opts.species) return false;
    if (!q) return true;
    return (
      h.chamber.toLowerCase().includes(q) ||
      h.modeName.toLowerCase().includes(q)
    );
  });
}

export interface HatchSummary {
  cycles: number;
  totalEggs: number;
  hatched: number;
  unhatched: number;
  // Only records with a valid fertility denominator contribute to the rate.
  ratedCycles: number;
  ratedHatched: number;
  ratedFertileEggs: number;
  avgRate: number | null;
}

export function selectHatchSummary(history: HatchRecord[]): HatchSummary {
  const summary: HatchSummary = {
    cycles: history.length,
    totalEggs: 0,
    hatched: 0,
    unhatched: 0,
    ratedCycles: 0,
    ratedHatched: 0,
    ratedFertileEggs: 0,
    avgRate: null,
  };
  for (const record of history) {
    summary.totalEggs += record.totalEggs;
    summary.hatched += record.hatchedEggs;
    if (
      record.fertileEggs !== null &&
      calculateHatchabilityRate(record.hatchedEggs, record.fertileEggs) !== null
    ) {
      summary.ratedCycles += 1;
      summary.ratedHatched += record.hatchedEggs;
      summary.ratedFertileEggs += record.fertileEggs;
    }
  }
  summary.unhatched = summary.totalEggs - summary.hatched;
  summary.avgRate = calculateHatchabilityRate(
    summary.ratedHatched,
    summary.ratedFertileEggs,
  );
  return summary;
}

export function selectHatchSpeciesSummaries(
  history: HatchRecord[],
): (HatchSummary & { species: string })[] {
  const groups = new Map<string, HatchRecord[]>();
  for (const record of history) {
    const group = groups.get(record.modeName) ?? [];
    group.push(record);
    groups.set(record.modeName, group);
  }
  return [...groups]
    .map(([species, records]) => ({
      species,
      ...selectHatchSummary(records),
    }))
    .sort((a, b) => a.species.localeCompare(b.species));
}

export function selectHatchKpis(withPct: HatchWithPct[]): {
  cycles: number;
  hatched: number;
  avgRate: number | null;
} {
  const { cycles, hatched, avgRate } = selectHatchSummary(withPct);
  return { cycles, hatched, avgRate };
}
