import { Check, CheckCheck, Eraser, X } from "lucide-react";
import { useMemo, useState } from "react";
import logoApp from "../../../imports/logo-app.webp";
import type { AlertEntry, AlertSeverity } from "../../domain/types";
import { severityStyle, timeAgo } from "../alerts/alertStyle";
import { Button } from "../ui/button";
import { FilterBar } from "../ui/filter-bar";
import { PaginationBar } from "../ui/pagination-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const RUST = "var(--brand-primary)";
const TEXT = "var(--text-primary)";
const MUTED = "var(--text-muted)";
const BORDER = "var(--border-default)";
const CARD_BORDER = "var(--border-subtle)";
const DIVIDER = "#F5F4F0";
const ROW_HOVER = "#FAFAF9";
const ALERTS_PER_PAGE = 10;

/** Severity pill + icon tile tints, tuned for the cream surface. */
const severityTint: Record<
  AlertSeverity,
  { tile: string; tileFg: string; pill: string; pillFg: string }
> = {
  critical: {
    tile: "var(--status-danger-bg)",
    tileFg: "var(--status-danger-fg)",
    pill: "#FEF2F2",
    pillFg: "var(--status-danger-fg)",
  },
  warning: {
    tile: "var(--status-warning-bg)",
    tileFg: "var(--status-warning-fg)",
    pill: "#FFFBEB",
    pillFg: "var(--status-warning-fg)",
  },
  info: {
    tile: "var(--status-info-bg)",
    tileFg: "var(--status-info-fg)",
    pill: "#FAFAF9",
    pillFg: "var(--status-info-fg)",
  },
};

type Filter = "all" | AlertSeverity;
type SortKey = "recent" | "oldest" | "severity";

const filters: { key: Filter; label: string; mobileLabel: string }[] = [
  { key: "all", label: "All", mobileLabel: "All" },
  { key: "critical", label: "Urgent", mobileLabel: "Urgent" },
  { key: "warning", label: "Needs Attention", mobileLabel: "Attention" },
  { key: "info", label: "Reminder", mobileLabel: "Reminders" },
];

const severityRank: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

interface Props {
  alerts: AlertEntry[];
  onAcknowledge: (id: string) => Promise<boolean>;
  onDismiss: (id: string) => Promise<boolean>;
  onMarkAllRead: () => Promise<boolean>;
  onClearRead: () => Promise<boolean>;
  pendingAlertId: string | null;
  markingAllRead: boolean;
  clearingRead: boolean;
  onOpenUnit?: (unitName: string) => void;
}

