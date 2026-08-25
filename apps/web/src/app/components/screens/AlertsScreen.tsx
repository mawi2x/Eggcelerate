import { useMemo, useState } from "react";
import { Check, CheckCheck, X, Eraser } from "lucide-react";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { PaginationBar } from "../ui/pagination-bar";
import { AlertEntry, AlertSeverity } from "../../data/mockData";
import { severityStyle, timeAgo } from "../alerts/alertStyle";
import logoApp from "../../../imports/logo-app.png";

const RUST = "var(--brand-primary)";
const TEXT = "var(--text-primary)";
const MUTED = "var(--text-muted)";
const BORDER = "var(--border-default)";
const CARD_BORDER = "var(--border-subtle)";
const DIVIDER = "#F5F4F0";
const ROW_HOVER = "#FAFAF9";
const ALERTS_PER_PAGE = 10;

/** Severity pill + icon tile tints, tuned for the cream surface. */
const severityTint: Record<AlertSeverity, { tile: string; tileFg: string; pill: string; pillFg: string }> = {
  critical: { tile: "var(--status-danger-bg)", tileFg: "var(--status-danger-fg)", pill: "#FEF2F2", pillFg: "var(--status-danger-fg)" },
  warning: { tile: "var(--status-warning-bg)", tileFg: "var(--status-warning-fg)", pill: "#FFFBEB", pillFg: "var(--status-warning-fg)" },
  info: { tile: "var(--status-info-bg)", tileFg: "var(--status-info-fg)", pill: "#FAFAF9", pillFg: "var(--status-info-fg)" },
};

type Filter = "all" | AlertSeverity;
type SortKey = "recent" | "oldest" | "severity";

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Urgent" },
  { key: "warning", label: "Needs Attention" },
  { key: "info", label: "Reminder" },
];

const severityRank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

interface Props {
  alerts: AlertEntry[];
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
  onMarkAllRead: () => void;
  onClearRead: () => void;
  onOpenUnit?: (unitName: string) => void;
}

