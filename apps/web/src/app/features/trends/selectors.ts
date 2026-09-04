import { calculateHatchabilityRate } from "../../domain/fertility";
import type { HatchRecord } from "../../domain/types";

export type HatchWithPct = HatchRecord & { pct: number | null };

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

export function selectHatchKpis(withPct: HatchWithPct[]): {
  cycles: number;
  hatched: number;
  avgRate: number | null;
} {
  const cycles = withPct.length;
  const hatched = withPct.reduce((s, h) => s + h.hatchedEggs, 0);
  const fertileEggs = withPct.reduce((s, h) => s + (h.fertileEggs ?? 0), 0);
  const avgRate = calculateHatchabilityRate(
    hatched,
    fertileEggs > 0 ? fertileEggs : null,
  );
  return { cycles, hatched, avgRate };
}
