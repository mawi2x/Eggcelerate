import { CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";
import { UnitStatus, statusLabels } from "../data/mockData";

// Semantic status palette — WCAG AA contrast on each tinted background.
const styles: Record<UnitStatus, { bg: string; fg: string; Icon: typeof CheckCircle2 }> = {
  optimal: { bg: "#DCFCE7", fg: "#16A34A", Icon: CheckCircle2 },
  warning: { bg: "#FEF3C7", fg: "#D97706", Icon: AlertTriangle },
  alert: { bg: "#FEE2E2", fg: "#DC2626", Icon: AlertOctagon },
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
