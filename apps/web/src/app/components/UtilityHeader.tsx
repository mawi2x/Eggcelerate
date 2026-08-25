import { Bell } from "lucide-react";

interface Props {
  alertCount: number;
  onViewAlerts: () => void;
}

/** Top-right utility cluster: the alerts bell only. */
export function UtilityHeader({ alertCount, onViewAlerts }: Props) {
  return (
    <button
      onClick={onViewAlerts}
      className="relative flex shrink-0 items-center justify-center rounded-2xl border transition-colors hover:bg-[#F5EDD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ height: 52, width: 52, backgroundColor: "var(--surface-card)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
      title="Alerts"
      aria-label={`Alerts, ${alertCount} unread`}
    >
      <Bell size={30} strokeWidth={2} />
      {alertCount > 0 && (
        <span
          className="absolute flex items-center justify-center rounded-full"
          style={{
            top: -6,
            right: -6,
            height: 22,
            minWidth: 22,
            padding: "0 5px",
            backgroundColor: "#D92B0F",
            color: "#FFFFFF",
            fontSize: 12,
            fontWeight: 700,
            border: "2px solid #FAF6F0",
          }}
        >
          {alertCount}
        </span>
      )}
    </button>
  );
}