export function AlertsScreen({
  alerts,
  onAcknowledge,
  onDismiss,
  onMarkAllRead,
  onClearRead,
  pendingAlertId,
  markingAllRead,
  clearingRead,
  onOpenUnit,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [alertPage, setAlertPage] = useState(1);
  const [alertsPerPage, setAlertsPerPage] = useState(ALERTS_PER_PAGE);

  const list = useMemo(() => {
    const filtered = alerts.filter(
      (a) => filter === "all" || a.severity === filter,
    );
    const byTime = (a: AlertEntry, b: AlertEntry) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    return [...filtered].sort((a, b) => {
      if (sort === "oldest") return -byTime(a, b);
      if (sort === "severity")
        return (
          severityRank[a.severity] - severityRank[b.severity] || byTime(a, b)
        );
      return byTime(a, b);
    });
  }, [alerts, filter, sort]);

  const alertPages = Math.max(1, Math.ceil(list.length / alertsPerPage));
  const page = Math.min(alertPage, alertPages);
  const pagedAlerts = list.slice(
    (page - 1) * alertsPerPage,
    page * alertsPerPage,
  );

  const unreadCount = alerts.filter((a) => !a.acknowledged).length;
  const readCount = alerts.length - unreadCount;

  return (
    <div className="space-y-5">
      {/* ── Controls header — pills left, actions right ─────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          ariaLabel="Alert filter"
          value={filter}
          onChange={(key) => {
            setFilter(key as Filter);
            setAlertPage(1);
          }}
          options={filters.map((f) => ({
            key: f.key,
            label: f.label,
            mobileLabel: f.mobileLabel,
            count:
              f.key === "all"
                ? alerts.length
                : alerts.filter((a) => a.severity === f.key).length,
          }))}
        />

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as SortKey);
              setAlertPage(1);
            }}
          >
            <SelectTrigger
              size="toolbar"
              className="w-full rounded-xl sm:w-[165px]"
              style={{
                borderColor: BORDER,
                backgroundColor: "#FFFFFF",
                color: TEXT,
              }}
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
            size="toolbar"
            className="rounded-xl"
            style={{ backgroundColor: RUST, color: "#fff" }}
            onClick={() => void onMarkAllRead()}
            disabled={unreadCount === 0 || markingAllRead || clearingRead}
            aria-busy={markingAllRead}
          >
            <CheckCheck size={16} />{" "}
            {markingAllRead ? "Marking…" : "Mark All as Read"}
          </Button>

          <Button
            size="toolbar"
            variant="outline"
            className="col-span-2 rounded-xl sm:col-span-1"
            style={{ borderColor: BORDER }}
            onClick={() => void onClearRead()}
            disabled={readCount === 0 || clearingRead || markingAllRead}
            aria-busy={clearingRead}
            title="Removes every notification you've already read"
          >
            <Eraser size={16} /> {clearingRead ? "Clearing…" : "Clear All"}
          </Button>
        </div>
      </div>

      {/* ── One unified feed container ──────────────────────────────────── */}
      <div
        className="overflow-hidden shadow-sm"
        style={{
          backgroundColor: "#FFFFFF",
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 16,
        }}
      >
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <img
              src={logoApp}
              alt="Eggcelerate logo"
              className="h-24 w-24 rounded-3xl object-cover"
            />
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--type-page-title)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
                color: TEXT,
              }}
            >
              All clear here!
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-body)",
                fontWeight: "var(--weight-regular)",
                lineHeight: "var(--leading-normal)",
                color: MUTED,
              }}
            >
              No {filter === "all" ? "" : filter} notifications right now. Your
              eggs are happy.
            </p>
          </div>
        ) : (
          <>
            <ul>
              {pagedAlerts.map((a, i) => {
                const s = severityStyle[a.severity];
                const tint = severityTint[a.severity];
                return (
                  <li
                    key={a.id}
                    className="group grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3.5 gap-y-2 transition-colors sm:grid-cols-[auto_minmax(0,1fr)_116px]"
                    style={{
                      padding: "16px 20px 16px 16px",
                      borderBottom:
                        i === pagedAlerts.length - 1
                          ? "none"
                          : `1px solid ${DIVIDER}`,
                      borderLeft: `4px solid ${tint.tileFg}`,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = ROW_HOVER)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    {/* Column 1 — unread dot + icon tile */}
                    <div
                      className="row-span-2 flex shrink-0 items-center gap-2.5 sm:row-span-1"
                      style={{ paddingTop: 2 }}
                    >
                      <span
                        className="rounded-full"
                        style={{
                          width: 6,
                          height: 6,
                          backgroundColor: a.acknowledged
                            ? "transparent"
                            : RUST,
                        }}
                        role="status"
                        aria-label={
                          a.acknowledged
                            ? "Read notification"
                            : "Unread notification"
                        }
                      />
                      <span
                        className="flex items-center justify-center rounded-full"
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: tint.tile,
                          color: tint.tileFg,
                        }}
                      >
                        <s.Icon size={18} />
                      </span>
                    </div>

                    {/* Column 2 — title + chamber over message */}
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-col gap-x-2 gap-y-0.5 sm:flex-row sm:flex-wrap sm:items-baseline">
                        <span
                          className="min-w-0 truncate"
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: "var(--type-body)",
                            fontWeight: "var(--weight-semibold)",
                            lineHeight: "var(--leading-normal)",
                            color: TEXT,
                          }}
                          title={a.title}
                        >
                          {a.title}
                        </span>
                        {onOpenUnit ? (
                          <button
                            type="button"
                            onClick={() => onOpenUnit(a.unit)}
                            className="min-w-0 shrink-0 truncate rounded px-1.5 py-0.5 transition-colors hover:bg-amber-100/60 focus-visible:outline-none focus-visible:ring-1"
                            style={{
                              fontFamily: "var(--font-body)",
                              fontSize: "var(--type-body-sm)",
                              fontWeight: "var(--weight-semibold)",
                              lineHeight: "var(--leading-normal)",
                              color: RUST,
                              cursor: "pointer",
                            }}
                            title={`Go to ${a.unit}`}
                          >
                            {a.unit}
                          </button>
                        ) : (
                          <span
                            className="min-w-0 shrink-0 truncate"
                            style={{
                              fontFamily: "var(--font-body)",
                              fontSize: "var(--type-body-sm)",
                              fontWeight: "var(--weight-regular)",
                              lineHeight: "var(--leading-normal)",
                              color: MUTED,
                            }}
                          >
                            {a.unit}
                          </span>
                        )}
                      </div>
                      <p
                        className="mt-1"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--type-body-sm)",
                          fontWeight: "var(--weight-regular)",
                          lineHeight: "var(--leading-normal)",
                          color: MUTED,
                        }}
                      >
                        {a.message}
                      </p>
                    </div>

                    {/* Column 3 — severity pill above timestamp + quick actions */}
                    <div
                      className="col-start-2 row-start-2 flex w-full items-start justify-between gap-3 sm:col-start-3 sm:row-start-1 sm:w-[116px] sm:flex-col sm:items-end sm:gap-1.5"
                      style={{ minHeight: 44 }}
                    >
                      <span
                        className="whitespace-nowrap rounded-full px-2.5 py-0.5"
                        style={{
                          backgroundColor: tint.pill,
                          color: tint.pillFg,
                          border: `1px solid ${tint.tile}`,
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--type-label)",
                          fontWeight: "var(--weight-bold)",
                          letterSpacing: "var(--tracking-label)",
                          lineHeight: "var(--leading-snug)",
                        }}
                      >
                        {s.label}
                      </span>

                      <div className="flex flex-col items-end gap-1 sm:relative sm:h-8 sm:w-full">
                        <span
                          className="whitespace-nowrap transition-opacity sm:absolute sm:inset-0 sm:flex sm:items-center sm:justify-end sm:group-focus-within:opacity-0 sm:group-hover:opacity-0"
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: "var(--type-label)",
                            fontWeight: "var(--weight-regular)",
                            lineHeight: "var(--leading-snug)",
                            color: MUTED,
                          }}
                        >
                          {timeAgo(a.timestamp)}
                        </span>
                        <div className="flex items-center justify-end gap-1 transition-opacity sm:absolute sm:inset-0 sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                          {!a.acknowledged && (
                            <button
                              type="button"
                              onClick={() => void onAcknowledge(a.id)}
                              disabled={pendingAlertId === a.id}
                              aria-busy={pendingAlertId === a.id}
                              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border transition-colors hover:bg-[#F5EDD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 sm:h-8 sm:w-8"
                              style={{ borderColor: CARD_BORDER, color: TEXT }}
                              title="Mark as read"
                              aria-label={`Mark ${a.title} as read`}
                            >
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void onDismiss(a.id)}
                            disabled={pendingAlertId === a.id}
                            aria-busy={pendingAlertId === a.id}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border transition-colors hover:bg-[#FEE2E2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 sm:h-8 sm:w-8"
                            style={{
                              borderColor: CARD_BORDER,
                              color: "#B91C1C",
                            }}
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
            <PaginationBar
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
          </>
        )}
      </div>
    </div>
  );
}
