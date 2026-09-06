import { Bell } from "lucide-react";

interface Props {
  alertCount: number;
  onViewAlerts: () => void;
}

/** Top-right utility cluster: the alerts bell only. */
export function UtilityHeader({ alertCount, onViewAlerts }: Props) {
  return (
    <button
      type="button"
      onClick={onViewAlerts}
      className="relative flex shrink-0 cursor-pointer items-center justify-center rounded-2xl border transition-colors hover:bg-[var(--surface-muted)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
      style={{
        height: "var(--control-size-lg)",
        width: "var(--control-size-lg)",
        backgroundColor: "var(--surface-card)",
        borderColor: "var(--border-default)",
        color: "var(--text-secondary)",
      }}
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
            backgroundColor: "var(--badge-alert-bg)",
            color: "var(--on-brand)",
            fontSize: "var(--type-label)",
            fontWeight: "var(--weight-bold)",
            border: "2px solid var(--surface-app)",
          }}
        >
          {alertCount}
        </span>
      )}
    </button>
  );
}
