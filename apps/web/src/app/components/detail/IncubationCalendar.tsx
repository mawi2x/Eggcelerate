import { ChevronLeft, ChevronRight } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import type { CandlingCheckpoint, CandlingLogEntry } from "../../domain/types";
import { Card, CardContent } from "../ui/card";

const WEEKDAY_HEADS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface IncubationCalendarProps {
  currentDay: number;
  totalDays: number;
  candling: CandlingCheckpoint[];
  entries?: CandlingLogEntry[];
}

interface CycleModel {
  dayOffset: (day: number) => Date;
  candlingDays: CandlingCheckpoint[];
  lockdownDay: number;
  cycleStartDate: Date;
  cycleEndDate: Date;
  lockdownDate: Date;
  todayDate: Date;
  isInIncubationPeriod: (d: Date) => boolean;
  isInLockdownPhase: (d: Date) => boolean;
}

function useCycleModel(
  currentDay: number,
  totalDays: number,
  candling: CandlingCheckpoint[],
  entries: CandlingLogEntry[],
): CycleModel {
  // Anchor the calendar to recorded cycle dates instead of a fixed demo month.
  const firstEntry = entries.find((entry) =>
    Number.isFinite(new Date(entry.date).getTime()),
  );
  const start = firstEntry ? new Date(firstEntry.date) : new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (firstEntry?.day ?? currentDay) + 1);
  const dayOffset = (day: number) => {
    const d = new Date(start);
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

  return {
    dayOffset,
    candlingDays,
    lockdownDay,
    cycleStartDate,
    cycleEndDate,
    lockdownDate,
    todayDate,
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
  const upcomingMilestones = [
    ...model.candlingDays.map((checkpoint, index) => ({
      day: checkpoint.day,
      label: index === 0 ? "1st candling" : "2nd candling",
    })),
    { day: model.lockdownDay, label: "Lockdown" },
    { day: totalDays, label: "Expected hatch" },
  ].sort((a, b) => a.day - b.day);
  const currentMilestone = upcomingMilestones.find(
    (milestone) => milestone.day === currentDay,
  );
  const nextMilestone = upcomingMilestones.find(
    (milestone) => milestone.day > currentDay,
  );
  const overdueDays = currentDay - totalDays;

  let statusTitle: string;
  let statusDescription: string;
  if (currentDay > totalDays) {
    statusTitle = `Day ${currentDay} — ${overdueDays} day${overdueDays === 1 ? "" : "s"} past expected hatch`;
    statusDescription = "Check hatch progress and finish the cycle when ready.";
  } else if (currentDay === totalDays) {
    statusTitle = `Day ${currentDay} — Expected hatch today`;
    statusDescription = "Check hatch progress and finish the cycle when ready.";
  } else if (currentDay < 1) {
    statusTitle = "Cycle not started";
    statusDescription = `Eggs are scheduled to be loaded on ${model.cycleStartDate.toLocaleDateString([], { month: "short", day: "numeric" })}.`;
  } else if (currentMilestone) {
    statusTitle = `Day ${currentDay} of ${totalDays} — ${currentMilestone.label} today`;
    statusDescription = `Scheduled for ${model.dayOffset(currentDay).toLocaleDateString([], { month: "short", day: "numeric" })}.`;
  } else {
    statusTitle = `Day ${currentDay} of ${totalDays}`;
    statusDescription = nextMilestone
      ? `Next: ${nextMilestone.label} in ${nextMilestone.day - currentDay} day${nextMilestone.day - currentDay === 1 ? "" : "s"} · ${model.dayOffset(nextMilestone.day).toLocaleDateString([], { month: "short", day: "numeric" })}.`
      : "Cycle in progress.";
  }

  return (
    <div
      className="mb-3 flex items-start gap-2.5 rounded-xl px-3 py-2.5"
      aria-live="polite"
      style={{ backgroundColor: "var(--surface-muted)" }}
    >
      <span
        aria-hidden="true"
        className="mt-1 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: "var(--brand-primary)" }}
      />
      <div className="min-w-0">
        <p
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-caption)",
            fontWeight: "var(--weight-bold)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          {statusTitle}
        </p>
        <p
          className="mt-0.5"
          style={{
            color: "var(--text-secondary)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-label)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          {statusDescription}
        </p>
      </div>
    </div>
  );
}
function MonthView({
  currentDay,
  totalDays,
  model,
  entries,
}: CalendarViewProps & { entries: CandlingLogEntry[] }) {
  const [selected, setSelected] = useState(() => model.dayOffset(currentDay));
  const first = new Date(model.cycleStartDate);
  first.setDate(first.getDate() - first.getDay());
  const last = new Date(
    Math.max(model.cycleEndDate.getTime(), model.todayDate.getTime()),
  );
  last.setDate(last.getDate() + 6 - last.getDay());
  const dayCount =
    Math.round(
      (Date.UTC(last.getFullYear(), last.getMonth(), last.getDate()) -
        Date.UTC(first.getFullYear(), first.getMonth(), first.getDate())) /
        86_400_000,
    ) + 1;
  const cells = Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(first);
    date.setDate(date.getDate() + i);
    return date;
  });
  const cycleDayFor = (date: Date) =>
    Math.round(
      (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
        Date.UTC(
          model.cycleStartDate.getFullYear(),
          model.cycleStartDate.getMonth(),
          model.cycleStartDate.getDate(),
        )) /
        86_400_000,
    ) + 1;
  const milestones = [
    { day: 1, label: "Eggs set" },
    ...model.candlingDays.map((checkpoint) => ({
      day: checkpoint.day,
      label: checkpoint.label,
    })),
    { day: model.lockdownDay, label: "Lockdown" },
    { day: totalDays, label: "Expected hatch" },
  ].sort((a, b) => a.day - b.day);
  const selectedDay = cycleDayFor(selected);
  const milestone = milestones.find((item) => item.day === selectedDay);
  const next = milestones.find((item) => item.day > selectedDay);
  const entry = entries.find((item) => item.day === selectedDay);
  const later =
    entry &&
    (entry.checkpointType === "later" ||
      entry.developing !== undefined ||
      entry.stoppedDeveloping !== undefined);
  const title =
    milestone?.label ??
    (selectedDay > totalDays
      ? "Past expected hatch day"
      : selectedDay < 1
        ? "Before cycle start"
        : selectedDay >= model.lockdownDay
          ? "Lockdown phase"
          : "Incubating");
  const description = entry
    ? later
      ? `${entry.developing ?? entry.fertile} developing and ${entry.stoppedDeveloping ?? 0} stopped`
      : `${entry.fertile} fertile, with ${entry.clear} clear and ${entry.uncertain} uncertain`
    : milestone
      ? selectedDay === 1
        ? "Cycle start"
        : selectedDay === totalDays
          ? "Hatch is expected today. Please check your incubator."
          : "Planned milestone · No inspection recorded"
      : next
        ? `${next.day - selectedDay} day${next.day - selectedDay === 1 ? "" : "s"} until ${next.label.toLowerCase()}`
        : "Check hatch progress and finish the cycle when ready.";
  return (
    <>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_HEADS.map((day) => (
          <div
            key={day}
            className="pb-1 text-center"
            style={{
              fontSize: "var(--type-label)",
              color: "var(--text-muted)",
              fontWeight: "var(--weight-bold)",
            }}
          >
            {day[0]}
          </div>
        ))}
        {cells.map((date) => {
          const day = cycleDayFor(date);
          const inCycle = model.isInIncubationPeriod(date);
          const today = day === currentDay;
          const hatch = day === totalDays;
          const candlingDay = model.candlingDays.some(
            (item) => item.day === day,
          );
          const lockdown = day === model.lockdownDay;
          const active = date.toDateString() === selected.toDateString();
          const background = today
            ? "var(--brand-primary-hover)"
            : hatch
              ? "var(--status-success-fg)"
              : lockdown
                ? "var(--status-warning-fg)"
                : candlingDay
                  ? "var(--accent-gold)"
                  : model.isInLockdownPhase(date)
                    ? "var(--brand-primary-soft)"
                    : inCycle
                      ? "var(--surface-amber-wash)"
                      : "transparent";
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => setSelected(date)}
              aria-pressed={active}
              aria-current={today ? "date" : undefined}
              aria-label={`${date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}${day >= 1 ? `, cycle Day ${day}` : ""}${today ? ", Today" : ""}${milestones.find((item) => item.day === day) ? `, ${milestones.find((item) => item.day === day)?.label}` : ""}`}
              className="relative flex h-10 min-w-0 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-compact)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              style={{
                backgroundColor: background,
                color:
                  today || hatch || lockdown
                    ? "var(--on-brand)"
                    : candlingDay
                      ? "var(--text-amber-strong)"
                      : inCycle
                        ? "var(--text-primary)"
                        : "var(--text-faint)",
                boxShadow: active
                  ? "inset 0 0 0 2px var(--text-primary)"
                  : undefined,
                fontSize: "var(--type-body-sm)",
                fontWeight:
                  inCycle || today
                    ? "var(--weight-bold)"
                    : "var(--weight-regular)",
                opacity: !inCycle && !today ? 0.5 : 1,
              }}
            >
              <span>{date.getDate()}</span>
            </button>
          );
        })}
      </div>
      <div
        className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
        style={{ fontSize: "var(--type-caption)", color: "var(--text-muted)" }}
      >
        {[
          { label: "Today", color: "var(--brand-primary-hover)" },
          { label: "Candling", color: "var(--accent-gold)" },
          { label: "Lockdown", color: "var(--legend-amber)" },
          { label: "Hatch", color: "var(--legend-green)" },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5"
              style={{ backgroundColor: item.color, borderRadius: "2px" }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div
        className="mt-3 min-h-24 rounded-2xl bg-[var(--surface-subtle)] p-3"
        aria-live="polite"
        aria-atomic="true"
      >
        <p
          className="flex flex-wrap items-baseline gap-x-2"
          style={{
            fontSize: "var(--type-caption)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--text-muted)",
          }}
        >
          <span>
            {selected.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
          {selectedDay >= 1 && (
            <span
              style={{
                color: "var(--brand-primary)",
                fontWeight: "var(--weight-bold)",
              }}
            >
              Day {selectedDay}
            </span>
          )}
        </p>
        <p
          className="mt-1"
          style={{
            fontSize: "var(--type-body)",
            fontWeight: "var(--weight-bold)",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </p>
        <p
          className="mt-1"
          style={{
            fontSize: "var(--type-body-sm)",
            color: "var(--text-muted)",
          }}
        >
          {description}
        </p>
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
  const candlingMilestones = [0, 1].map((index) => {
    const checkpoint = candlingDays[index];
    const day = checkpoint?.day ?? (index === 0 ? 6 : 13);

    return {
      dot: "var(--accent-gold)",
      name: index === 0 ? "1st Candling" : "2nd Candling",
      sub: `Day ${day}, ${index === 0 ? "Fertility" : "Development"}`,
      date: dayOffset(day),
    };
  });

  return (
    <div className="flex flex-col">
      {[
        {
          dot: "var(--text-faint)",
          name: "Cycle Start",
          sub: "Day 1, Loaded",
          date: cycleStartDate,
        },
        ...candlingMilestones,
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

export function IncubationCalendar(props: IncubationCalendarProps) {
  return <CalendarSheetBody {...props} bare={false} showArrows monthFirst />;
}
const SWIPE_THRESHOLD = 50;

export function CalendarSheetBody({
  currentDay,
  totalDays,
  candling,
  entries = [],
  onPageChange,
  bare = true,
  showArrows = false,
  monthFirst = false,
}: IncubationCalendarProps & {
  onPageChange?: (page: number) => void;
  bare?: boolean;
  showArrows?: boolean;
  monthFirst?: boolean;
}) {
  const model = useCycleModel(currentDay, totalDays, candling, entries);
  const [page, setPage] = useState(0);
  const summaryPage = monthFirst ? 1 : 0;
  const monthPage = monthFirst ? 0 : 1;
  const pointerStartX = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    pageRefs.current.forEach((el, i) => {
      if (!el) return;
      if (i === page) el.removeAttribute("inert");
      else el.setAttribute("inert", "");
    });
  }, [page]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    pointerStartX.current = event.clientX;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const startX = pointerStartX.current;
    pointerStartX.current = null;
    if (startX === null) return;

    const deltaX = event.clientX - startX;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;

    event.preventDefault();
    event.stopPropagation();
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    goToPage(deltaX < 0 ? Math.min(1, page + 1) : Math.max(0, page - 1));
  };
  const goToPage = (next: number) => {
    setPage(next);
    onPageChange?.(next);
  };

  return (
    <div
      className={
        bare ? "animate-in fade-in-0 zoom-in-95 duration-300" : undefined
      }
    >
      <Card
        style={{
          backgroundColor: bare ? "transparent" : "var(--surface-card)",
          border: bare
            ? "none"
            : "var(--border-width-hairline) solid var(--border-subtle)",
          borderRadius: "var(--radius-card)",
          boxShadow: "none",
        }}
      >
        <CardContent className={bare ? "p-0" : "p-4 sm:p-5"}>
          <div
            className={
              bare
                ? "mb-4 flex flex-col items-start gap-1 pt-3 pr-12"
                : "mb-4 flex flex-wrap items-center justify-between gap-2 pr-6 lg:pr-0"
            }
          >
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--type-heading-sm)",
                fontWeight: "var(--weight-bold)",
                color: "var(--text-primary)",
              }}
            >
              Cycle Calendar
            </h3>
            <span
              style={{
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-semibold)",
                color: "var(--text-muted)",
              }}
            >
              {model.cycleStartDate.toLocaleDateString([], {
                month: "long",
                day: "numeric",
              })}{" "}
              to{" "}
              {model.cycleEndDate.toLocaleDateString([], {
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <div
            className="touch-pan-y cursor-grab select-none overflow-hidden active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              pointerStartX.current = null;
            }}
            onClickCapture={(event) => {
              if (!suppressClick.current) return;
              event.preventDefault();
              event.stopPropagation();
              suppressClick.current = false;
            }}
          >
            <div className="grid">
              <div
                className={`col-start-1 row-start-1 transition-opacity motion-reduce:transition-none ${page === summaryPage ? "opacity-100" : "invisible opacity-0"}`}
                aria-hidden={page !== summaryPage}
                ref={(el) => {
                  pageRefs.current[summaryPage] = el;
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
                className={`col-start-1 row-start-1 transition-opacity motion-reduce:transition-none ${page === monthPage ? "opacity-100" : "invisible opacity-0"}`}
                aria-hidden={page !== monthPage}
                ref={(el) => {
                  pageRefs.current[monthPage] = el;
                }}
              >
                <MonthView
                  entries={entries}
                  currentDay={currentDay}
                  totalDays={totalDays}
                  model={model}
                />
              </div>
            </div>
          </div>
          {/* biome-ignore lint/a11y/useSemanticElements: calendar navigation is an ARIA group, not form inputs */}
          <div
            className="mt-4 flex items-center justify-center gap-1.5 border-t border-[var(--border-subtle)] pt-3"
            role="group"
            aria-label="Calendar views"
          >
            {showArrows && (
              <button
                type="button"
                aria-label="Previous calendar view"
                disabled={page === 0}
                onClick={() => goToPage(0)}
                className="mr-auto flex h-[var(--control-height-default)] w-[var(--control-height-default)] items-center justify-center rounded-full text-[var(--brand-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
            )}
            {[
              { label: "Show summary", index: summaryPage },
              { label: "Show cycle calendar", index: monthPage },
            ]
              .sort((a, b) => a.index - b.index)
              .map(({ label, index }) => (
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
                      page === index
                        ? "var(--brand-primary)"
                        : "var(--dot-idle)",
                  }}
                />
              ))}
            {showArrows && (
              <button
                type="button"
                aria-label="Next calendar view"
                disabled={page === 1}
                onClick={() => goToPage(1)}
                className="ml-auto flex h-[var(--control-height-default)] w-[var(--control-height-default)] items-center justify-center rounded-full text-[var(--brand-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
