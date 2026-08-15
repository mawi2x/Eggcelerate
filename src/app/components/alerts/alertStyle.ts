import { AlertOctagon, AlertTriangle, Info } from "lucide-react";
import { AlertSeverity } from "../../data/mockData";

/** Icon tile treatment by severity. */
export const severityStyle: Record<
  AlertSeverity,
  { color: string; bg: string; Icon: typeof Info; label: string }
> = {
  critical: { color: "#A84323", bg: "rgba(173,58,29,0.12)", Icon: AlertOctagon, label: "Urgent" },
  warning: { color: "#B04E27", bg: "rgba(203,96,54,0.12)", Icon: AlertTriangle, label: "Needs Attention" },
  info: { color: "#8A6B52", bg: "rgba(138,107,82,0.12)", Icon: Info, label: "Reminder" },
};

export function timeAgo(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
