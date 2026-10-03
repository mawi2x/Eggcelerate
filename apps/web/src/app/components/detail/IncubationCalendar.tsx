import { ChevronLeft, ChevronRight } from "lucide-react";
import { type TouchEvent, useEffect, useRef, useState } from "react";
import type { CandlingCheckpoint } from "../../domain/types";
import { SectionCard } from "./primitives";

// Design anchor: cycle Day 1 = Aug 5, 2026, so Day 6 = Aug 10, Day 13 = Aug 17,
// Day 18 = Aug 22, Day 21 = Aug 25 — all within the August 2026 default view.
const CYCLE_START = new Date(2026, 7, 5);
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAY_HEADS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface IncubationCalendarProps {
  currentDay: number;
  totalDays: number;
  candling: CandlingCheckpoint[];
}

type MilestoneKind = "today" | "candling" | "lockdown" | "hatch";

interface Milestone {
  kind: MilestoneKind;
  label: string;
}

interface CycleModel {
  dayOffset: (day: number) => Date;
  candlingDays: CandlingCheckpoint[];
  lockdownDay: number;
  cycleStartDate: Date;
  cycleEndDate: Date;
  lockdownDate: Date;
  todayDate: Date;
  milestoneFor: (d: Date) => Milestone | null;
  isInIncubationPeriod: (d: Date) => boolean;
  isInLockdownPhase: (d: Date) => boolean;
}

function useCycleModel(
  currentDay: number,
  totalDays: number,
  candling: CandlingCheckpoint[],
): CycleModel {
  const dayOffset = (day: number) => {
    const d = new Date(CYCLE_START);
    d.setDate(d.getDate() + day - 1);
    return d;
  };

  const candlingDays = candling.slice(0, 2);
  const lockdownDay = candling[2]?.day ?? 18;
  const todayDate = dayOffset(currentDay);
  const cycleStartDate = dayOffset(1);
  const cycleEndDate = dayOffset(totalDays);
  const lockdownDate = dayOffset(lockdownDay);

  const isInIncubationPeriod = (d: Date) =>
    d >= cycleStartDate && d <= cycleEndDate;
  const isInLockdownPhase = (d: Date) => d >= lockdownDate && d <= cycleEndDate;

  const milestoneFor = (d: Date) => {
    if (d.toDateString() === todayDate.toDateString()) {
      return { kind: "today" as const, label: `Day ${currentDay}, Today` };
    }
    const candlingCheckpoint = candlingDays.find(
      (checkpoint) =>
        d.toDateString() === dayOffset(checkpoint.day).toDateString(),
    );
    if (candlingCheckpoint) {
      return {
        kind: "candling" as const,
        label: `Day ${candlingCheckpoint.day}, ${candlingCheckpoint.label}`,
      };
    }
    if (d.toDateString() === dayOffset(lockdownDay).toDateString()) {
      return {
        kind: "lockdown" as const,
        label: `Day ${lockdownDay}, Lockdown`,
      };
    }
    if (d.toDateString() === dayOffset(totalDays).toDateString()) {
      return { kind: "hatch" as const, label: `Day ${totalDays}, Hatch` };
    }
    return null;
  };

  return {
    dayOffset,
    candlingDays,
    lockdownDay,
    cycleStartDate,
    cycleEndDate,
    lockdownDate,
    todayDate,
    milestoneFor,
    isInIncubationPeriod,
    isInLockdownPhase,
  };
}

interface CalendarViewProps {
  currentDay: number;
  totalDays: number;
  model: CycleModel;
}

