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
