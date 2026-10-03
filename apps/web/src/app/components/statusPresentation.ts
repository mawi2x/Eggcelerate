import { CircleNotch, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import type { Incubator, ReadingState, UnitStatus } from "../domain/types";

export function getConnectionPresentation(
  unit: Pick<Incubator, "paired" | "connectionState">,
) {
  if (unit.connectionState === "connecting") {
    return {
      label: "Connecting",
      color: "var(--status-warning-fg)",
      Icon: CircleNotch,
    };
  }
  if (!unit.paired) {
    return {
      label: "Not paired",
      color: "var(--text-muted)",
      Icon: WifiSlash,
    };
  }
  if (unit.connectionState === "connected") {
    return {
      label: "Connected and Paired",
      color: "var(--status-success-fg)",
      Icon: WifiHigh,
    };
  }
  return {
    label: "Connection Lost",
    color: "var(--status-danger-fg)",
    Icon: WifiSlash,
  };
}

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
