import { Warning, WarningOctagon } from "@phosphor-icons/react";
import type { UnitStatus } from "../domain/types";
import { FilledCheckIcon as CheckCircle } from "./icons/CheckIcon";
import { statusLabels } from "./statusPresentation";

// Semantic status palette — WCAG AA contrast on each tinted background.
const styles: Record<
  UnitStatus,
  { bg: string; fg: string; Icon: typeof CheckCircle }
> = {
  optimal: {
    bg: "var(--status-success-bg)",
    fg: "var(--status-success-fg)",
    Icon: CheckCircle,
  },
  warning: {
    bg: "var(--status-warning-bg)",
    fg: "var(--status-warning-fg)",
    Icon: ({ size }) => <Warning size={size} weight="fill" />,
  },
  alert: {
    bg: "var(--status-danger-bg)",
    fg: "var(--status-danger-fg)",
    Icon: ({ size }) => <WarningOctagon size={size} weight="fill" />,
  },
};

export function StatusBadge({ status }: { status: UnitStatus }) {
  const { bg, fg, Icon } = styles[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full"
      style={{
        backgroundColor: bg,
        color: fg,
        height: "var(--control-height-pill)",
        padding: "var(--pill-padding)",
      }}
    >
      <Icon size={14} />
      <span
        className="whitespace-nowrap"
        style={{
          fontWeight: "var(--weight-semibold)",
          fontSize: "var(--type-caption)",
        }}
      >
        {statusLabels[status]}
      </span>
    </span>
  );
}
