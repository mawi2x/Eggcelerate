import { ArrowLeft } from "lucide-react";
import { NotificationPopover } from "./alerts/NotificationPopover";
import type { AlertEntry } from "../domain/types";
import { LiveDateTime } from "./LiveDateTime";
import { useIsMobile } from "./ui/use-mobile";

interface Props {
  title: string;
  subtitle: string;
  alertCount: number;
  onViewAlerts: () => void;
  alerts: AlertEntry[];
  onMarkAllRead: () => Promise<boolean>;
  onDismissAlert: (id: string) => Promise<boolean>;
  pendingAlertId?: string | null;
  markingAllRead?: boolean;
  /** Sub-views (e.g. Incubator Detail) show a back link at the left of row 1. */
  onBack?: () => void;
  backLabel?: string;
  /** Pills rendered inline to the right of the title. */
  badges?: React.ReactNode;
  /** Replaces the default title/subtitle block entirely (e.g. detail headers). */
  titleNode?: React.ReactNode;
  /** Optional substring to emphasize inside the default page title. */
  titleHighlight?: string;
  /** When true, shows ambient live date/time immediately left of the bell (Overview). */
  showDateTime?: boolean;
}

const TEXT = "var(--text-primary)";
const MUTED = "var(--text-secondary)";
const RUST = "var(--brand-primary)";

/**
 * Rows 1 and 2 of the main content area, identical on every screen:
 *   Row 1 — utility bar: optional back link at the left, alerts bell at the right.
 *   Row 2 — page title bar (title + optional inline badges, over the subtitle).
 * Page-local controls (search, filters, view toggles) belong to Row 3.
 */
export function PageHeader({
  title,
  subtitle,
  alertCount,
  onViewAlerts,
  alerts,
  onMarkAllRead,
  onDismissAlert,
  pendingAlertId = null,
  markingAllRead = false,
  onBack,
  backLabel = "Back",
  badges,
  titleNode,
  titleHighlight,
  showDateTime,
}: Props) {
  const isMobile = useIsMobile();

  const renderTitle = () => {
    if (!titleHighlight) return title;
    const start = title.indexOf(titleHighlight);
    if (start < 0) return title;
    const end = start + titleHighlight.length;
    return (
      <>
        {title.slice(0, start)}
        <span
          style={{
            color: "var(--brand-primary)",
            fontWeight: "var(--weight-extrabold)",
          }}
        >
          {titleHighlight}
        </span>
        {title.slice(end)}
      </>
    );
  };

  // Overview: compact Neobank-style on mobile (title+subtitle left, bell right, date inline), spacious two-row on desktop
  if (showDateTime) {
    if (isMobile) {
      return (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {titleNode ? (
                titleNode
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1
                      className="min-w-0"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--type-page-title)",
                        fontWeight: "var(--weight-bold)",
                        lineHeight: "var(--leading-snug)",
                        color: TEXT,
                      }}
                      title={title}
                    >
                      {renderTitle()}
                    </h1>
                    {badges}
                  </div>
                  <p
                    className="min-w-0"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-body)",
                      fontWeight: "var(--weight-regular)",
                      lineHeight: "var(--leading-normal)",
                      color: MUTED,
                      marginTop: 2,
                    }}
                  >
                    {subtitle}
                  </p>
                </>
              )}
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="-ml-2 mt-2 inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-[#F5EDD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
                  style={{ color: RUST, fontSize: 14, fontWeight: 500 }}
                >
                  <ArrowLeft size={16} className="shrink-0" />
                  <span className="min-w-0 truncate">{backLabel}</span>
                </button>
              ) : null}
            </div>
            <div className="shrink-0 pt-0.5">
              <NotificationPopover
                alerts={alerts}
                unreadCount={alertCount}
                onViewAll={onViewAlerts}
                onMarkAllRead={onMarkAllRead}
                onDismiss={onDismissAlert}
                pendingAlertId={pendingAlertId}
                markingAllRead={markingAllRead}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Row 1: utility bar — bell stays top-right alone */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="-ml-2 inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-[#F5EDD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
                style={{ color: RUST, fontSize: 14, fontWeight: 500 }}
              >
                <ArrowLeft size={16} className="shrink-0" />
                <span className="min-w-0 truncate">{backLabel}</span>
              </button>
            ) : null}
          </div>
          <NotificationPopover
            alerts={alerts}
            unreadCount={alertCount}
            onViewAll={onViewAlerts}
            onMarkAllRead={onMarkAllRead}
            onDismiss={onDismissAlert}
            pendingAlertId={pendingAlertId}
            markingAllRead={markingAllRead}
          />
        </div>

        {/* Row 2: title block left + ambient date/time right — restores 16px gap to Row 1 */}
        <header className="w-full min-w-0" style={{ marginTop: 16 }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1">
              {titleNode ?? (
                <>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h1
                      className="min-w-0 truncate"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--type-page-title)",
                        fontWeight: "var(--weight-bold)",
                        lineHeight: "var(--leading-snug)",
                        color: TEXT,
                      }}
                      title={title}
                    >
                      {renderTitle()}
                    </h1>
                    {badges}
                  </div>
                  <p
                    className="min-w-0"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-body)",
                      fontWeight: "var(--weight-regular)",
                      lineHeight: "var(--leading-normal)",
                      color: MUTED,
                      marginTop: 4,
                    }}
                  >
                    {subtitle}
                  </p>
                </>
              )}
            </div>
            {/* Right: ambient date/time — no card/border/background, right-aligned, not leveled with bell */}
            <div className="flex shrink-0 self-end sm:self-start sm:pt-1">
              <LiveDateTime />
            </div>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div>
      {/* ── Row 1: utility bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-[#F5EDD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
              style={{ color: RUST, fontSize: 14, fontWeight: 500 }}
            >
              <ArrowLeft size={16} className="shrink-0" />
              <span className="min-w-0 truncate">{backLabel}</span>
            </button>
          ) : null}
        </div>

        <NotificationPopover
          alerts={alerts}
          unreadCount={alertCount}
          onViewAll={onViewAlerts}
          onMarkAllRead={onMarkAllRead}
          onDismiss={onDismissAlert}
          pendingAlertId={pendingAlertId}
          markingAllRead={markingAllRead}
        />
      </div>

      {/* ── Row 2: title block + inline metadata badges ─────────────────── */}
      <header className="w-full min-w-0" style={{ marginTop: 16 }}>
        {titleNode ?? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1
                className="min-w-0 truncate"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--type-page-title)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-snug)",
                  color: TEXT,
                }}
                title={title}
              >
                {renderTitle()}
              </h1>
              {badges}
            </div>
            <p
              className="min-w-0"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-body)",
                fontWeight: "var(--weight-regular)",
                lineHeight: "var(--leading-normal)",
                color: MUTED,
                marginTop: 4,
              }}
            >
              {subtitle}
            </p>
          </>
        )}
      </header>
    </div>
  );
}
