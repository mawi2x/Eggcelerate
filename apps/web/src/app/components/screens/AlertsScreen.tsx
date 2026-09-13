import { Check, CheckCheck, Eraser, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import logoApp from "../../../imports/logo-app.webp";
import type { AlertEntry, AlertSeverity } from "../../domain/types";
import { severityStyle, timeAgo } from "../alerts/alertStyle";
import { Button } from "../ui/button";
import { FilterBar } from "../ui/filter-bar";
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
const DIVIDER = "var(--surface-fog)";
const ROW_HOVER = "var(--surface-paper)";

/** Severity pill + icon tile tints, tuned for the cream surface. */
const severityTint: Record<
  AlertSeverity,
  { tile: string; tileFg: string; pill: string; pillFg: string }
> = {
  critical: {
    tile: "var(--status-danger-bg)",
    tileFg: "var(--status-danger-fg)",
    pill: "var(--surface-blush)",
    pillFg: "var(--status-danger-fg)",
  },
  warning: {
    tile: "var(--status-warning-bg)",
    tileFg: "var(--status-warning-fg)",
    pill: "var(--surface-warn-tile)",
    pillFg: "var(--status-warning-fg)",
  },
  info: {
    tile: "var(--status-info-bg)",
    tileFg: "var(--status-info-fg)",
    pill: "var(--surface-paper)",
    pillFg: "var(--status-info-fg)",
  },
};

type Filter = "all" | "unread" | "important";
type SortKey = "recent" | "oldest" | "severity";

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
  /** Shell page header rendered inside the sticky toolbar (alerts route). */
  header?: ReactNode;
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
  header,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const list = useMemo(() => {
    const filtered = alerts.filter((a) =>
      filter === "all"
        ? true
        : filter === "unread"
          ? !a.acknowledged
          : a.severity === "critical" ||
            (a.severity === "warning" && !a.acknowledged),
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

  const dayGroup = (iso: string) => {
    const atMidnight = (x: Date) =>
      new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round(
      (atMidnight(new Date()) - atMidnight(new Date(iso))) / 86400000,
    );
    return diffDays <= 0 ? "Today" : diffDays === 1 ? "Yesterday" : "Last Week";
  };
  const groupedAlerts: { group: string; items: AlertEntry[] }[] = [];
  for (const a of list) {
    const group = dayGroup(a.timestamp);
    const last = groupedAlerts[groupedAlerts.length - 1];
    if (last && last.group === group) last.items.push(a);
    else groupedAlerts.push({ group, items: [a] });
  }

  const unreadCount = alerts.filter((a) => !a.acknowledged).length;
  const importantCount = alerts.filter(
    (a) =>
      a.severity === "critical" ||
      (a.severity === "warning" && !a.acknowledged),
  ).length;
  const readCount = alerts.length - unreadCount;

  return (
    <div className="space-y-0">
      {/*
       * Keep these heights and the day-header offsets in lockstep: each
       * day header docks flush against the frozen toolbar (same top as the
       * toolbar height per breakpoint). Any gap pushes the header down over
       * the first row at rest and leaves a slit of scrolling rows when stuck.
       */}
      <div
        className="sticky top-0 z-30 flex h-[180px] flex-col gap-2 md:h-[199px] md:gap-3 lg:h-[151px]"
        style={{
          backgroundColor: "var(--surface-app)",
          paddingBottom: 24,
          paddingTop: 24,
        }}
      >
        {header}
        {/* ── Controls header — pills left, actions right ─────────────────── */}
        <div className="flex flex-col gap-2 md:gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterBar
            ariaLabel="Alert filter"
            variant="segmented"
            fitToScreenOnMobile
            value={filter}
            onChange={(key) => setFilter(key as Filter)}
            options={[
              { key: "all", label: "All", count: alerts.length },
              { key: "unread", label: "Unread", count: unreadCount },
              {
                key: "important",
                label: "Important",
                count: importantCount,
              },
            ]}
            className="md:!w-full lg:!w-auto"
          />

          <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto lg:flex-nowrap">
            <Select
              size="filter"
              value={sort}
              onValueChange={(value) => setSort(value as SortKey)}
            >
              <SelectTrigger
                size="filter"
                className="h-[var(--control-height-mobile)] min-w-0 flex-[1_1_100%] rounded-full px-3.5 min-[23rem]:flex-1 md:h-[var(--control-height-default)] md:w-[165px] md:flex-none md:rounded-xl md:px-3"
                style={{
                  borderColor: BORDER,
                  backgroundColor: "var(--surface-card)",
                  color: "var(--brand-primary)",
                  fontWeight: "var(--weight-medium)",
                }}
                aria-label="Sort notifications"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="severity">Severity</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="toolbar"
              className="h-[var(--control-height-mobile)] min-w-0 flex-1 rounded-xl md:h-[var(--control-height-default)] md:flex-none md:rounded-xl md:px-4"
              style={{
                backgroundColor: RUST,
                color: "var(--on-brand)",
                fontSize: "var(--type-filter-label)",
                fontWeight: "var(--weight-bold)",
              }}
              onClick={() => void onMarkAllRead()}
              disabled={unreadCount === 0 || markingAllRead || clearingRead}
              aria-busy={markingAllRead}
            >
              <CheckCheck size={16} />{" "}
              {markingAllRead ? (
                "Marking…"
              ) : (
                <>
                  <span className="hidden md:inline">Mark All as Read</span>
                  <span className="md:hidden">Mark All</span>
                </>
              )}
            </Button>
            <Button
              size="toolbar"
              variant="outline"
              className="h-[var(--control-height-mobile)] min-w-0 flex-1 rounded-xl md:h-[var(--control-height-default)] md:flex-none md:rounded-xl md:px-4"
              style={{
                borderColor: BORDER,
                fontSize: "var(--type-filter-label)",
                fontWeight: "var(--weight-bold)",
              }}
              onClick={() => void onClearRead()}
              disabled={readCount === 0 || clearingRead || markingAllRead}
              aria-busy={clearingRead}
              title="Removes every notification you've already read"
            >
              <Eraser size={16} /> {clearingRead ? "Clearing…" : "Clear All"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── One unified feed container ──────────────────────────────────── */}
      <section
        aria-label="Notifications"
        className="overflow-clip rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-sm"
      >
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <img
              src={logoApp}
              alt="Eggcelerate logo"
              className="h-24 w-24 rounded-3xl object-cover"
            />
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--type-page-title)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
                color: TEXT,
              }}
            >
              All clear here!
            </h2>
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
          <ul>
            {groupedAlerts.map((g, gi) => (
              <li key={g.group}>
                <h2
                  className="sticky top-[180px] z-10 md:top-[199px] lg:top-[151px]"
                  style={{
                    padding: "10px 20px 8px",
                    borderTop: gi === 0 ? "none" : `1px solid ${DIVIDER}`,
                    borderBottom: `1px solid ${DIVIDER}`,
                    backgroundColor: "var(--surface-card)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-bold)",
                    letterSpacing: "var(--tracking-label)",
                    lineHeight: "var(--leading-snug)",
                    textTransform: "uppercase",
                    color: MUTED,
                  }}
                >
                  {g.group}
                </h2>
                <ul>
                  {g.items.map((a) => {
                    const s = severityStyle[a.severity];
                    const tint = severityTint[a.severity];
                    return (
                      <li
                        key={a.id}
                        className="group grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 border-b border-[var(--surface-fog)] p-[var(--list-row-padding)] transition-colors last:border-b-0 md:grid-cols-[auto_minmax(0,1fr)_150px] md:gap-x-3.5 md:gap-y-2"
                        style={{
                          borderLeft: `4px solid ${tint.tileFg}`,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = ROW_HOVER)
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "transparent")
                        }
                      >
                        {/* Column 1 — severity badge (dims once read) */}
                        <div
                          className="row-span-2 flex shrink-0 items-center md:row-span-1"
                          style={{ paddingTop: 2 }}
                        >
                          <span
                            className="flex items-center justify-center rounded-lg"
                            aria-hidden="true"
                            style={{
                              width: 36,
                              height: 36,
                              backgroundColor: "transparent",
                              color: s.color,
                            }}
                          >
                            <s.Icon
                              size={24}
                              weight="fill"
                              aria-hidden="true"
                            />
                          </span>
                          <span className="sr-only">
                            {a.acknowledged
                              ? "Read notification"
                              : "Unread notification"}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-row flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span
                              className="min-w-0 max-w-full break-words"
                              style={{
                                fontFamily: "var(--font-body)",
                                fontSize: "var(--type-body)",
                                fontWeight: "var(--weight-semibold)",
                                lineHeight: "var(--leading-normal)",
                                color: TEXT,
                                overflowWrap: "anywhere",
                              }}
                              title={a.title}
                            >
                              {a.title}
                            </span>
                            <span
                              style={{
                                fontFamily: "var(--font-body)",
                                fontSize: "var(--type-body)",
                                fontWeight: "var(--weight-semibold)",
                                lineHeight: "var(--leading-normal)",
                                color: TEXT,
                              }}
                            >
                              in
                            </span>
                            {onOpenUnit ? (
                              <button
                                type="button"
                                onClick={() => onOpenUnit(a.unit)}
                                className="inline-flex min-h-0 min-w-0 max-w-full items-center self-start break-words rounded text-left transition-colors hover:bg-amber-100/60 focus-visible:outline-none focus-visible:ring-1"
                                style={{
                                  fontFamily: "var(--font-body)",
                                  fontSize: "var(--type-body)",
                                  fontWeight: "var(--weight-semibold)",
                                  lineHeight: "var(--leading-normal)",
                                  color: RUST,
                                  cursor: "pointer",
                                  overflowWrap: "anywhere",
                                }}
                                title={`Go to ${a.unit}`}
                              >
                                {a.unit}
                              </button>
                            ) : (
                              <span
                                className="min-w-0 max-w-full self-start break-words text-left"
                                style={{
                                  fontFamily: "var(--font-body)",
                                  fontSize: "var(--type-body-sm)",
                                  fontWeight: "var(--weight-regular)",
                                  lineHeight: "var(--leading-normal)",
                                  color: MUTED,
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {a.unit}
                              </span>
                            )}
                          </div>
                          <p
                            className="mt-0.5 break-words"
                            style={{
                              fontFamily: "var(--font-body)",
                              fontSize: "var(--type-body-sm)",
                              fontWeight: "var(--weight-regular)",
                              lineHeight: "var(--leading-normal)",
                              color: MUTED,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {a.message}
                          </p>
                        </div>

                        {/* Column 3 — severity pill above timestamp + quick actions */}
                        <div
                          className="col-start-2 row-start-2 flex w-full flex-wrap items-start justify-between gap-2 max-[19rem]:flex-col md:col-start-3 md:row-start-1 md:w-[150px] md:flex-col md:flex-nowrap md:items-end md:gap-1.5"
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

                          <div className="flex w-full flex-col items-end gap-1 max-[19rem]:items-end md:relative md:h-8 md:w-full">
                            <span
                              className="whitespace-nowrap transition-opacity md:absolute md:inset-0 md:flex md:items-center md:justify-end md:group-focus-within:opacity-0 md:group-hover:opacity-0"
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
                            <div className="flex items-center justify-end gap-1 transition-opacity md:absolute md:inset-0 md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
                              {!a.acknowledged && (
                                <button
                                  type="button"
                                  onClick={() => void onAcknowledge(a.id)}
                                  disabled={pendingAlertId === a.id}
                                  aria-busy={pendingAlertId === a.id}
                                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 md:h-8 md:w-8"
                                  style={{
                                    borderColor: CARD_BORDER,
                                    color: TEXT,
                                  }}
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
                                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border transition-colors hover:bg-[var(--status-danger-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 md:h-8 md:w-8"
                                style={{
                                  borderColor: CARD_BORDER,
                                  color: "var(--status-danger-fg)",
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
