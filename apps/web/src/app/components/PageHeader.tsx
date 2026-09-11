import { ArrowLeft } from "lucide-react";
import type { AlertEntry } from "../domain/types";
import { NotificationPopover } from "./alerts/NotificationPopover";
import { LiveDateTime } from "./LiveDateTime";
import { Typography } from "./ui/typography";
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
 * Single-row header for the main content area, identical on every screen:
 * title block left, ambient date (overview only) + alerts bell right.
 * Sub-views (e.g. Incubator Detail) render a slim back link row above.
 * Page-local controls (search, filters, view toggles) belong below.
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

  // Mobile layout (all screens): unified compact single-row header
  // Title + subtitle on the left, notifications bell on the right
  if (isMobile) {
    return (
      <header>
        {onBack ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
              style={{
                color: RUST,
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-body)",
                fontWeight: "var(--weight-medium)",
                minHeight: "var(--control-hit-area-icon)",
              }}
            >
              <ArrowLeft size={16} className="shrink-0" />
              <span className="min-w-0 truncate">{backLabel}</span>
            </button>
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
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {titleNode ? (
              titleNode
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Typography
                    as="h1"
                    variant="pageTitle"
                    className="min-w-0 max-w-full break-words"
                    style={{ color: TEXT, overflowWrap: "anywhere" }}
                    title={title}
                  >
                    {renderTitle()}
                  </Typography>
                  {badges}
                </div>
                <Typography
                  className="min-w-0 max-w-full break-words"
                  style={{
                    color: MUTED,
                    marginTop: 2,
                    overflowWrap: "anywhere",
                  }}
                >
                  {subtitle}
                </Typography>
              </>
            )}
          </div>
          {!onBack && (
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
          )}
        </div>
      </header>
    );
  }

  // Desktop: single row — title left, date (overview only) + bell right.
  // No empty utility bar; back link (detail only) sits in a slim row above.
  return (
    <div>
      {onBack ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
            style={{
              color: RUST,
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-body)",
              fontWeight: "var(--weight-medium)",
              minHeight: "var(--control-hit-area-icon)",
            }}
          >
            <ArrowLeft size={16} className="shrink-0" />
            <span className="min-w-0 truncate">{backLabel}</span>
          </button>
          <div className="shrink-0">
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
      ) : null}

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {titleNode ?? (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Typography
                  as="h1"
                  variant="pageTitle"
                  className="min-w-0 max-w-full break-words"
                  style={{ color: TEXT, overflowWrap: "anywhere" }}
                  title={title}
                >
                  {renderTitle()}
                </Typography>
                {badges}
              </div>
              <Typography
                className="min-w-0"
                style={{ color: MUTED, marginTop: 4 }}
              >
                {subtitle}
              </Typography>
            </>
          )}
        </div>
        {(!onBack || showDateTime) && (
          <div className="flex shrink-0 items-center gap-3 pt-0.5">
            {showDateTime ? <LiveDateTime /> : null}
            {!onBack && (
              <NotificationPopover
                alerts={alerts}
                unreadCount={alertCount}
                onViewAll={onViewAlerts}
                onMarkAllRead={onMarkAllRead}
                onDismiss={onDismissAlert}
                pendingAlertId={pendingAlertId}
                markingAllRead={markingAllRead}
              />
            )}
          </div>
        )}
      </header>
    </div>
  );
}
