import { Check } from "@phosphor-icons/react";
import { CANDLE_SHORT_LABELS, dayFraction, markerStatus } from "./types";

interface TimelineProps {
  currentDay: number;
  totalDays: number;
  candling: { day: number; label: string }[];
  candled: Record<number, boolean>;
  /**
   * Milestone label density on <md screens only (label + DAY lines).
   * `10` uses `--type-label-compact` (preferred), `9` uses
   * `--type-label-micro` (last-resort). md and up always stay at the 11px
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
    labelSize === 9 ? "var(--type-label-micro)" : "var(--type-label-compact)";

  return (
    <div>
      <div className="relative mx-1 overflow-visible pt-9 pb-12 md:pt-11 md:pb-14">
        {/* Track frame — the axis line, centered vertically in the container. */}
        <div
          className="absolute left-0 right-0"
          style={{
            height: "var(--progress-thickness)",
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          {/* Track line (6px stroke) + progress fill. */}
          <div
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: "var(--track-gauge)" }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${fillPct}%`,
              backgroundColor: "var(--brand-primary)",
            }}
          />

          {/* Layer 1 — "Today" badge. */}
          <div
            className="absolute flex flex-col items-center"
            style={{
              left: badgeLeft,
              bottom: "100%",
              transform: "translateX(-50%)",
              zIndex: "var(--z-top)",
            }}
          >
            <span
              className="flex flex-col items-center justify-center whitespace-nowrap rounded-lg px-2.5 py-1"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-extrabold)",
                letterSpacing: "var(--tracking-label)",
                lineHeight: "var(--leading-snug)",
                backgroundColor: "var(--brand-primary)",
                color: "var(--on-brand)",
                boxShadow: "var(--shadow-accent)",
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
              <path d="M1.5 1 L8.5 1 L5 7.5 Z" fill={"var(--brand-primary)"} />
            </svg>
          </div>

          {/* Layer 3 — milestone labels, below the track line and nodes.
              <md uses the labelSize density exception (10px default, 9px
              opt-in); md+ stays at the 11px system minimum. nowrap +
              maxWidth keeps the visual label compact; aria-label exposes the
              full value to assistive technology and title adds pointer help. */}
          {candling.map((c, i) => {
            const pct = dayFraction(c.day, totalDays) * 100;
            const fullLabel = CANDLE_SHORT_LABELS[i] ?? c.label;
            const compactLabel = COMPACT_LABELS[i] ?? fullLabel;
            return (
              <span
                key={c.day}
                role="img"
                aria-label={`${fullLabel}, Day ${c.day}`}
                className="absolute flex flex-col items-center whitespace-nowrap"
                style={{
                  left: `${pct}%`,
                  top: "calc(100% + 10px)",
                  transform: "translateX(-50%)",
                  zIndex: "var(--z-raised)",
                  maxWidth: 88,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={`${fullLabel}, Day ${c.day}`}
              >
                <span
                  data-timeline="compact-label"
                  className="md:hidden"
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
                  className="hidden md:inline"
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
                  className="md:hidden"
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
                  className="hidden md:inline"
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
                zIndex: "var(--z-above)",
              }}
              title={`${c.label}, Day ${c.day}, ${status}`}
            >
              <div
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full md:h-6 md:w-6"
                style={{
                  backgroundColor: filled
                    ? "var(--brand-primary)"
                    : "var(--surface-card)",
                  border: `2px solid var(--brand-primary)`,
                  color: filled ? "var(--on-brand)" : "var(--brand-primary)",
                  boxShadow: "0 0 0 2.5px var(--surface-subtle)",
                }}
              >
                {status === "logged" ? (
                  <Check size={13} weight="bold" />
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
          className="md:hidden"
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
          className="hidden md:inline"
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
          className="md:hidden"
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
          className="hidden md:inline"
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
