import { Check } from "lucide-react";
import {
  CANDLE_SHORT_LABELS,
  dayFraction,
  markerStatus,
  RUST,
  RUST_NODE,
} from "./types";

interface TimelineProps {
  currentDay: number;
  totalDays: number;
  candling: { day: number; label: string }[];
  candled: Record<number, boolean>;
  /**
   * Milestone label density on <sm screens only (label + DAY lines).
   * `10` uses `--type-label-compact` (preferred), `9` uses
   * `--type-label-micro` (last-resort). sm and up always stay at the 11px
   * system minimum. Both are rem-based so user font-size/zoom still
   * scales them.
   */
  labelSize?: 10 | 9;
}

export function Timeline({
  currentDay,
  totalDays,
  candling,
  candled,
  labelSize = 10,
}: TimelineProps) {
  // Progress bar is capped at 100% (the target hatch day) — overtime only
  // changes the day counter, never the bar.
  const isReady = currentDay <= 0;
  const fillPct = isReady
    ? 0
    : Math.min(100, dayFraction(currentDay, totalDays) * 100);
  const badgeLeft = `clamp(28px, ${fillPct}%, calc(100% - 28px))`;

  // Full labels ("1st Candling") are ~80px nowrap at 11px bold — at 60% vs 85%
  // on a ~313px track they overlap by ~7px. Compact labels keep every label
  // on one line (ux: compact-label-overflow) while the node title + DAY below
  // preserve the full meaning for pointer/keyboard/touch.
  const COMPACT_LABELS = ["1st", "2nd", "Lockdown"];
  const milestoneSize =
    labelSize === 9
      ? "var(--type-label-micro)"
      : "var(--type-label-compact)";

  return (
    <div>
      <div
        className="relative mx-1 overflow-visible pt-9 pb-12 sm:pt-11 sm:pb-14"
      >
        {/* Track frame — the axis line, centered vertically in the container. */}
        <div
          className="absolute left-0 right-0"
          style={{ height: 6, top: "50%", transform: "translateY(-50%)" }}
        >
          {/* Track line (6px stroke) + progress fill. */}
          <div
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: "#ECE6D9" }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${fillPct}%`, backgroundColor: RUST }}
          />

          {/* Layer 1 — "Today" badge. */}
          <div
            className="absolute flex flex-col items-center"
            style={{
              left: badgeLeft,
              bottom: "100%",
              transform: "translateX(-50%)",
              zIndex: 30,
            }}
          >
            <span
              className="flex flex-col items-center justify-center whitespace-nowrap rounded-lg px-2.5 py-1 shadow-sm"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-extrabold)",
                letterSpacing: "var(--tracking-label)",
                lineHeight: "var(--leading-snug)",
                backgroundColor: RUST,
                color: "#fff",
                boxShadow: "0 2px 6px rgba(173,58,29,0.28)",
              }}
            >
              <span style={{ lineHeight: 1.15 }}>
                {isReady ? "Ready" : "Today"}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-label)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: 1.15,
                  letterSpacing: "var(--tracking-label)",
                }}
              >
                DAY {Math.max(0, currentDay)}
              </span>
            </span>
            {/* Stem + ▼ triangle */}
            <svg
              width={10}
              height={8}
              viewBox="0 0 10 8"
              style={{ display: "block" }}
              aria-hidden
            >
              <path d="M1.5 1 L8.5 1 L5 7.5 Z" fill={RUST} />
            </svg>
          </div>

          {/* Layer 3 — milestone labels, below the track line and nodes.
              <sm uses the labelSize density exception (10px default, 9px
              opt-in); sm+ stays at the 11px system minimum. nowrap +
              maxWidth keeps one line; title discloses the full value. */}
          {candling.map((c, i) => {
            const pct = dayFraction(c.day, totalDays) * 100;
            const fullLabel = CANDLE_SHORT_LABELS[i] ?? c.label;
            const compactLabel = COMPACT_LABELS[i] ?? fullLabel;
            return (
              <span
                key={c.day}
                className="absolute flex flex-col items-center whitespace-nowrap"
                style={{
                  left: `${pct}%`,
                  top: "calc(100% + 10px)",
                  transform: "translateX(-50%)",
                  zIndex: 5,
                  maxWidth: 88,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={`${fullLabel}, Day ${c.day}`}
              >
                <span
                  data-timeline="compact-label"
                  className="sm:hidden"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: milestoneSize,
                    fontWeight: "var(--weight-bold)",
                    letterSpacing: "var(--tracking-label)",
                    lineHeight: "var(--leading-snug)",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  {compactLabel}
                </span>
                <span
                  className="hidden sm:inline"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-bold)",
                    letterSpacing: "var(--tracking-label)",
                    lineHeight: "var(--leading-snug)",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  {fullLabel}
                </span>
                <span
                  data-timeline="compact-day"
                  className="sm:hidden"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: milestoneSize,
                    fontWeight: "var(--weight-bold)",
                    letterSpacing: "var(--tracking-label)",
                    lineHeight: "var(--leading-snug)",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  DAY {c.day}
                </span>
                <span
                  className="hidden sm:inline"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-bold)",
                    letterSpacing: "var(--tracking-label)",
                    lineHeight: "var(--leading-snug)",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  DAY {c.day}
                </span>
              </span>
            );
          })}
        </div>

        {/* Layer 2 — milestone nodes, centered on the track line. */}
        {candling.map((c, i) => {
          const pct = dayFraction(c.day, totalDays) * 100;
          const status = markerStatus(c.day, currentDay, !!candled[c.day]);
          // Past checkpoints read as filled; only future ones stay hollow.
          const filled = status !== "upcoming";
          return (
            <div
              key={c.day}
              className="absolute"
              style={{
                left: `${pct}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 10,
              }}
              title={`${c.label}, Day ${c.day}, ${status}`}
            >
              <div
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full sm:h-6 sm:w-6"
                style={{
                  backgroundColor: filled ? RUST_NODE : "#FFFFFF",
                  border: `2px solid ${RUST_NODE}`,
                  color: filled ? "#FFFFFF" : RUST_NODE,
                  boxShadow: "0 0 0 2.5px #F9F6F0",
                }}
              >
                {status === "logged" ? (
                  <Check size={12} strokeWidth={3.2} />
                ) : (
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-caption)",
                      fontWeight: "var(--weight-bold)",
                      lineHeight: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mx-1 flex justify-between">
        <span
          className="sm:hidden"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: milestoneSize,
            fontWeight: "var(--weight-bold)",
            letterSpacing: "var(--tracking-label)",
            lineHeight: "var(--leading-snug)",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          DAY 1
        </span>
        <span
          className="hidden sm:inline"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-label)",
            fontWeight: "var(--weight-bold)",
            letterSpacing: "var(--tracking-label)",
            lineHeight: "var(--leading-snug)",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          DAY 1
        </span>
        <span
          className="sm:hidden"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: milestoneSize,
            fontWeight: "var(--weight-bold)",
            letterSpacing: "var(--tracking-label)",
            lineHeight: "var(--leading-snug)",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          DAY {totalDays}
        </span>
        <span
          className="hidden sm:inline"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-label)",
            fontWeight: "var(--weight-bold)",
            letterSpacing: "var(--tracking-label)",
            lineHeight: "var(--leading-snug)",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          DAY {totalDays}
        </span>
      </div>
    </div>
  );
}
