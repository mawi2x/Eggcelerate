import { useState } from "react";
import { toast } from "sonner";
import { CURRENT_TRAY_CAPACITY } from "../../domain/candling";
import {
  calculateHatchabilityRate,
  getKnownFertileEggs,
  validateHarvestCounts,
} from "../../domain/fertility";
import type { Incubator, Mode } from "../../domain/types";
import { useCycleHistoryActions } from "../../features/farm/use-farm-data";

export function useIncubatorHarvest(modes: Mode[]) {
  const { completeCycle } = useCycleHistoryActions();
  const [harvestUnit, setHarvestUnit] = useState<Incubator | null>(null);
  const handleHarvestSave = async (
    unit: Incubator,
    hatched: number,
    _unhatched: number,
  ) => {
    const mode = modes.find((m) => m.id === unit.modeId) ?? modes[0];
    const totalEggs =
      unit.totalEggsLoaded && unit.totalEggsLoaded > 0
        ? unit.totalEggsLoaded
        : CURRENT_TRAY_CAPACITY;
    const fertileEggs = getKnownFertileEggs(unit);
    const hatchedEggs = Math.floor(Number(hatched) || 0);
    const validationError = validateHarvestCounts({
      totalEggs,
      fertileEggs,
      hatchedEggs,
    });
    if (validationError) {
      toast.error(validationError);
      return false;
    }
    const saved = await completeCycle({
      incubatorId: unit.id,
      chamber: unit.name,
      modeName: mode.name,
      cycleDays: Math.max(unit.dayOfIncubation, 1),
      totalEggs,
      fertileEggs,
      hatchedEggs,
    });
    if (!saved) return false;
    const rate = calculateHatchabilityRate(hatchedEggs, fertileEggs);
    setHarvestUnit(null);
    toast.success(`${unit.name}: harvest logged`, {
      description:
        rate === null
          ? "Hatchability is not available because no fertility record was saved. Incubator reset to Ready."
          : `${rate}% hatchability saved to history. Incubator reset to Ready.`,
    });
    return true;
  };

  return { harvestUnit, setHarvestUnit, handleHarvestSave };
}
