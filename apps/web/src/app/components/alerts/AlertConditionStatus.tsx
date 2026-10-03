import type { AlertEntry } from "../../domain/types";

/** Device condition state is independent of the notification's read state. */
export function AlertConditionStatus({ alert }: { alert: AlertEntry }) {
  if (!alert.conditionState) return null;
  const label =
    alert.conditionState === "active"
      ? "Active condition"
      : alert.resolutionReason === "configuration_changed"
        ? "Closed · configuration changed"
        : alert.resolutionReason === "monitoring_ended"
          ? "Closed · monitoring ended"
          : "Resolved · recovered";
  return (
    <p
      className="mt-1 break-words text-xs font-semibold"
      style={{
        color:
          alert.conditionState === "active"
            ? "var(--status-danger-fg)"
            : "var(--text-muted)",
      }}
      title={
        alert.resolvedAt
          ? `Closed ${new Date(alert.resolvedAt).toLocaleString()}`
          : "Reading or dismissing this notification does not resolve the condition"
      }
    >
      {label}
    </p>
  );
}