function GlanceView({ currentDay, totalDays, model }: CalendarViewProps) {
  const { dayOffset, lockdownDay, milestoneFor } = model;
  const upcomingMilestone = [
    ...model.candlingDays.map((c) => ({ day: c.day, label: c.label })),
    { day: lockdownDay, label: "Lockdown" },
    { day: totalDays, label: "Expected Hatch" },
  ]
    .filter((m) => m.day >= currentDay)
    .sort((a, b) => a.day - b.day)[0];
  const stripStart = Math.min(
    Math.max(1, currentDay - 3),
    Math.max(1, totalDays - 6),
  );
  const stripDays = Array.from(
    { length: Math.min(7, totalDays) },
    (_, i) => stripStart + i,
  );

  return (
    <>
      {/* Mobile glance view: next milestone + 7-day strip (desktop uses the month grid below). */}
      {upcomingMilestone && (
        <div
          className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ backgroundColor: "var(--surface-muted)" }}
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--brand-primary)" }}
          />
          <p
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-normal)",
            }}
          >
            {upcomingMilestone.day === currentDay
              ? `Today: ${upcomingMilestone.label}`
              : `${upcomingMilestone.label} in ${upcomingMilestone.day - currentDay} day${upcomingMilestone.day - currentDay === 1 ? "" : "s"} on ${dayOffset(upcomingMilestone.day).toLocaleDateString([], { month: "short", day: "numeric" })}`}
          </p>
        </div>
      )}
      <ul
        className="mb-3 grid grid-cols-7 gap-1"
        aria-label="This week in the cycle"
      >
        {stripDays.map((d) => {
          const isToday = d === currentDay;
          const kind = !isToday ? milestoneFor(dayOffset(d))?.kind : undefined;
          const dot =
            kind === "candling"
              ? "var(--accent-gold)"
              : kind === "lockdown"
                ? "var(--legend-amber)"
                : kind === "hatch"
                  ? "var(--legend-green)"
                  : "transparent";
          return (
            <li
              key={d}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-2"
              style={
                isToday
                  ? {
                      backgroundColor: "var(--brand-primary)",
                      color: "var(--on-brand)",
                    }
                  : { backgroundColor: "var(--surface-muted)" }
              }
            >
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-label)",
                  fontWeight: "var(--weight-bold)",
                  letterSpacing: "var(--tracking-label)",
                  lineHeight: "var(--leading-snug)",
                  color: isToday ? "var(--on-brand)" : "var(--text-muted)",
                }}
              >
                {dayOffset(d).toLocaleDateString([], { weekday: "narrow" })}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--type-body)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-tight)",
                  color: isToday ? "var(--on-brand)" : "var(--text-primary)",
                }}
              >
                {d}
              </span>
              <span
                aria-hidden="true"
                className="h-1 w-1 rounded-full"
                style={{ backgroundColor: dot }}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
