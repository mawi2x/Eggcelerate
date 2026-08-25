import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CandlingCheckpoint } from "../../data/mockData";
import { TEXT } from "./types";
import { SectionCard } from "./primitives";

// Design anchor: cycle Day 1 = Aug 5, 2026, so Day 6 = Aug 10, Day 13 = Aug 17,
// Day 18 = Aug 22, Day 21 = Aug 25 — all within the August 2026 default view.
const CYCLE_START = new Date(2026, 7, 5);
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_HEADS = ["S", "M", "T", "W", "T", "F", "S"];

interface IncubationCalendarProps {
  currentDay: number;
  totalDays: number;
  candling: CandlingCheckpoint[];
}

export function IncubationCalendar({ currentDay, totalDays, candling }: IncubationCalendarProps) {
  const [view, setView] = useState(() => {
    const today = new Date(CYCLE_START);
    today.setDate(today.getDate() + Math.max(0, currentDay - 1));
    return { y: today.getFullYear(), m: today.getMonth() };
  });

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

  const isInIncubationPeriod = (d: Date) => d >= cycleStartDate && d <= cycleEndDate;
  const isInLockdownPhase = (d: Date) => d >= lockdownDate && d <= cycleEndDate;

  const first = new Date(view.y, view.m, 1);
  const lead = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  // Always render 6 rows (42 slots) so the card height never shifts between months
  const trailingCount = 42 - lead - daysInMonth;

  const milestoneFor = (d: Date) => {
    if (d.toDateString() === todayDate.toDateString()) {
      return { kind: "today", label: `Day ${currentDay} · Today` };
    }
    const candlingCheckpoint = candlingDays.find(
      (checkpoint) => d.toDateString() === dayOffset(checkpoint.day).toDateString()
    );
    if (candlingCheckpoint) {
      return { kind: "candling", label: `Day ${candlingCheckpoint.day} · ${candlingCheckpoint.label}` };
    }
    if (d.toDateString() === dayOffset(lockdownDay).toDateString()) {
      return { kind: "lockdown", label: `Day ${lockdownDay} · Lockdown` };
    }
    if (d.toDateString() === dayOffset(totalDays).toDateString()) {
      return { kind: "hatch", label: `Day ${totalDays} · Hatch` };
    }
    return null;
  };

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
    <SectionCard title="Incubation Calendar" centered divider>
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-center gap-2">
        <button
          onClick={() => shiftMonth(-1)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[#A8A29E] transition-colors hover:bg-[#F5EFE6] hover:text-[var(--brand-primary)]"
          aria-label="Previous month"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-center" style={{ minWidth: 118, fontSize: 14, fontWeight: 600, color: TEXT }}>
          {MONTH_NAMES[view.m]} {view.y}
        </span>
        <button
          onClick={() => shiftMonth(1)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[#A8A29E] transition-colors hover:bg-[#F5EFE6] hover:text-[var(--brand-primary)]"
          aria-label="Next month"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_HEADS.map((w, i) => (
          <div key={i} className="text-center" style={{ fontSize: 10, fontWeight: 700, color: "#A8A29E" }}>
            {w}
          </div>
        ))}
      </div>

      {/* Day grid — fixed 6 rows, trailing days muted */}
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {cells.map((c, i) => {
          if (c === null) return <div key={i} />;
          const m = c.trailing ? null : milestoneFor(c.date);
          const inCycle = isInIncubationPeriod(c.date);
          const inLockdownPhase = isInLockdownPhase(c.date);
          const previous = cells[i - 1];
          const nextCell = cells[i + 1];
          const phaseKey = inLockdownPhase ? "lockdown" : inCycle ? "incubation" : "outside";
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
          const startsPhaseBand = inCycle && (i % 7 === 0 || phaseKey !== previousPhaseKey);
          const endsPhaseBand = inCycle && (i % 7 === 6 || phaseKey !== nextPhaseKey);
          const phaseTransitionBefore = startsPhaseBand && previousPhaseKey !== "outside";
          const cycleDay = inCycle
            ? Math.round((c.date.getTime() - cycleStartDate.getTime()) / 86_400_000) + 1
            : null;

          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center"
              style={{
                position: "relative",
                height: 38,
                boxSizing: "border-box",
                marginLeft: phaseTransitionBefore ? 9 : undefined,
                backgroundColor: inCycle ? (inLockdownPhase ? "#FCE4D6" : "#FFF0D6") : "transparent",
                borderTop: inCycle ? `1px solid ${inLockdownPhase ? "#E3A16F" : "#E9C27E"}` : undefined,
                borderBottom: inCycle ? `1px solid ${inLockdownPhase ? "#E3A16F" : "#E9C27E"}` : undefined,
                borderLeft: startsPhaseBand ? `1px solid ${inLockdownPhase ? "#E3A16F" : "#E9C27E"}` : undefined,
                borderRight: endsPhaseBand ? `1px solid ${inLockdownPhase ? "#E3A16F" : "#E9C27E"}` : undefined,
                borderRadius: `${startsPhaseBand ? 10 : 0}px ${endsPhaseBand ? 10 : 0}px ${endsPhaseBand ? 10 : 0}px ${startsPhaseBand ? 10 : 0}px`,
                zIndex: m?.kind === "today" ? 2 : undefined,
              }}
              title={m?.label ?? (cycleDay ? `Incubation Day ${cycleDay} of ${totalDays}` : undefined)}
            >
              {m?.kind === "today" ? (
                <span
                  className="pointer-events-none absolute flex flex-col items-center justify-center rounded-[10px]"
                  style={{
                    width: 44,
                    height: 38,
                    boxSizing: "border-box",
                    backgroundColor: "#8B3A1C",
                    color: "#FFFFFF",
                    boxShadow: "0 1px 2px rgba(139,58,28,0.18)",
                    zIndex: 3,
                  }}
                >
                  <span style={{ fontSize: 8, lineHeight: "9px", letterSpacing: "0.04em", fontWeight: 800 }}>
                    DAY {currentDay}
                  </span>
                  <span style={{ fontSize: 14, lineHeight: "16px", fontWeight: 700 }}>
                    {c.day}
                  </span>
                </span>
              ) : (
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    fontSize: 12,
                    boxSizing: "border-box",
                    fontWeight: m ? 700 : 500,
                    borderRadius: m ? 7 : 999,
                    backgroundColor:
                      m?.kind === "candling"
                        ? "#F2C94C"
                        : m?.kind === "lockdown"
                        ? "var(--status-warning-fg)"
                        : m?.kind === "hatch"
                        ? "var(--status-success-fg)"
                        : "transparent",
                    color:
                      m?.kind === "lockdown"
                        ? "#FFFFFF"
                        : m?.kind === "hatch"
                        ? "#FFFFFF"
                        : m?.kind === "candling"
                        ? "#713F12"
                        : m
                        ? TEXT
                        : "var(--text-muted)",
                    ...(c.trailing ? { color: "#D1C7BD", opacity: 0.4 } : {}),
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
        className="mt-3 flex items-center justify-center gap-x-2 whitespace-nowrap border-t pt-2.5"
        style={{ borderColor: "#EFE9DC" }}
      >
        {[
          { swatch: <span className="rounded-sm" style={{ width: 11, height: 11, backgroundColor: "#8B3A1C" }} />, label: "Today" },
          { swatch: <span className="rounded-sm" style={{ width: 11, height: 11, backgroundColor: "#F2C94C" }} />, label: "Candling" },
          { swatch: <span className="rounded-sm" style={{ width: 11, height: 11, backgroundColor: "#D97706" }} />, label: "Lockdown" },
          { swatch: <span className="rounded-sm" style={{ width: 11, height: 11, backgroundColor: "#16A34A" }} />, label: "Hatch" },
        ].map((l) => (
          <span key={l.label} className="flex select-none items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            {l.swatch} {l.label}
          </span>
        ))}
      </div>

      {/* Key Cycle Dates schedule */}
      <div className="mt-3.5 border-t pt-3" style={{ borderColor: "#EFE9DC" }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p style={{ color: TEXT, fontSize: 12, fontWeight: 700 }}>Key Cycle Schedule</p>
            <p style={{ color: "var(--text-muted)", fontSize: 11 }}>Milestones for this batch</p>
          </div>
          <span
            className="rounded-full px-2 py-0.5"
            style={{
              fontSize: 10,
              fontWeight: 700,
              backgroundColor: currentDay >= totalDays ? "#DCFCE7" : currentDay >= lockdownDay ? "#FCE4D6" : "#F4ECE1",
              color: currentDay >= totalDays ? "var(--status-success-fg)" : currentDay >= lockdownDay ? "#8A4B08" : "var(--text-muted)",
            }}
          >
            {currentDay >= totalDays ? "Hatch Day" : currentDay >= lockdownDay ? "Lockdown" : `Day ${currentDay} of ${totalDays}`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-2" style={{ backgroundColor: "#FCFAF6", border: "1px solid var(--border-subtle)" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Cycle Start</span>
            <p style={{ fontWeight: 700, fontSize: 12, color: TEXT, marginTop: 1 }}>{cycleStartDate.toLocaleDateString([], { month: "short", day: "numeric" })}</p>
            <p style={{ color: "var(--text-muted)", fontSize: 10 }}>Day 1 · Loaded</p>
          </div>
          <div
            className="rounded-xl p-2"
            style={{
              backgroundColor: currentDay >= lockdownDay ? "#FFF4D6" : "#FCFAF6",
              border: `1px solid ${currentDay >= lockdownDay ? "#F2C94C" : "var(--border-subtle)"}`,
            }}
          >
            <span style={{ color: currentDay >= lockdownDay ? "#8A4B08" : "var(--text-muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Lockdown</span>
            <p style={{ fontWeight: 700, fontSize: 12, color: currentDay >= lockdownDay ? "#8A4B08" : TEXT, marginTop: 1 }}>{lockdownDate.toLocaleDateString([], { month: "short", day: "numeric" })}</p>
            <p style={{ color: currentDay >= lockdownDay ? "#8A4B08" : "var(--text-muted)", fontSize: 10 }}>Day {lockdownDay} · Stop Turn</p>
          </div>
          <div className="rounded-xl p-2" style={{ backgroundColor: "#FCFAF6", border: "1px solid var(--border-subtle)" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>1st Candling</span>
            <p style={{ fontWeight: 700, fontSize: 12, color: TEXT, marginTop: 1 }}>{dayOffset(candlingDays[0]?.day ?? 6).toLocaleDateString([], { month: "short", day: "numeric" })}</p>
            <p style={{ color: "var(--text-muted)", fontSize: 10 }}>Day {candlingDays[0]?.day ?? 6} · Fertility</p>
          </div>
          <div
            className="rounded-xl p-2"
            style={{
              backgroundColor: currentDay >= totalDays ? "#DCFCE7" : "#FCFAF6",
              border: `1px solid ${currentDay >= totalDays ? "var(--status-success-fg)" : "var(--border-subtle)"}`,
            }}
          >
            <span style={{ color: currentDay >= totalDays ? "var(--status-success-fg)" : "var(--text-muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Expected Hatch</span>
            <p style={{ fontWeight: 700, fontSize: 12, color: currentDay >= totalDays ? "#15803D" : TEXT, marginTop: 1 }}>{cycleEndDate.toLocaleDateString([], { month: "short", day: "numeric" })}</p>
            <p style={{ color: currentDay >= totalDays ? "var(--status-success-fg)" : "var(--text-muted)", fontSize: 10 }}>Day {totalDays} · Target</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
