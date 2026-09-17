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
import { StatusCallout } from "./primitives";

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
      <AlertDialogContent
        className="rounded-2xl border-[var(--border-default)]"
        style={{
          backgroundColor: "var(--surface-subtle)",
          color: "var(--text-primary)",
        }}
      >
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle
            style={{
              color: "var(--text-primary)",
              fontSize: "var(--type-heading-md)",
              fontWeight: "var(--weight-bold)",
            }}
          >
            Stop this cycle?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="mt-2">
              <StatusCallout
                size="sm"
                tone="warning"
                title="Stop cycle"
                description={`This will stop ${unitName} before the expected hatch period and archive the record as Stopped Early. It will not be counted as a completed hatch.`}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="rounded-full"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
              height: 34,
              fontSize: "var(--type-body)",
            }}
            disabled={isStopping}
          >
            Keep Cycle
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-full"
            style={{
              backgroundColor: "var(--status-danger-fg)",
              color: "var(--surface-card)",
              height: 34,
              fontSize: "var(--type-body)",
            }}
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
