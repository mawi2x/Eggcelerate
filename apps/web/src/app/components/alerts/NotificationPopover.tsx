import { useState } from "react";
import { Bell, X, ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { AlertEntry } from "../../data/mockData";
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
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
}

/** Bell button in the utility bar plus its 340px quick-notification dropdown. */
export function NotificationPopover({ alerts, unreadCount, onViewAll, onMarkAllRead, onDismiss }: Props) {
  const [open, setOpen] = useState(false);
  const recent = alerts.slice(0, 5);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex shrink-0 items-center justify-center rounded-2xl border transition-colors hover:bg-[#F5EDD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ height: 52, width: 52, backgroundColor: "#FFFFFF", borderColor: BORDER, color: MUTED }}
          title="Notifications"
          aria-label={`Notifications, ${unreadCount} unread`}
        >
          <Bell size={26} strokeWidth={2} />
          {unreadCount > 0 && (
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
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="p-0 shadow-lg"
        style={{ width: 340, backgroundColor: "#FFFFFF", borderColor: BORDER, borderRadius: 12 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: `1px solid ${DIVIDER}` }}
        >
          <span className="min-w-0 truncate" style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>
            Notifications
          </span>
          <button
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className="shrink-0 rounded-md px-1 transition-opacity hover:underline disabled:opacity-40 disabled:no-underline"
            style={{ fontSize: 12, fontWeight: 600, color: RUST }}
          >
            Mark all as read
          </button>
        </div>

        {/* Body — five most recent */}
        {recent.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>You're all caught up</p>
            <p className="mt-1" style={{ fontSize: 12, color: MUTED }}>
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
                  className="group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[#FAF6F0]"
                  style={{ borderBottom: `1px solid ${DIVIDER}` }}
                >
                  <span
                    className="flex shrink-0 items-center justify-center rounded-lg"
                    style={{ width: 32, height: 32, backgroundColor: s.bg, color: s.color }}
                  >
                    <s.Icon size={17} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="min-w-0 truncate" style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
                        {a.title}
                      </span>
                      {!a.acknowledged && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: RUST }}
                          aria-label="Unread"
                        />
                      )}
                    </div>
                    <p className="truncate" style={{ fontSize: 11, color: MUTED }}>
                      {a.unit} · {timeAgo(a.timestamp)}
                    </p>
                    {/* Snippet clamped to two lines so every item stays the same height. */}
                    <p
                      className="mt-1 overflow-hidden"
                      style={{
                        fontSize: 12,
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
                    onClick={() => onDismiss(a.id)}
                    className="absolute right-2 top-2 flex items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-[#F0EDE6] focus-visible:opacity-100 group-hover:opacity-100"
                    style={{ width: 22, height: 22, color: MUTED }}
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
          onClick={() => {
            setOpen(false);
            onViewAll();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-b-xl py-3 transition-colors hover:bg-[#FAF6F0]"
          style={{ fontSize: 13, fontWeight: 600, color: RUST }}
        >
          View All Notifications <ArrowRight size={15} />
        </button>
      </PopoverContent>
    </Popover>
  );
}
