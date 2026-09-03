import type { Incubator } from "./types";

export function calculateFertilityRate(fertileEggs: number, eggsSet: number): number | null {
  if (
    !Number.isInteger(fertileEggs)
    || !Number.isInteger(eggsSet)
    || fertileEggs < 0
    || eggsSet <= 0
    || fertileEggs > eggsSet
  ) return null;
  return Number(((fertileEggs / eggsSet) * 100).toFixed(1));
}

export function calculateHatchabilityRate(hatchedEggs: number, fertileEggs: number | null): number | null {
  if (
    fertileEggs === null
    || !Number.isInteger(hatchedEggs)
    || !Number.isInteger(fertileEggs)
    || hatchedEggs < 0
    || fertileEggs <= 0
    || hatchedEggs > fertileEggs
  ) return null;
  return Number(((hatchedEggs / fertileEggs) * 100).toFixed(1));
}

export function validateHarvestCounts(params: {
  totalEggs: number;
  fertileEggs: number | null;
  hatchedEggs: number;
}): string | null {
  if (!Number.isInteger(params.totalEggs) || params.totalEggs <= 0) {
    return "Total eggs must be a positive whole number.";
  }
  if (!Number.isInteger(params.hatchedEggs) || params.hatchedEggs < 0 || params.hatchedEggs > params.totalEggs) {
    return `Hatched eggs must be between 0 and ${params.totalEggs}.`;
  }
  if (params.fertileEggs !== null) {
    if (!Number.isInteger(params.fertileEggs) || params.fertileEggs < 0 || params.fertileEggs > params.totalEggs) {
      return `Fertile eggs must be between 0 and ${params.totalEggs}.`;
    }
    if (params.hatchedEggs > params.fertileEggs) {
      return `Hatched eggs cannot exceed the known fertile count of ${params.fertileEggs}.`;
    }
  }
  return null;
}

export function getKnownFertileEggs(unit: Incubator): number | null {
  if (typeof unit.fertileEggs === "number" && unit.fertileEggs > 0) return unit.fertileEggs;
  const earliest = [...unit.candlingLog]
    .filter((entry) => entry.fertile > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  return earliest?.fertile ?? null;
}