export function AlertsScreen({ alerts, onAcknowledge, onDismiss, onMarkAllRead, onClearRead, onOpenUnit }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [alertPage, setAlertPage] = useState(1);
  const [alertsPerPage, setAlertsPerPage] = useState(ALERTS_PER_PAGE);

  const list = useMemo(() => {
    const filtered = alerts.filter((a) => filter === "all" || a.severity === filter);
    const byTime = (a: AlertEntry, b: AlertEntry) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    return [...filtered].sort((a, b) => {
      if (sort === "oldest") return -byTime(a, b);
      if (sort === "severity") return severityRank[a.severity] - severityRank[b.severity] || byTime(a, b);
      return byTime(a, b);
    });
  }, [alerts, filter, sort]);

  const alertPages = Math.max(1, Math.ceil(list.length / alertsPerPage));
  const page = Math.min(alertPage, alertPages);
  const pagedAlerts = list.slice((page - 1) * alertsPerPage, page * alertsPerPage);

  const unreadCount = alerts.filter((a) => !a.acknowledged).length;
  const readCount = alerts.length - unreadCount;

  return (
    <div className="space-y-5">
      {/* ── Controls header — pills left, actions right ─────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = filter === f.key;
            const count = f.key === "all" ? alerts.length : alerts.filter((a) => a.severity === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => {
                  setFilter(f.key);
                  setAlertPage(1);
                }}
                className="rounded-full px-4 py-2 transition-colors"
                style={{
                  backgroundColor: active ? RUST : "#F5EDD8",
                  color: active ? "#fff" : "#5C4636",
                  fontWeight: 600,
                }}
                aria-pressed={active}
              >
                {f.label} <span style={{ opacity: 0.75 }}>({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as SortKey);
              setAlertPage(1);
            }}
          >
            <SelectTrigger
              className="h-10 w-[165px] rounded-xl"
              style={{ borderColor: BORDER, backgroundColor: "#FFFFFF", color: TEXT }}
              aria-label="Sort notifications"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Sort: Recent</SelectItem>
              <SelectItem value="oldest">Sort: Oldest</SelectItem>
              <SelectItem value="severity">Sort: Severity</SelectItem>
            </SelectContent>
          </Select>

          <Button
            className="rounded-xl"
            style={{ backgroundColor: RUST, color: "#fff", minHeight: 40 }}
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={16} /> Mark All as Read
          </Button>

          <Button
            variant="outline"
            className="rounded-xl"
            style={{ borderColor: BORDER, minHeight: 40 }}
            onClick={onClearRead}
            disabled={readCount === 0}
            title="Removes every notification you've already read"
          >
            <Eraser size={16} /> Clear All
          </Button>
        </div>
      </div>

      {/* ── One unified feed container ──────────────────────────────────── */}
      <div
        className="overflow-hidden shadow-sm"
        style={{ backgroundColor: "#FFFFFF", border: `1px solid ${CARD_BORDER}`, borderRadius: 16 }}
      >
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <img
              src={logoApp}
              alt="Eggcelerate logo"
              className="h-24 w-24 rounded-3xl object-cover"
            />
            <h3 style={{ fontSize: 20, color: TEXT }}>All clear here!</h3>
            <p style={{ color: MUTED }}>
              No {filter === "all" ? "" : filter} notifications right now. Your eggs are happy.
            </p>
          </div>
        ) : (
          <>
            <PaginationBar
              className="border-b border-t-0"
              page={page}
              pageSize={alertsPerPage}
              totalItems={list.length}
              itemLabel="alerts"
              pageSizeOptions={[10, 20, 50]}
              onPageSizeChange={(value) => {
                setAlertsPerPage(value);
                setAlertPage(1);
              }}
              onPageChange={setAlertPage}
            />
            <ul>
            {pagedAlerts.map((a, i) => {
              const s = severityStyle[a.severity];
              const tint = severityTint[a.severity];
              return (
                <li
                  key={a.id}
                  className="group flex items-start gap-3.5 transition-colors"
                  style={{
                    padding: "16px 20px",
                    borderBottom: i === pagedAlerts.length - 1 ? "none" : `1px solid ${DIVIDER}`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = ROW_HOVER)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {/* Column 1 — unread dot + icon tile */}
                  <div className="flex shrink-0 items-center gap-2.5" style={{ paddingTop: 2 }}>
                    <span
                      className="rounded-full"
                      style={{
                        width: 6,
                        height: 6,
                        backgroundColor: a.acknowledged ? "transparent" : RUST,
                      }}
                      role="status"
                      aria-label={a.acknowledged ? "Read notification" : "Unread notification"}
                    />
                    <span
                      className="flex items-center justify-center rounded-xl"
                      style={{ width: 36, height: 36, backgroundColor: tint.tile, color: tint.tileFg }}
                    >
                      <s.Icon size={18} />
                    </span>
                  </div>

                  {/* Column 2 — title + chamber over message */}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span
                        className="min-w-0 truncate"
                        style={{ fontSize: 15, fontWeight: 600, color: TEXT }}
                        title={a.title}
                      >
                        {a.title}
                      </span>
                      {onOpenUnit ? (
                        <button
                          type="button"
                          onClick={() => onOpenUnit(a.unit)}
                          className="min-w-0 shrink-0 truncate rounded px-1.5 py-0.5 transition-colors hover:bg-amber-100/60 focus-visible:outline-none focus-visible:ring-1"
                          style={{ fontSize: 13, color: RUST, fontWeight: 600, cursor: "pointer" }}
                          title={`Go to ${a.unit}`}
                        >
                          {a.unit}
                        </button>
                      ) : (
                        <span className="min-w-0 shrink-0 truncate" style={{ fontSize: 13, color: MUTED }}>
                          {a.unit}
                        </span>
                      )}
                    </div>
                    <p className="mt-1" style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
                      {a.message}
                    </p>
                  </div>

                  {/* Column 3 — compact severity pill above timestamp + quick actions */}
                  <div className="flex shrink-0 flex-col items-end gap-2" style={{ minHeight: 44 }}>
                    <span
                      className="rounded-full px-2.5 py-0.5"
                      style={{
                        backgroundColor: tint.pill,
                        color: tint.pillFg,
                        border: `1px solid ${tint.tile}`,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {s.label}
                    </span>

                    <div className="relative h-7 w-[60px]">
                      <span
                        className="absolute inset-0 flex items-center justify-end whitespace-nowrap transition-opacity group-focus-within:opacity-0 group-hover:opacity-0"
                        style={{ fontSize: 11, color: MUTED }}
                      >
                        {timeAgo(a.timestamp)}
                      </span>
                      <div className="absolute inset-0 flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        {!a.acknowledged && (
                          <button
                            onClick={() => onAcknowledge(a.id)}
                            className="flex items-center justify-center rounded-lg border transition-colors hover:bg-[#F5EDD8]"
                            style={{ width: 28, height: 28, borderColor: CARD_BORDER, color: TEXT }}
                            title="Mark as read"
                            aria-label={`Mark ${a.title} as read`}
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => onDismiss(a.id)}
                          className="flex items-center justify-center rounded-lg border transition-colors hover:bg-[#FEE2E2]"
                          style={{ width: 28, height: 28, borderColor: CARD_BORDER, color: "#B91C1C" }}
                          title="Dismiss"
                          aria-label={`Dismiss ${a.title}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