function MonthView({ currentDay, totalDays, model }: CalendarViewProps) {
  const {
    cycleStartDate,
    dayOffset,
    isInIncubationPeriod,
    isInLockdownPhase,
    milestoneFor,
  } = model;
  const [view, setView] = useState(() => {
    const today = new Date(dayOffset(1));
    today.setDate(today.getDate() + Math.max(0, currentDay - 1));
    return { y: today.getFullYear(), m: today.getMonth() };
  });

  const first = new Date(view.y, view.m, 1);
  const lead = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  // Always render 6 rows (42 slots) so the card height never shifts between months
  const trailingCount = 42 - lead - daysInMonth;

  const cells: ({ day: number; date: Date; trailing: boolean } | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      date: new Date(view.y, view.m, i + 1),
      trailing: false,
    })),
    ...Array.from({ length: trailingCount }, (_, i) => ({
      day: i + 1,
      date: new Date(view.y, view.m + 1, i + 1),
      trailing: true,
    })),
  ];

  const shiftMonth = (delta: number) =>
    setView(({ y, m }) => {
      const next = new Date(y, m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });

  return (
    <>
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-[var(--control-hit-area-icon)] w-[var(--control-hit-area-icon)] cursor-pointer items-center justify-center rounded-full text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-track)] hover:text-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 md:h-[var(--control-size-icon)] md:w-[var(--control-size-icon)]"
          aria-label="Previous month"
        >
          <ChevronLeft size={15} />
        </button>
        <span
          className="text-center"
          style={{
            minWidth: 118,
            fontSize: "var(--type-body)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--text-primary)",
          }}
        >
          {MONTH_NAMES[view.m]} {view.y}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-[var(--control-hit-area-icon)] w-[var(--control-hit-area-icon)] cursor-pointer items-center justify-center rounded-full text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-track)] hover:text-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 md:h-[var(--control-size-icon)] md:w-[var(--control-size-icon)]"
          aria-label="Next month"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_HEADS.map((w) => (
          <div
            key={w}
            className="text-center"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-label)",
              fontWeight: "var(--weight-bold)",
              letterSpacing: "var(--tracking-label)",
              color: "var(--text-faint)",
            }}
          >
            {w[0]}
          </div>
        ))}
      </div>

      {/* Day grid — fixed 6 rows, trailing days muted */}
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {cells.map((c, i) => {
          if (c === null) {
            const placeholderDate = new Date(view.y, view.m, i - lead);
            return <div key={placeholderDate.toISOString()} />;
          }
          const m = c.trailing ? null : milestoneFor(c.date);
          const inCycle = isInIncubationPeriod(c.date);
          const inLockdownPhase = isInLockdownPhase(c.date);
          const previous = cells[i - 1];
          const nextCell = cells[i + 1];
          const phaseKey = inLockdownPhase
            ? "lockdown"
            : inCycle
              ? "incubation"
              : "outside";
          const previousPhaseKey =
            previous && previous !== null
              ? isInLockdownPhase(previous.date)
                ? "lockdown"
                : isInIncubationPeriod(previous.date)
                  ? "incubation"
                  : "outside"
              : "outside";
          const nextPhaseKey =
            nextCell && nextCell !== null
              ? isInLockdownPhase(nextCell.date)
                ? "lockdown"
                : isInIncubationPeriod(nextCell.date)
                  ? "incubation"
                  : "outside"
              : "outside";
          const startsPhaseBand =
            inCycle && (i % 7 === 0 || phaseKey !== previousPhaseKey);
          const endsPhaseBand =
            inCycle && (i % 7 === 6 || phaseKey !== nextPhaseKey);
          const phaseTransitionBefore =
            startsPhaseBand && previousPhaseKey !== "outside";
          const cycleDay = inCycle
            ? Math.round(
                (c.date.getTime() - cycleStartDate.getTime()) / 86_400_000,
              ) + 1
            : null;

          return (
            <div
              key={c.date.toISOString()}
              className="flex flex-col items-center justify-center"
              style={{
                position: "relative",
                height: 38,
                boxSizing: "border-box",
                marginLeft: phaseTransitionBefore ? 9 : undefined,
                backgroundColor: inCycle
                  ? inLockdownPhase
                    ? "var(--brand-primary-soft)"
                    : "var(--surface-amber-wash)"
                  : "transparent",
                borderTop: inCycle
                  ? `var(--border-width-hairline) solid ${inLockdownPhase ? "var(--swatch-clay)" : "var(--swatch-sand)"}`
                  : undefined,
                borderBottom: inCycle
                  ? `var(--border-width-hairline) solid ${inLockdownPhase ? "var(--swatch-clay)" : "var(--swatch-sand)"}`
                  : undefined,
                borderLeft: startsPhaseBand
                  ? `var(--border-width-hairline) solid ${inLockdownPhase ? "var(--swatch-clay)" : "var(--swatch-sand)"}`
                  : undefined,
                borderRight: endsPhaseBand
                  ? `var(--border-width-hairline) solid ${inLockdownPhase ? "var(--swatch-clay)" : "var(--swatch-sand)"}`
                  : undefined,
                borderRadius: `${startsPhaseBand ? "var(--radius-compact)" : 0} ${endsPhaseBand ? "var(--radius-compact)" : 0} ${endsPhaseBand ? "var(--radius-compact)" : 0} ${startsPhaseBand ? "var(--radius-compact)" : 0}`,
                zIndex: m?.kind === "today" ? "var(--z-sunken)" : undefined,
              }}
              title={
                m?.label ??
                (cycleDay
                  ? `Incubation Day ${cycleDay} of ${totalDays}`
                  : undefined)
              }
            >
              {m?.kind === "today" ? (
                <span
                  className="pointer-events-none absolute flex flex-col items-center justify-center rounded-[var(--radius-compact)]"
                  style={{
                    width: 44,
                    height: 38,
                    boxSizing: "border-box",
                    backgroundColor: "var(--brand-primary-hover)",
                    color: "var(--on-brand)",
                    boxShadow: "var(--shadow-dot)",
                    zIndex: "var(--z-low)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-label)",
                      fontWeight: "var(--weight-bold)",
                      letterSpacing: "var(--tracking-label)",
                      lineHeight: "var(--leading-snug)",
                    }}
                  >
                    DAY {currentDay}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--type-body)",
                      fontWeight: "var(--weight-bold)",
                      lineHeight: "var(--leading-tight)",
                    }}
                  >
                    {c.day}
                  </span>
                </span>
              ) : (
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    fontSize: "var(--type-caption)",
                    boxSizing: "border-box",
                    fontWeight: m
                      ? "var(--weight-bold)"
                      : "var(--weight-medium)",
                    borderRadius: m ? 7 : 999,
                    backgroundColor:
                      m?.kind === "candling"
                        ? "var(--accent-gold)"
                        : m?.kind === "lockdown"
                          ? "var(--status-warning-fg)"
                          : m?.kind === "hatch"
                            ? "var(--status-success-fg)"
                            : "transparent",
                    color:
                      m?.kind === "lockdown"
                        ? "var(--on-brand)"
                        : m?.kind === "hatch"
                          ? "var(--on-brand)"
                          : m?.kind === "candling"
                            ? "var(--text-amber-strong)"
                            : m
                              ? "var(--text-primary)"
                              : "var(--text-muted)",
                    ...(c.trailing
                      ? { color: "var(--border-stone)", opacity: 0.4 }
                      : {}),
                  }}
                >
                  {c.day}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* One-line legend */}
      <div
        className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t pt-2.5"
        style={{ borderColor: "var(--border-sand)" }}
      >
        {[
          {
            swatch: (
              <span
                className="rounded-sm"
                style={{
                  width: 11,
                  height: 11,
                  backgroundColor: "var(--brand-primary-hover)",
                }}
              />
            ),
            label: "Today",
          },
          {
            swatch: (
              <span
                className="rounded-sm"
                style={{
                  width: 11,
                  height: 11,
                  backgroundColor: "var(--accent-gold)",
                }}
              />
            ),
            label: "Candling",
          },
          {
            swatch: (
              <span
                className="rounded-sm"
                style={{
                  width: 11,
                  height: 11,
                  backgroundColor: "var(--legend-amber)",
                }}
              />
            ),
            label: "Lockdown",
          },
          {
            swatch: (
              <span
                className="rounded-sm"
                style={{
                  width: 11,
                  height: 11,
                  backgroundColor: "var(--legend-green)",
                }}
              />
            ),
            label: "Hatch",
          },
        ].map((l) => (
          <span
            key={l.label}
            className="flex select-none items-center gap-1"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-semibold)",
              lineHeight: "var(--leading-normal)",
              color: "var(--text-muted)",
            }}
          >
            {l.swatch} {l.label}
          </span>
        ))}
      </div>
    </>
  );
}

