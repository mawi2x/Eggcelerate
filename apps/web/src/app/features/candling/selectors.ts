import type { CandlingCheckpoint } from "../../domain/types";

export function selectPendingCheckpoint(
  candling: CandlingCheckpoint[],
  effectiveCandled: Record<number, boolean>,
  currentDay: number,
): CandlingCheckpoint | null {
  return (
    candling.find(
      (checkpoint) => checkpoint.day <= currentDay && !effectiveCandled[checkpoint.day],
    ) ??
    candling.find(
      (checkpoint) => checkpoint.day > currentDay && !effectiveCandled[checkpoint.day],
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
