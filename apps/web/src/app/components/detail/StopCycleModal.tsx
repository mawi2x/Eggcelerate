import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

interface StopCycleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitName: string;
  onConfirm: () => Promise<boolean>;
}

export function StopCycleModal({
  open,
  onOpenChange,
  unitName,
  onConfirm,
}: StopCycleModalProps) {
  const [isStopping, setIsStopping] = useState(false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!isStopping) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop this cycle?</AlertDialogTitle>
          <AlertDialogDescription>
            This will stop {unitName} before the expected hatch period and
            archive the record as Stopped Early. It will not be counted as a
            completed hatch.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isStopping}>
            Keep Cycle
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isStopping}
            aria-busy={isStopping}
            onClick={(event) => {
              event.preventDefault();
              setIsStopping(true);
              void onConfirm().then((stopped) => {
                setIsStopping(false);
                if (stopped) onOpenChange(false);
              });
            }}
          >
            {isStopping ? "Stopping…" : "Stop Cycle"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
