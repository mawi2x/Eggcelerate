import type { CandlingCheckpoint, CandlingLogEntry } from "../../domain/types";

export type CandlingFeedNode =
  | {
      kind: "logged";
      day: number;
      entry: CandlingLogEntry;
      idx: number;
    }
  | {
      kind: "milestone";
      day: number;
      cp: CandlingCheckpoint;
      idx: number;
    };

export function selectPendingCheckpoint(
  candling: CandlingCheckpoint[],
  effectiveCandled: Record<number, boolean>,
  currentDay: number,
): CandlingCheckpoint | null {
  return (
    candling.find(
      (checkpoint) =>
        checkpoint.day <= currentDay && !effectiveCandled[checkpoint.day],
    ) ??
    candling.find(
      (checkpoint) =>
        checkpoint.day > currentDay && !effectiveCandled[checkpoint.day],
    ) ??
    null
  );
}

export function formatCheckpointTiming(
  pending: CandlingCheckpoint | null,
  currentDay: number,
): string {
  if (!pending) return "All scheduled checks completed";
  const distance = pending.day - currentDay;
  if (distance < 0) {
    const n = Math.abs(distance);
    return `${n} day${n === 1 ? "" : "s"} overdue`;
  }
  if (distance === 0) return "Due today";
  return `In ${distance} day${distance === 1 ? "" : "s"}`;
}

export function selectCandlingFeedNodes(
  candling: CandlingCheckpoint[],
  entries: CandlingLogEntry[],
): CandlingFeedNode[] {
  const nodes: CandlingFeedNode[] = [];
  const coveredDays = new Set<number>();

  candling.forEach((checkpoint, index) => {
    const entry = entries.find((candidate) => candidate.day === checkpoint.day);
    if (entry) {
      nodes.push({
        kind: "logged",
        day: checkpoint.day,
        entry,
        idx: index,
      });
      coveredDays.add(checkpoint.day);
      return;
    }

    nodes.push({
      kind: "milestone",
      day: checkpoint.day,
      cp: checkpoint,
      idx: index,
    });
  });

  entries.forEach((entry) => {
    if (!coveredDays.has(entry.day)) {
      nodes.push({ kind: "logged", day: entry.day, entry, idx: -1 });
    }
  });

  return nodes.sort((a, b) => a.day - b.day);
}

export interface CandlingTallyCounts {
  fertile: number;
  clear: number;
  uncertain: number;
  developing: number;
  stoppedDeveloping: number;
}

interface CandlingTallyContext {
  isLaterCheckpoint: boolean;
  isLockdownCheckpoint: boolean;
  totalEggsSet: number;
  customDayError: boolean;
}

export interface CandlingTallyValidation {
  inspected: number;
  unaccountedEggs: number;
  isTallyOverCapacity: boolean;
  isZeroTally: boolean;
  hasUnresolvedUncertain: boolean;
  hasIncompleteLockdown: boolean;
  isSaveDisabled: boolean;
}

export function selectCandlingTallyValidation(
  counts: CandlingTallyCounts,
  context: CandlingTallyContext,
): CandlingTallyValidation {
  const inspected = context.isLaterCheckpoint
    ? counts.developing +
      counts.clear +
      counts.uncertain +
      counts.stoppedDeveloping
    : counts.fertile + counts.clear + counts.uncertain;
  const unaccountedEggs = Math.max(0, context.totalEggsSet - inspected);
  const isTallyOverCapacity = inspected > context.totalEggsSet;
  const isZeroTally = inspected === 0;
  const hasUnresolvedUncertain =
    context.isLockdownCheckpoint && counts.uncertain > 0;
  const hasIncompleteLockdown =
    context.isLockdownCheckpoint &&
    (hasUnresolvedUncertain || unaccountedEggs > 0);
  const isSaveDisabled =
    isZeroTally ||
    isTallyOverCapacity ||
    context.customDayError ||
    hasIncompleteLockdown;

  return {
    inspected,
    unaccountedEggs,
    isTallyOverCapacity,
    isZeroTally,
    hasUnresolvedUncertain,
    hasIncompleteLockdown,
    isSaveDisabled,
  };
}
