import { useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  BORDER,
  CARD,
  MUTED,
  RADIUS,
  RUST,
  SURFACE,
  TEXT,
} from "./detail/types";

/**
 * Finish Cycle modal: log chicks hatched against the eggs loaded at cycle
 * start. Unhatched count and hatchability are derived automatically before the
 * chamber resets back to "Ready".
 */
export function HarvestModal({
  open,
  onOpenChange,
  chamberName,
  totalEggsLoaded,
  fertileEggs,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chamberName: string;
  totalEggsLoaded: number;
  fertileEggs: number | null;
  onSave: (hatched: number, unhatched: number) => Promise<boolean>;
}) {
  const [hatched, setHatched] = useState("0");
  const [isSaving, setIsSaving] = useState(false);

  const hatchedNum = Number(hatched.replace(/[^0-9]/g, "").slice(0, 3)) || 0;
  const unhatchedNum = Math.max(0, totalEggsLoaded - hatchedNum);
  const rate =
    fertileEggs && fertileEggs > 0
      ? Number(((hatchedNum / fertileEggs) * 100).toFixed(1))
      : null;
  const exceedsMax = totalEggsLoaded > 0 && hatchedNum > totalEggsLoaded;
  const valid = totalEggsLoaded > 0 && !exceedsMax;

  const handleHatchedChange = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 3);
    if (!digits) {
      setHatched("");
      return;
    }
    setHatched(String(Math.min(Number(digits), totalEggsLoaded)));
  };

  const save = async () => {
    if (!valid) return;
    setIsSaving(true);
    const saved = await onSave(hatchedNum, unhatchedNum);
    setIsSaving(false);
    if (saved) setHatched("0");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (isSaving) return;
        if (o) {
          setHatched("0");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent
        className="w-[90vw] max-w-[460px] max-h-[88vh] overflow-y-auto p-0 shadow-2xl [&>[data-slot=dialog-close]]:hidden"
        style={{
          backgroundColor: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: RADIUS,
        }}
      >
        <DialogHeader className="px-5 pt-5 text-left">
          <DialogTitle
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--type-heading-md)",
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-snug)",
              color: TEXT,
            }}
          >
            <span className="block">Finish Cycle</span>
            <span
              className="block"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: TEXT,
                marginTop: 2,
              }}
            >
              {chamberName}
            </span>
          </DialogTitle>
          <DialogDescription
            className="mt-1.5"
            style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}
          >
            Enter the final chick count for this batch. Eggs loaded:{" "}
            {totalEggsLoaded}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5">
          <div>
            <Label
              htmlFor="harvest-hatched"
              style={{ fontSize: 13, color: "var(--text-primary)" }}
            >
              Chicks hatched
            </Label>
            <Input
              id="harvest-hatched"
              type="text"
              inputMode="numeric"
              min={0}
              max={totalEggsLoaded}
              maxLength={Math.max(1, String(totalEggsLoaded).length)}
              value={hatched}
              onChange={(e) => handleHatchedChange(e.target.value)}
              placeholder="0"
              className="mt-1.5 rounded-xl text-center"
              style={{
                borderColor: exceedsMax
                  ? "var(--status-danger-fg)"
                  : "var(--input-border)",
                backgroundColor: SURFACE,
                color: "var(--text-primary)",
              }}
              aria-invalid={exceedsMax}
            />
            {exceedsMax && (
              <p
                className="mt-1.5"
                style={{
                  fontSize: 12,
                  color: "var(--status-danger-fg)",
                  fontWeight: 600,
                }}
              >
                Cannot exceed total eggs loaded ({totalEggsLoaded})
              </p>
            )}
            {totalEggsLoaded <= 0 && (
              <p
                className="mt-1.5"
                style={{
                  fontSize: 12,
                  color: "var(--status-danger-fg)",
                  fontWeight: 600,
                }}
              >
                No eggs were loaded for this cycle.
              </p>
            )}
          </div>
          <div
            className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
            style={{
              backgroundColor: CARD,
              border: `1px solid ${BORDER}`,
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                Hatchability
              </span>
              <span
                className="block"
                style={{ fontSize: 12, color: MUTED }}
              >
                {exceedsMax
                  ? `Cannot exceed ${totalEggsLoaded} eggs loaded.`
                  : fertileEggs
                    ? `${hatchedNum} of ${fertileEggs} fertile eggs hatched. ${unhatchedNum} unhatched.`
                    : `Fertility record not available. ${unhatchedNum} unhatched.`}
              </span>
            </div>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--type-heading-md)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
                color: "var(--brand-primary)",
              }}
            >
              {exceedsMax
                ? "Not available"
                : rate === null
                  ? "Not available"
                  : `${rate}%`}
            </span>
          </div>
        </div>

        <div
          className="sticky bottom-0 px-5 py-4"
          style={{ backgroundColor: CARD, borderTop: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void save()}
              disabled={!valid || isSaving}
              aria-busy={isSaving}
              className="rounded-full px-5"
              style={{
                backgroundColor: RUST,
                color: "#fff",
                opacity: !valid || isSaving ? 0.5 : 1,
              }}
            >
              {isSaving ? "Saving…" : "Save & Reset"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
