import { Info, Warning, WarningOctagon } from "@phosphor-icons/react";
import type { AlertSeverity } from "../../domain/types";

/** Icon tile treatment by severity. */
export const severityStyle: Record<
  AlertSeverity,
  { color: string; bg: string; Icon: typeof Info; label: string }
> = {
  critical: {
    color: "var(--status-danger-fg)",
    bg: "var(--status-danger-bg)",
    Icon: WarningOctagon,
    label: "Urgent",
  },
  warning: {
    color: "var(--text-brand-soft)",
    bg: "var(--wash-alert)",
    Icon: Warning,
    label: "Needs Attention",
  },
  info: {
    color: "var(--text-taupe)",
    bg: "var(--wash-taupe)",
    Icon: Info,
    label: "Reminder",
  },
};

export function timeAgo(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