function ScheduleListView({ totalDays, model }: CalendarViewProps) {
  const {
    candlingDays,
    cycleEndDate,
    cycleStartDate,
    dayOffset,
    lockdownDate,
    lockdownDay,
  } = model;

  return (
    <div className="flex flex-col">
      {[
        {
          dot: "var(--text-faint)",
          name: "Cycle Start",
          sub: "Day 1, Loaded",
          date: cycleStartDate,
        },
        {
          dot: "var(--accent-gold)",
          name: "1st Candling",
          sub: `Day ${candlingDays[0]?.day ?? 6}, Fertility`,
          date: dayOffset(candlingDays[0]?.day ?? 6),
        },
        {
          dot: "var(--legend-amber)",
          name: "Lockdown",
          sub: `Day ${lockdownDay}, Stop Turn`,
          date: lockdownDate,
        },
        {
          dot: "var(--legend-green)",
          name: "Expected Hatch",
          sub: `Day ${totalDays}, Target`,
          date: cycleEndDate,
        },
      ].map((m) => (
        <div
          key={m.name}
          className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] py-2 last:border-b-0"
        >
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: m.dot }}
          />
          <div className="min-w-0 flex-1">
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-normal)",
                color: "var(--text-primary)",
              }}
            >
              {m.name}
            </p>
            <p
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-regular)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              {m.sub}
            </p>
          </div>
          <span
            className="shrink-0"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-semibold)",
              lineHeight: "var(--leading-normal)",
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            {m.date.toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

export function IncubationCalendar({
  currentDay,
  totalDays,
  candling,
}: IncubationCalendarProps) {
  const model = useCycleModel(currentDay, totalDays, candling);
  const {
    candlingDays,
    cycleEndDate,
    cycleStartDate,
    dayOffset,
    lockdownDate,
    lockdownDay,
  } = model;

  return (
    <SectionCard title="Incubation Calendar" centered divider>
      <div className="md:hidden">
        <GlanceView
          currentDay={currentDay}
          totalDays={totalDays}
          model={model}
        />
      </div>
      <div className="hidden md:block">
        <MonthView
          currentDay={currentDay}
          totalDays={totalDays}
          model={model}
        />
      </div>

      {/* Key Cycle Dates schedule */}
      <div
        className="mt-3.5 border-t pt-3"
        style={{ borderColor: "var(--border-sand)" }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-normal)",
              }}
            >
              Key Cycle Schedule
            </p>
            <p
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-regular)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              Milestones for this batch
            </p>
          </div>
          <span
            className="rounded-full px-2 py-0.5"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-label)",
              fontWeight: "var(--weight-bold)",
              letterSpacing: "var(--tracking-label)",
              lineHeight: "var(--leading-snug)",
              backgroundColor:
                currentDay >= totalDays
                  ? "var(--status-success-bg)"
                  : currentDay >= lockdownDay
                    ? "var(--brand-primary-soft)"
                    : "var(--surface-oat)",
              color:
                currentDay >= totalDays
                  ? "var(--status-success-fg)"
                  : currentDay >= lockdownDay
                    ? "var(--text-caramel)"
                    : "var(--text-muted)",
            }}
          >
            {currentDay >= totalDays
              ? "Hatch Day"
              : currentDay >= lockdownDay
                ? "Lockdown"
                : `Day ${currentDay} of ${totalDays}`}
          </span>
        </div>
        <div className="hidden grid-cols-2 gap-2 md:grid">
          <div
            className="rounded-xl p-2"
            style={{
              backgroundColor: "var(--surface-porcelain)",
              border: "var(--border-width-hairline) solid var(--border-subtle)",
            }}
          >
            <span
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-bold)",
                letterSpacing: "var(--tracking-label)",
                lineHeight: "var(--leading-snug)",
                textTransform: "uppercase",
              }}
            >
              Cycle Start
            </span>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-normal)",
                color: "var(--text-primary)",
                marginTop: 1,
              }}
            >
              {cycleStartDate.toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </p>
            <p
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-regular)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              Day 1, Loaded
            </p>
          </div>
          <div
            className="rounded-xl p-2"
            style={{
              backgroundColor:
                currentDay >= lockdownDay
                  ? "var(--surface-pending)"
                  : "var(--surface-porcelain)",
              border: `var(--border-width-hairline) solid ${currentDay >= lockdownDay ? "var(--accent-gold)" : "var(--border-subtle)"}`,
            }}
          >
            <span
              style={{
                color:
                  currentDay >= lockdownDay
                    ? "var(--text-caramel)"
                    : "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-bold)",
                letterSpacing: "var(--tracking-label)",
                lineHeight: "var(--leading-snug)",
                textTransform: "uppercase",
              }}
            >
              Lockdown
            </span>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-normal)",
                color:
                  currentDay >= lockdownDay
                    ? "var(--text-caramel)"
                    : "var(--text-primary)",
                marginTop: 1,
              }}
            >
              {lockdownDate.toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </p>
            <p
              style={{
                color:
                  currentDay >= lockdownDay
                    ? "var(--text-caramel)"
                    : "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-regular)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              Day {lockdownDay}, Stop Turn
            </p>
          </div>
          <div
            className="rounded-xl p-2"
            style={{
              backgroundColor: "var(--surface-porcelain)",
              border: "var(--border-width-hairline) solid var(--border-subtle)",
            }}
          >
            <span
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-bold)",
                letterSpacing: "var(--tracking-label)",
                lineHeight: "var(--leading-snug)",
                textTransform: "uppercase",
              }}
            >
              1st Candling
            </span>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-normal)",
                color: "var(--text-primary)",
                marginTop: 1,
              }}
            >
              {dayOffset(candlingDays[0]?.day ?? 6).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </p>
            <p
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-regular)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              Day {candlingDays[0]?.day ?? 6}, Fertility
            </p>
          </div>
          <div
            className="rounded-xl p-2"
            style={{
              backgroundColor:
                currentDay >= totalDays
                  ? "var(--status-success-bg)"
                  : "var(--surface-porcelain)",
              border: `var(--border-width-hairline) solid ${currentDay >= totalDays ? "var(--status-success-fg)" : "var(--border-subtle)"}`,
            }}
          >
            <span
              style={{
                color:
                  currentDay >= totalDays
                    ? "var(--status-success-fg)"
                    : "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-bold)",
                letterSpacing: "var(--tracking-label)",
                lineHeight: "var(--leading-snug)",
                textTransform: "uppercase",
              }}
            >
              Expected Hatch
            </span>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-normal)",
                color:
                  currentDay >= totalDays
                    ? "var(--status-success-fg)"
                    : "var(--text-primary)",
                marginTop: 1,
              }}
            >
              {cycleEndDate.toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </p>
            <p
              style={{
                color:
                  currentDay >= totalDays
                    ? "var(--status-success-fg)"
                    : "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-regular)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              Day {totalDays}, Target
            </p>
          </div>
        </div>
        <div className="md:hidden">
          <ScheduleListView
            currentDay={currentDay}
            totalDays={totalDays}
            model={model}
          />
        </div>
      </div>
    </SectionCard>
  );
}
const SWIPE_THRESHOLD = 50;

export function CalendarSheetBody({
  currentDay,
  totalDays,
  candling,
  onPageChange,
}: IncubationCalendarProps & {
  onPageChange?: (page: number) => void;
}) {
  const model = useCycleModel(currentDay, totalDays, candling);
  const [page, setPage] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    pageRefs.current.forEach((el, i) => {
      if (!el) return;
      if (i === page) el.removeAttribute("inert");
      else el.setAttribute("inert", "");
    });
  }, [page]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    const endX = event.changedTouches[0]?.clientX;
    if (startX === null || endX === undefined) return;

    const deltaX = endX - startX;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;

    goToPage(deltaX < 0 ? Math.min(1, page + 1) : Math.max(0, page - 1));
  };
  const goToPage = (next: number) => {
    setPage(next);
    onPageChange?.(next);
  };

  return (
    <div className="animate-in fade-in-0 zoom-in-95 duration-300">
      <SectionCard title="Incubation Calendar" centered divider bare>
        <div
          className="touch-pan-y overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            touchStartX.current = null;
          }}
        >
          <div className="grid">
            <div
              className={`col-start-1 row-start-1 transition-opacity motion-reduce:transition-none ${page === 0 ? "opacity-100" : "invisible opacity-0"}`}
              ref={(el) => {
                pageRefs.current[0] = el;
              }}
            >
              <GlanceView
                currentDay={currentDay}
                totalDays={totalDays}
                model={model}
              />
              <ScheduleListView
                currentDay={currentDay}
                totalDays={totalDays}
                model={model}
              />
            </div>
            <div
              className={`col-start-1 row-start-1 transition-opacity motion-reduce:transition-none ${page === 1 ? "opacity-100" : "invisible opacity-0"}`}
              ref={(el) => {
                pageRefs.current[1] = el;
              }}
            >
              <MonthView
                currentDay={currentDay}
                totalDays={totalDays}
                model={model}
              />
            </div>
          </div>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: calendar navigation is an ARIA group, not form inputs */}
        <div
          className="mt-2 flex items-center justify-center gap-1.5"
          role="group"
          aria-label="Calendar views"
        >
          {[
            { label: "Show summary", index: 0 },
            { label: "Show full month", index: 1 },
          ].map(({ label, index }) => (
            <button
              key={label}
              type="button"
              onClick={() => goToPage(index)}
              className="h-1.5 cursor-pointer rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 motion-reduce:transition-none"
              aria-current={page === index ? "true" : undefined}
              aria-label={label}
              style={{
                width:
                  page === index
                    ? "var(--dot-width-current)"
                    : "var(--dot-size)",
                backgroundColor:
                  page === index ? "var(--brand-primary)" : "var(--dot-idle)",
              }}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
