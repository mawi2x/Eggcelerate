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
  onConfirm: () => void;
}

export function StopCycleModal({
  open,
  onOpenChange,
  unitName,
  onConfirm,
}: StopCycleModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop this cycle?</AlertDialogTitle>
          <AlertDialogDescription>
            This will stop {unitName} before the expected hatch period and archive the record as Stopped Early. It will not be counted as a completed hatch.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Cycle</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Stop Cycle</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
