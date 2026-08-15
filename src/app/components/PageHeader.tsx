import { ArrowLeft } from "lucide-react";
import { NotificationPopover } from "./alerts/NotificationPopover";
import { AlertEntry } from "../data/mockData";

interface Props {
  title: string;
  subtitle: string;
  alertCount: number;
  onViewAlerts: () => void;
  alerts: AlertEntry[];
  onMarkAllRead: () => void;
  onDismissAlert: (id: string) => void;
  /** Sub-views (e.g. Incubator Detail) show a back link at the left of row 1. */
  onBack?: () => void;
  backLabel?: string;
  /** Pills rendered inline to the right of the title. */
  badges?: React.ReactNode;
  /** Replaces the default title/subtitle block entirely (e.g. detail headers). */
  titleNode?: React.ReactNode;
}

const TEXT = "#1A1A1A";
const MUTED = "#78716C";
const RUST = "#C8623A";

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
  onBack,
  backLabel = "Back",
  badges,
  titleNode,
}: Props) {
  return (
    <div>
      {/* ── Row 1: utility bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {onBack ? (
            <button
              onClick={onBack}
              className="-ml-2 inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-[#F5EDD8] focus-visible:outline-none focus-visible:ring-2"
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
        />
      </div>

      {/* ── Row 2: title block + inline metadata badges ─────────────────── */}
      <header className="w-full min-w-0" style={{ marginTop: 16 }}>
        {titleNode ?? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1
                className="min-w-0 truncate"
                style={{ fontSize: 24, fontWeight: 700, color: TEXT, lineHeight: 1.25 }}
                title={title}
              >
                {title}
              </h1>
              {badges}
            </div>
            <p className="min-w-0" style={{ fontSize: 14, fontWeight: 400, color: MUTED, lineHeight: 1.4, marginTop: 4 }}>
              {subtitle}
            </p>
          </>
        )}
      </header>
    </div>
  );
}
