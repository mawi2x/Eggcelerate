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
}

export function Timeline({
  currentDay,
  totalDays,
  candling,
  candled,
}: TimelineProps) {
  // Progress bar is capped at 100% (the target hatch day) — overtime only
  // changes the day counter, never the bar.
  const isReady = currentDay <= 0;
  const fillPct = isReady
    ? 0
    : Math.min(100, dayFraction(currentDay, totalDays) * 100);
  const badgeLeft = `clamp(28px, ${fillPct}%, calc(100% - 28px))`;
  const NODE = 28;

  return (
    <div>
      <div
        className="relative mx-1 overflow-visible"
        style={{ paddingTop: 56, paddingBottom: 68 }}
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
              className="flex flex-col items-center justify-center whitespace-nowrap"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-extrabold)",
                letterSpacing: "var(--tracking-label)",
                lineHeight: "var(--leading-snug)",
                backgroundColor: RUST,
                color: "#fff",
                boxShadow: "0 2px 6px rgba(173,58,29,0.28)",
                padding: "4px 10px",
                borderRadius: 10,
                gap: 1,
              }}
            >
              <span style={{ lineHeight: 1.2 }}>
                {isReady ? "Ready" : "Today"}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-label)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: 1.2,
                  letterSpacing: "var(--tracking-label)",
                }}
              >
                DAY {Math.max(0, currentDay)}
              </span>
            </span>
            {/* Stem + ▼ triangle; the tip touches the top of the track line. */}
            <svg
              width={10}
              height={14}
              viewBox="0 0 10 14"
              style={{ display: "block" }}
              aria-hidden
            >
              <path
                d="M5 2 L5 7"
                stroke={RUST}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <path d="M1.5 6 L8.5 6 L5 12.5 Z" fill={RUST} />
            </svg>
          </div>

          {/* Layer 3 — milestone labels, below the track line and nodes. */}
          {candling.map((c, i) => {
            const pct = dayFraction(c.day, totalDays) * 100;
            return (
              <span
                key={c.day}
                className="absolute flex flex-col items-center whitespace-nowrap"
                style={{
                  left: `${pct}%`,
                  top: "calc(100% + 22px)",
                  transform: "translateX(-50%)",
                  zIndex: 5,
                }}
              >
                <span
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
                  {CANDLE_SHORT_LABELS[i] ?? c.label}
                </span>
                <span
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
                className="flex items-center justify-center rounded-full"
                style={{
                  width: NODE,
                  height: NODE,
                  backgroundColor: filled ? RUST_NODE : "#FFFFFF",
                  border: `2px solid ${RUST_NODE}`,
                  color: filled ? "#FFFFFF" : RUST_NODE,
                  boxShadow: "0 0 0 3px #F9F6F0",
                }}
              >
                {status === "logged" ? (
                  <Check size={14} strokeWidth={3.2} />
                ) : (
                  <span
                    style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}
                  >
                    {i + 1}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="mx-1 flex justify-between"
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
        <span>DAY 1</span>
        <span>DAY {totalDays}</span>
      </div>
    </div>
  );
}
