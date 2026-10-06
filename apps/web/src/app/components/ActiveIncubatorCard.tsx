import { WifiSlash } from "@phosphor-icons/react";
import { ChevronRight } from "lucide-react";
import type { Incubator, Mode } from "../domain/types";
import {
  resolvedTelemetryStatus,
  telemetryReceiptTimestamp,
  telemetryStatusLabel,
} from "../features/farm/telemetry";

/** Shared by the overview carousel and desktop grid; state slots keep card height stable. */
export function ActiveIncubatorCard({
  unit,
  mode,
  onOpen,
}: {
  unit: Incubator;
  mode: Mode;
  onOpen: (id: string) => void;
}) {
  const telemetryStatus = resolvedTelemetryStatus(unit);
  const offline = telemetryStatus === "offline";
  const overdue = Math.max(0, unit.dayOfIncubation - mode.incubationDays);
  const receivedAt = telemetryReceiptTimestamp(unit);
  const timestamp = receivedAt ? Date.parse(receivedAt) : Number.NaN;
  const lastSeen = Number.isFinite(timestamp)
    ? `Last seen ${Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))} min ago`
    : "Offline";
  const pct = Math.min(
    100,
    Math.round((unit.dayOfIncubation / mode.incubationDays) * 100),
  );
  const stroke = offline
    ? "var(--status-info-fg)"
    : overdue > 0 || telemetryStatus === "stale"
      ? "var(--status-warning-fg)"
      : "var(--status-success-fg)";
  const size = 70;
  const width = 7;
  const r = (size - width) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="relative h-full w-full">
      <button
        type="button"
        aria-labelledby={`mini-card-${unit.id}`}
        aria-describedby={`mini-card-mode-${unit.id} ${offline ? "" : `mini-card-status-${unit.id}`} mini-card-day-${unit.id} mini-card-seen-${unit.id}`}
        onClick={() => onOpen(unit.id)}
        className="group flex h-full w-full cursor-pointer flex-col justify-between rounded-[var(--radius-overview-card-mobile)] border border-[var(--border-default)] bg-[var(--surface-card)] p-3 text-left transition-colors duration-200 hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] md:rounded-[var(--radius-dialog)] md:p-4"
      >
        {/* Top-left header stack — name over mode over progress. */}
        <div className="relative w-full min-w-0 text-left">
          <div className="flex min-w-0 items-start justify-between gap-1">
            <span
              id={`mini-card-${unit.id}`}
              className="block min-w-0 flex-1 truncate text-(length:--type-body) lg:text-(length:--type-heading-sm)"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: "var(--weight-semibold)",
                lineHeight: "var(--leading-snug)",
                color: "var(--text-primary)",
              }}
              title={unit.name}
            >
              {unit.name}
            </span>
            <div
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-faint)] transition-colors group-hover:text-[var(--brand-primary)]"
              aria-hidden="true"
            >
              <ChevronRight size={16} />
            </div>
          </div>
          <div className="mt-0.5 flex min-h-5 items-center justify-between gap-1">
            <span
              className="block min-w-0 truncate text-(length:--type-caption) lg:text-(length:--type-body-sm)"
              id={`mini-card-mode-${unit.id}`}
              title={mode.name}
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "var(--weight-semibold)",
                lineHeight: "var(--leading-normal)",
                color: "var(--text-farm)",
              }}
            >
              {mode.name}
            </span>
            {!offline && (
              <span
                id={`mini-card-status-${unit.id}`}
                className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium"
                style={{
                  color:
                    telemetryStatus === "fresh"
                      ? "var(--status-success-fg)"
                      : "var(--status-warning-fg)",
                }}
                title={telemetryStatusLabel(
                  telemetryStatus,
                  telemetryReceiptTimestamp(unit),
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      telemetryStatus === "fresh"
                        ? "var(--status-success-fg)"
                        : "var(--status-warning-fg)",
                  }}
                />
                {telemetryStatus === "fresh" ? "Live" : "Stale"}
              </span>
            )}
          </div>
          <span
            id={`mini-card-day-${unit.id}`}
            className="mt-1 block min-w-0 truncate"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-regular)",
              lineHeight: "var(--leading-normal)",
              color: "var(--text-farm)",
            }}
            title={`Progress: Day ${unit.dayOfIncubation} of ${mode.incubationDays}`}
          >
            Day {unit.dayOfIncubation} of {mode.incubationDays}
          </span>
        </div>

        {/* Center body — the ring */}
        <div className="relative my-1 flex min-h-0 items-center justify-center">
          <svg
            width={size}
            height={size}
            role="img"
            aria-label={
              offline
                ? "Offline: cycle progress unavailable"
                : `Cycle progress ${pct}%`
            }
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--border-default)"
              strokeWidth={width}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offline ? 0 : circumference * (1 - pct / 100)}
              opacity={offline ? 0.35 : 1}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {offline ? (
              <WifiSlash
                size={20}
                weight="bold"
                aria-hidden="true"
                style={{ color: stroke }}
              />
            ) : (
              <span
                className="tracking-tight font-bold text-sm md:text-base"
                style={{
                  fontFamily: "var(--font-display)",
                  color: stroke,
                  lineHeight: "var(--leading-tight)",
                }}
              >
                {pct}%
              </span>
            )}
          </div>
        </div>
        <span
          id={`mini-card-seen-${unit.id}`}
          className="block w-full text-center text-(length:--type-label)"
          style={{
            color: "var(--text-secondary)",
            lineHeight: "var(--leading-snug)",
            visibility: offline ? "visible" : "hidden",
          }}
        >
          {offline ? lastSeen : "Live"}
        </span>
      </button>
    </div>
  );
}
