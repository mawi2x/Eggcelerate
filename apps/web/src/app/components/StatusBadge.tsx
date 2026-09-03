import { CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";
import { statusLabels } from "./statusPresentation";
import type { UnitStatus } from "../domain/types";

// Semantic status palette — WCAG AA contrast on each tinted background.
const styles: Record<UnitStatus, { bg: string; fg: string; Icon: typeof CheckCircle2 }> = {
  optimal: { bg: "var(--status-success-bg)", fg: "var(--status-success-fg)", Icon: CheckCircle2 },
  warning: { bg: "var(--status-warning-bg)", fg: "var(--status-warning-fg)", Icon: AlertTriangle },
  alert: { bg: "var(--status-danger-bg)", fg: "var(--status-danger-fg)", Icon: AlertOctagon },
};

export function StatusBadge({ status }: { status: UnitStatus }) {
  const { bg, fg, Icon } = styles[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full"
      style={{ backgroundColor: bg, color: fg, height: 24, padding: "4px 10px" }}
    >
      <Icon size={13} strokeWidth={2.5} />
      <span className="whitespace-nowrap" style={{ fontWeight: 600, fontSize: "0.75rem" }}>{statusLabels[status]}</span>
    </span>
  );
}
