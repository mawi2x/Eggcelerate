import { Check, Lock, Sparkle } from "@phosphor-icons/react";
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
  /** Opens the journal at this checkpoint. */
  onSelectMilestone: (day: number) => void;
}

export function Timeline({
  currentDay,
  totalDays,
  candling,
  candled,
  labelSize = 10,
  onSelectMilestone,
}: TimelineProps) {
  const isReady = currentDay <= 0;
  const isOverdue = currentDay > totalDays;
  const isHatchDay = currentDay === totalDays;

  // Lockdown typically starts at Day 18 for a 21-day cycle, or the 3rd candling entry
  const lockdownDay = candling[2]?.day ?? Math.max(1, totalDays - 3);
  const isLockdown = currentDay >= lockdownDay && currentDay < totalDays;
  const lockdownPct = Math.min(
    100,
    Math.max(0, dayFraction(lockdownDay, totalDays) * 100),
  );

  // Progress bar capped at 100% on the main rail; overtime is signaled via badge & accent
  const fillPct = isReady
    ? 0
    : Math.min(100, Math.max(0, dayFraction(currentDay, totalDays) * 100));

  // Compact labels keep every label on one line while preserving full meaning
  const COMPACT_LABELS = ["1st", "2nd", "Lockdown"];
  const milestoneSize =
    labelSize === 9 ? "var(--type-label-micro)" : "var(--type-label-compact)";

  // Badge state configuration (tone, labels, and accents)
  let badgeTitle = "Today";
  let badgeDayText = `DAY ${Math.max(0, currentDay)}`;
  let badgeBg = "var(--brand-primary)";
  let badgeFg = "var(--on-brand)";
  let badgeBorder: string | undefined;
  let badgeShadow = "var(--shadow-accent)";
  let arrowColor = "var(--brand-primary)";

  if (isReady) {
    badgeTitle = "Ready";
    badgeDayText = "DAY 0";
    badgeBg = "var(--surface-subtle)";
    badgeFg = "var(--text-secondary)";
    badgeBorder = "1px solid var(--border-default)";
    badgeShadow = "var(--shadow-subtle)";
    arrowColor = "var(--text-secondary)";
  } else if (isOverdue) {
    badgeTitle = "Overdue";
    badgeDayText = `DAY ${currentDay}`;
    badgeBg = "var(--status-warning-bg)";
    badgeFg = "var(--status-warning-fg)";
    badgeBorder = "1.5px solid var(--status-warning-fg)";
    badgeShadow = "0 2px 8px rgba(180, 83, 9, 0.25)";
    arrowColor = "var(--status-warning-fg)";
  } else if (isHatchDay) {
    badgeTitle = "Hatch Day!";
    badgeDayText = `DAY ${currentDay}`;
    badgeBg = "var(--status-success-fg)";
    badgeFg = "var(--on-brand)";
    badgeShadow = "0 2px 8px rgba(21, 128, 61, 0.3)";
    arrowColor = "var(--status-success-fg)";
  } else if (isLockdown) {
    badgeTitle = "Lockdown";
    badgeDayText = `DAY ${currentDay}`;
    badgeBg = "var(--status-warning-fg)";
    badgeFg = "var(--on-brand)";
    badgeShadow = "0 2px 8px rgba(180, 83, 9, 0.28)";
    arrowColor = "var(--status-warning-fg)";
  }

  // Boundary-safe badge clamping:
  // Pill is ~74px wide, so clamping center between 38px and calc(100% - 38px) guarantees
  // the pill NEVER clips past container bounds on either side.
  const badgeLeft = `clamp(38px, ${fillPct}%, calc(100% - 38px))`;

  // Bending leader line geometry:
  // The line ALWAYS starts at the exact bottom center (x = 0) of the badge pill.
  // When near edges, the line curves gracefully to anchor at 0% or 100% on the track.
  // In the middle, the line drops vertically down (x = 0) to the active milestone node.
  const isStartZone = fillPct <= 12;
  const isEndZone = fillPct >= 88;
  const stemHeight = 13;
  const targetX = isStartZone
    ? -38 * (1 - fillPct / 12)
    : isEndZone
      ? 38 * ((fillPct - 88) / 12)
      : 0;
  const handleNodeClick = (day: number) => onSelectMilestone(day);

  return (
    <div className="w-full">
      <div className="max-w-full overflow-x-auto scrollbar-none">
        <div className="min-w-[18.5rem] px-5 md:px-6">
          <div className="relative overflow-visible pt-16 pb-9 md:pt-18 md:pb-10">
            {/* Track frame — pinned with explicit headroom */}
            <div
              className="absolute left-0 right-0"
              style={{
                height: "var(--progress-thickness)",
                top: "58px",
              }}
            >
              {/* Base track: Incubation Phase rail (Days 1 to Lockdown) */}
              <div
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: "var(--track-gauge)" }}
              />

              {/* Dual-Phase Accent: Lockdown zone highlight (Lockdown to Hatch) */}
              <div
                className="absolute inset-y-0 right-0 rounded-r-full"
                style={{
                  left: `${lockdownPct}%`,
                  backgroundColor: "var(--brand-primary-soft)",
                  opacity: 0.65,
                }}
                title={`Lockdown Phase: Days ${lockdownDay}–${totalDays}`}
              />

              {/* Progress fill */}
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${fillPct}%`,
                  backgroundColor: isOverdue
                    ? "var(--status-warning-fg)"
                    : isHatchDay
                      ? "var(--status-success-fg)"
                      : "var(--brand-primary)",
                }}
              />

              {/* "Today / Status" Floating Badge (Clamped & strictly visible) */}
              <div
                className="absolute flex flex-col pointer-events-none"
                style={{
                  left: badgeLeft,
                  bottom: "calc(100% + 11px)",
                  transform: "translateX(-50%)",
                  zIndex: "var(--z-top)",
                  transition: "left 0.3s ease",
                }}
              >
                {/* Badge pill — spacious capsule with clear hierarchy */}
                <div
                  className="relative flex min-h-[34px] flex-col items-center justify-center whitespace-nowrap rounded-xl px-3.5 py-1"
                  style={{
                    fontFamily: "var(--font-body)",
                    backgroundColor: badgeBg,
                    color: badgeFg,
                    border: badgeBorder,
                    boxShadow: badgeShadow,
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--type-label-compact)",
                      fontWeight: "var(--weight-bold)",
                      letterSpacing: "0.06em",
                      lineHeight: 1.2,
                      textTransform: "uppercase",
                      opacity: isReady ? 0.85 : 0.95,
                    }}
                  >
                    {badgeTitle}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--type-label)",
                      fontWeight: "var(--weight-extrabold)",
                      lineHeight: 1.2,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {badgeDayText}
                  </span>
                </div>
                <div className="relative w-full" style={{ height: stemHeight }}>
                  <svg
                    width={80}
                    height={stemHeight + 4}
                    viewBox={`-40 0 80 ${stemHeight + 4}`}
                    className="absolute top-0 left-1/2 -translate-x-1/2 overflow-visible"
                    aria-hidden
                  >
                    {/* Bending path originating strictly from bottom center (0, 0) */}
                    <path
                      d={
                        Math.abs(targetX) < 1
                          ? `M 0 0 V ${stemHeight}`
                          : `M 0 0 C 0 ${stemHeight * 0.45}, ${targetX} ${stemHeight * 0.55}, ${targetX} ${stemHeight}`
                      }
                      fill="none"
                      stroke={arrowColor}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                    {/* Target terminal dot */}
                    <circle
                      cx={targetX}
                      cy={stemHeight}
                      r={2.5}
                      fill={arrowColor}
                    />
                  </svg>
                </div>
              </div>

              {/* Single Unified Baseline: Milestone Labels */}
              {/* Day 1 (Set) */}
              <span
                role="img"
                aria-label={`Start of incubation, Day 1`}
                className="absolute flex flex-col items-center whitespace-nowrap"
                style={{
                  left: "0%",
                  top: "calc(100% + 10px)",
                  transform: "translateX(-50%)",
                  zIndex: "var(--z-raised)",
                  maxWidth: 72,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: milestoneSize,
                    fontWeight: "var(--weight-bold)",
                    letterSpacing: "var(--tracking-label)",
                    lineHeight: "var(--leading-snug)",
                    textTransform: "uppercase",
                    color:
                      currentDay >= 1
                        ? "var(--text-secondary)"
                        : "var(--text-muted)",
                  }}
                >
                  SET
                </span>
                <span
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
              </span>

              {/* Candling Milestones (Days 6, 13, 18) */}
              {candling.map((c, i) => {
                const pct = dayFraction(c.day, totalDays) * 100;
                const fullLabel = CANDLE_SHORT_LABELS[i] ?? c.label;
                const compactLabel = COMPACT_LABELS[i] ?? fullLabel;
                const isPassed = currentDay >= c.day;
                return (
                  <span
                    key={c.day}
                    role="img"
                    aria-label={`${fullLabel}, Day ${c.day}`}
                    className="absolute flex flex-col items-center whitespace-nowrap"
                    style={{
                      left: `${pct}%`,
                      top: "calc(100% + 10px)",
                      transform:
                        i === 2 ? "translateX(-58%)" : "translateX(-50%)",
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
                        color: isPassed
                          ? "var(--text-secondary)"
                          : "var(--text-muted)",
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
                        color: isPassed
                          ? "var(--text-secondary)"
                          : "var(--text-muted)",
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

              {/* Day 21 (Hatch) */}
              <span
                role="img"
                aria-label={`Expected Hatch, Day ${totalDays}`}
                className="absolute flex flex-col items-center whitespace-nowrap"
                style={{
                  left: "100%",
                  top: "calc(100% + 10px)",
                  transform: "translateX(-50%)",
                  zIndex: "var(--z-raised)",
                  maxWidth: 76,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: milestoneSize,
                    fontWeight: "var(--weight-bold)",
                    letterSpacing: "var(--tracking-label)",
                    lineHeight: "var(--leading-snug)",
                    textTransform: "uppercase",
                    color:
                      isHatchDay || isOverdue
                        ? "var(--status-success-deep)"
                        : "var(--text-muted)",
                  }}
                >
                  HATCH
                </span>
                <span
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
              </span>
            </div>

            {/* Milestone Nodes (Centered on track line at top: 54px) */}
            {/* Node 0: Day 1 (Set) */}
            <div
              className="absolute"
              style={{
                left: "0%",
                top: "58px",
                transform: "translate(-50%, -50%)",
                zIndex: "var(--z-above)",
              }}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    currentDay >= 1
                      ? "var(--brand-primary)"
                      : "var(--surface-card)",
                  border: `2px solid ${currentDay >= 1 ? "var(--brand-primary)" : "var(--border-default)"}`,
                  boxShadow: "0 0 0 2px var(--surface-card)",
                }}
              />
            </div>

            {/* Nodes 1..3: Candling Checkpoints */}
            {candling.map((c, i) => {
              const pct = dayFraction(c.day, totalDays) * 100;
              const status = markerStatus(c.day, currentDay, !!candled[c.day]);
              const filled = status !== "upcoming";
              const isLockdownNode = i === 2 || c.day === lockdownDay;
              return (
                <div
                  key={c.day}
                  className="absolute"
                  style={{
                    left: `${pct}%`,
                    top: "58px",
                    transform: "translate(-50%, -50%)",
                    zIndex: "var(--z-above)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleNodeClick(c.day)}
                    className="flex h-5 w-5 items-center justify-center rounded-full transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-amber-700"
                    style={{
                      backgroundColor: filled
                        ? "var(--brand-primary)"
                        : "var(--surface-card)",
                      border: `2px solid var(--brand-primary)`,
                      color: filled
                        ? "var(--on-brand)"
                        : "var(--brand-primary)",
                      boxShadow: "0 0 0 2.5px var(--surface-card)",
                      cursor: "pointer",
                    }}
                    aria-label={`${c.label}, Day ${c.day}`}
                  >
                    {status === "logged" ? (
                      <Check size={12} weight="bold" />
                    ) : isLockdownNode && filled ? (
                      <Lock size={10} weight="bold" />
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
                  </button>
                </div>
              );
            })}

            {/* Node 4: Day 21 (Hatch Day) */}
            <div
              className="absolute"
              style={{
                left: "100%",
                top: "58px",
                transform: "translate(-50%, -50%)",
                zIndex: "var(--z-above)",
              }}
            >
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{
                  backgroundColor:
                    isHatchDay || isOverdue
                      ? "var(--status-success-fg)"
                      : "var(--surface-card)",
                  border: `2px solid ${isHatchDay || isOverdue ? "var(--status-success-fg)" : "var(--border-default)"}`,
                  color:
                    isHatchDay || isOverdue
                      ? "var(--on-brand)"
                      : "var(--text-muted)",
                  boxShadow: "0 0 0 2.5px var(--surface-card)",
                }}
              >
                <Sparkle
                  size={11}
                  weight={isHatchDay || isOverdue ? "fill" : "regular"}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
