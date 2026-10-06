import { CheckFat, EggCrackIcon, EggIcon } from "@phosphor-icons/react";
import { IconLockFilled } from "@tabler/icons-react";
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
  const overdueDays = currentDay - totalDays;

  const statusLabel = isReady
    ? "Ready to start"
    : isOverdue
      ? `${overdueDays} ${overdueDays === 1 ? "day" : "days"} past hatch`
      : isHatchDay
        ? "Hatch Day!"
        : isLockdown
          ? "Lockdown"
          : "Incubating";
  const statusBg =
    isOverdue || isLockdown
      ? "var(--status-warning-bg)"
      : isHatchDay
        ? "var(--status-success-bg)"
        : "var(--surface-subtle)";
  const statusFg =
    isOverdue || isLockdown
      ? "var(--status-warning-fg)"
      : isHatchDay
        ? "var(--status-success-fg)"
        : "var(--text-secondary)";
  const trackTop = "var(--timeline-track-top)";
  const trackCenter = `calc(${trackTop} + var(--progress-thickness) / 2)`;
  const handleNodeClick = (day: number) => onSelectMilestone(day);

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--type-heading-sm)",
            fontWeight: "var(--weight-extrabold)",
            lineHeight: "var(--leading-tight)",
            color: "var(--text-primary)",
          }}
        >
          <span>Day {Math.max(0, currentDay)}</span>{" "}
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-body)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-muted)",
            }}
          >
            / {totalDays}
          </span>
        </p>
        <span
          className="shrink-0 rounded-full px-3 py-1"
          style={{
            backgroundColor: statusBg,
            color: statusFg,
            fontSize: "var(--type-caption)",
            fontWeight: "var(--weight-bold)",
          }}
        >
          {statusLabel}
        </span>
      </div>
      <div className="max-w-full overflow-x-auto py-2 scrollbar-none">
        <div className="min-w-[var(--timeline-min-width)] px-8 md:px-10">
          <div className="timeline-rail-labels relative overflow-visible pt-5 pb-12">
            {/* Track and milestone nodes share one centerline. */}
            <div
              className="absolute left-0 right-0"
              style={{
                height: "var(--progress-thickness)",
                top: trackTop,
              }}
            >
              {/* Base track: Incubation Phase rail (Days 1 to Lockdown) */}
              <div
                className="absolute inset-0 rounded-full"
                role="progressbar"
                aria-label="Incubation cycle progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(fillPct)}
                aria-valuetext={`Day ${Math.max(0, currentDay)} of ${totalDays}${isOverdue ? `, ${overdueDays} ${overdueDays === 1 ? "day" : "days"} past hatch` : ""}`}
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
                className="absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none"
                style={{
                  width: `${fillPct}%`,
                  backgroundColor: isOverdue
                    ? "var(--status-warning-fg)"
                    : isHatchDay
                      ? "var(--status-success-fg)"
                      : "var(--brand-primary)",
                }}
              />

              {/* Single Unified Baseline: Milestone Labels */}
              {/* Day 1 (Set) */}
              <span
                role="img"
                aria-label={`Start of incubation, Day 1`}
                className="timeline-milestone-label absolute flex flex-col items-center whitespace-nowrap"
                style={{
                  left: "0%",
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
                const alternateAbove = i % 2 === 0;
                return (
                  <span
                    key={c.day}
                    role="img"
                    aria-label={`${fullLabel}, Day ${c.day}`}
                    className={`timeline-milestone-label absolute flex flex-col items-center whitespace-nowrap ${alternateAbove ? "timeline-milestone-label--above" : ""} ${i === 2 ? "-translate-x-1/2 md:-translate-x-[58%]" : "-translate-x-1/2"}`}
                    style={{
                      left: `${pct}%`,
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
                className="timeline-milestone-label absolute flex flex-col items-center whitespace-nowrap"
                style={{
                  left: "100%",
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

            {/* Milestone nodes share the actual track center, including its thickness. */}
            {/* Node 0: Day 1 (Set) */}
            <div
              className="absolute"
              style={{
                left: "0%",
                top: trackCenter,
                transform: "translate(-50%, -50%)",
                zIndex: "var(--z-above)",
              }}
            >
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{
                  backgroundColor:
                    currentDay >= 1
                      ? "var(--brand-primary)"
                      : "var(--surface-card)",
                  border: `2px solid ${currentDay >= 1 ? "var(--brand-primary)" : "var(--border-default)"}`,
                  boxShadow: "0 0 0 2.5px var(--surface-card)",
                }}
              >
                <EggIcon
                  size={12}
                  weight="fill"
                  color="var(--on-brand)"
                  aria-hidden="true"
                />
              </div>
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
                    top: trackCenter,
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
                    {isLockdownNode && filled ? (
                      <IconLockFilled size={12} />
                    ) : status === "logged" ? (
                      <CheckFat size={12} weight="fill" />
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
                top: trackCenter,
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
                <EggCrackIcon
                  size={12}
                  weight={isHatchDay || isOverdue ? "fill" : "regular"}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
