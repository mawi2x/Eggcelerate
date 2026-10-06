import type { ReactNode } from "react";
import { CURRENT_TRAY_CAPACITY } from "../../domain/candling";
import { getKnownFertileEggs } from "../../domain/fertility";
import type { Incubator, Mode } from "../../domain/types";
import { HarvestModal } from "../HarvestModal";
import { ChamberList } from "../incubators/ChamberList";
import { CreateIncubatorDialog } from "../incubators/CreateIncubatorDialog";
import { IncubatorToolbar } from "../incubators/IncubatorToolbar";
import { TEXT } from "../incubators/presentation";
import { useCreateIncubator } from "../incubators/useCreateIncubator";
import { useIncubatorHarvest } from "../incubators/useIncubatorHarvest";
import { useIncubatorList } from "../incubators/useIncubatorList";

interface Props {
  units: Incubator[];
  modes: Mode[];
  onOpenUnit: (id: string) => void;
  onAddIncubator: (unit: Incubator) => Promise<boolean>;
  isAddingIncubator: boolean;
  /** Shell page header rendered inside the sticky toolbar (incubators route). */
  header?: ReactNode;
}

export function IncubatorsScreen({
  units,
  modes,
  onOpenUnit,
  onAddIncubator,
  isAddingIncubator,
  header,
}: Props) {
  const list = useIncubatorList(units, modes);
  const creation = useCreateIncubator(units, modes, onAddIncubator);
  const { harvestUnit, setHarvestUnit, handleHarvestSave } =
    useIncubatorHarvest(modes);
  return (
    <div
      className="incubators-typography space-y-2 md:space-y-6"
      style={{ color: TEXT }}
    >
      <IncubatorToolbar
        model={list}
        modes={modes}
        header={header}
        onAdd={creation.openDialog}
      />
      <ChamberList
        model={list}
        onOpenUnit={onOpenUnit}
        onHarvest={setHarvestUnit}
        onAdd={creation.openDialog}
      />
      <CreateIncubatorDialog
        model={creation}
        isAddingIncubator={isAddingIncubator}
      />

      {/* Final harvest & reset modal */}
      <HarvestModal
        className="incubators-typography"
        open={harvestUnit !== null}
        onOpenChange={(o) => {
          if (!o) setHarvestUnit(null);
        }}
        chamberName={harvestUnit?.name ?? ""}
        totalEggsLoaded={
          harvestUnit
            ? harvestUnit.totalEggsLoaded && harvestUnit.totalEggsLoaded > 0
              ? harvestUnit.totalEggsLoaded
              : CURRENT_TRAY_CAPACITY
            : 0
        }
        fertileEggs={harvestUnit ? getKnownFertileEggs(harvestUnit) : null}
        onSave={(hatched, unhatched) =>
          harvestUnit
            ? handleHarvestSave(harvestUnit, hatched, unhatched)
            : Promise.resolve(false)
        }
      />
    </div>
  );
}
