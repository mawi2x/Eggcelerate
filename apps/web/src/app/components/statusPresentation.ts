import type { ReadingState, UnitStatus } from "../domain/types";

export function getWaterStatusInfo(ok: boolean): {
  label: string;
  color: string;
} {
  return ok
    ? { label: "Normal", color: "var(--status-success-fg)" }
    : { label: "Low", color: "var(--status-danger-fg)" };
}

export const readingStateColors: Record<ReadingState, string> = {
  ok: "var(--text-primary)",
  warning: "var(--status-warning-fg)",
  critical: "var(--status-danger-fg)",
};

export const statusLabels: Record<UnitStatus, string> = {
  optimal: "Optimal",
  warning: "Needs Attention",
  alert: "Urgent",
};
