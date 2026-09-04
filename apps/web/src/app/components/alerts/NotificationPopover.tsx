import { ArrowRight, Bell, X } from "lucide-react";
import { useState } from "react";
import type { AlertEntry } from "../../domain/types";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useIsMobile } from "../ui/use-mobile";
import { severityStyle, timeAgo } from "./alertStyle";

const RUST = "var(--brand-primary)";
const TEXT = "var(--text-primary)";
const MUTED = "var(--text-secondary)";
const BORDER = "var(--border-default)";
const DIVIDER = "#F0EDE6";

interface Props {
  alerts: AlertEntry[];
  unreadCount: number;
  onViewAll: () => void;
  onMarkAllRead: () => Promise<boolean>;
  onDismiss: (id: string) => Promise<boolean>;
  pendingAlertId: string | null;
  markingAllRead: boolean;
}

/** Bell button in the utility bar plus its 340px quick-notification dropdown. */
export function NotificationPopover({
  alerts,
  unreadCount,
  onViewAll,
  onMarkAllRead,
  onDismiss,
  pendingAlertId,
  markingAllRead,
}: Props) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const recent = alerts.slice(0, 5);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex shrink-0 cursor-pointer items-center justify-center rounded-[10px] border transition-colors hover:bg-[#F5EDD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            height: isMobile ? "var(--control-hit-area-icon)" : 52,
            width: isMobile ? "var(--control-hit-area-icon)" : 52,
            backgroundColor: "#FFFFFF",
            borderColor: BORDER,
            color: MUTED,
          }}
          title="Notifications"
          aria-label={`Notifications, ${unreadCount} unread`}
        >
          <Bell size={isMobile ? 20 : 26} strokeWidth={2} />
          {unreadCount > 0 && (
            <span
              className="absolute flex items-center justify-center rounded-full"
              style={{
                top: isMobile ? -4 : -6,
                right: isMobile ? -4 : -6,
                height: isMobile ? 18 : 22,
                minWidth: isMobile ? 18 : 22,
                padding: "0 4px",
                backgroundColor: "#D92B0F",
                color: "#FFFFFF",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-bold)",
                border: "2px solid #FAF6F0",
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(340px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-0 shadow-lg"
        style={{
          backgroundColor: "#FFFFFF",
          borderColor: BORDER,
          borderRadius: 12,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: `1px solid ${DIVIDER}` }}
        >
          <span
            className="min-w-0 truncate"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-heading-sm)",
              fontWeight: "var(--weight-bold)",
              color: TEXT,
            }}
          >
            Notifications
          </span>
          <button
            type="button"
            onClick={() => void onMarkAllRead()}
            disabled={unreadCount === 0 || markingAllRead}
            aria-busy={markingAllRead}
            className="shrink-0 cursor-pointer rounded-md px-1 transition-opacity hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-semibold)",
              color: RUST,
            }}
          >
            {markingAllRead ? "Marking…" : "Mark all as read"}
          </button>
        </div>

        {/* Body — five most recent */}
        {recent.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-body)",
                fontWeight: "var(--weight-bold)",
                color: TEXT,
              }}
            >
              You're all caught up
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-caption)",
                color: MUTED,
              }}
            >
              No notifications right now. 🐣
            </p>
          </div>
        ) : (
          <ul className="max-h-[380px] overflow-y-auto">
            {recent.map((a) => {
              const s = severityStyle[a.severity];
              return (
                <li
                  key={a.id}
                  className="group relative flex items-start gap-3 px-4 py-3 pr-14 transition-colors hover:bg-[#FAF6F0] sm:pr-4"
                  style={{ borderBottom: `1px solid ${DIVIDER}` }}
                >
                  <span
                    className="flex shrink-0 items-center justify-center rounded-lg"
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: s.bg,
                      color: s.color,
                    }}
                  >
                    <s.Icon size={17} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="min-w-0 truncate"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--type-body-sm)",
                          fontWeight: "var(--weight-bold)",
                          color: TEXT,
                        }}
                      >
                        {a.title}
                      </span>
                      {!a.acknowledged && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: RUST }}
                          role="img"
                          aria-label="Unread"
                        />
                      )}
                    </div>
                    <p
                      className="truncate"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-label)",
                        color: MUTED,
                      }}
                    >
                      {a.unit} · {timeAgo(a.timestamp)}
                    </p>
                    {/* Snippet clamped to two lines so every item stays the same height. */}
                    <p
                      className="mt-1 overflow-hidden"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-caption)",
                        color: "#5C4636",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {a.message}
                    </p>
                  </div>

                  {/* Hover-revealed dismiss */}
                  <button
                    type="button"
                    onClick={() => void onDismiss(a.id)}
                    disabled={pendingAlertId === a.id}
                    aria-busy={pendingAlertId === a.id}
                    className="absolute right-2 top-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-md opacity-100 transition-opacity hover:bg-[#F0EDE6] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
                    style={{ color: MUTED }}
                    title="Dismiss"
                    aria-label={`Dismiss ${a.title}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer */}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onViewAll();
          }}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-b-xl py-3 transition-colors hover:bg-[#FAF6F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-body-sm)",
            fontWeight: "var(--weight-semibold)",
            color: RUST,
          }}
        >
          View All Notifications <ArrowRight size={15} />
        </button>
      </PopoverContent>
    </Popover>
  );
}
