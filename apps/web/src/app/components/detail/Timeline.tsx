import { Check } from "lucide-react";
import {
  RUST,
  RUST_NODE,
  CANDLE_SHORT_LABELS,
  dayFraction,
  markerStatus,
} from "./types";

interface TimelineProps {
  currentDay: number;
  totalDays: number;
  candling: { day: number; label: string }[];
  candled: Record<number, boolean>;
}

export function Timeline({ currentDay, totalDays, candling, candled }: TimelineProps) {
  // Progress bar is capped at 100% (the target hatch day) — overtime only
  // changes the day counter, never the bar.
  const isReady = currentDay <= 0;
  const fillPct = isReady ? 0 : Math.min(100, dayFraction(currentDay, totalDays) * 100);
  const badgeLeft = `clamp(28px, ${fillPct}%, calc(100% - 28px))`;
  const NODE = 28;

  return (
    <div>
      <div className="relative mx-1 overflow-visible" style={{ paddingTop: 56, paddingBottom: 62 }}>
        {/* Track frame — the axis line, centered vertically in the container. */}
        <div
          className="absolute left-0 right-0"
          style={{ height: 6, top: "50%", transform: "translateY(-50%)" }}
        >
          {/* Track line (6px stroke) + progress fill. */}
          <div className="absolute inset-0 rounded-full" style={{ backgroundColor: "#ECE6D9" }} />
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fillPct}%`, backgroundColor: RUST }} />

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
                fontSize: 11,
                fontWeight: 800,
                backgroundColor: RUST,
                color: "#fff",
                boxShadow: "0 2px 6px rgba(173,58,29,0.28)",
                padding: "4px 10px",
                borderRadius: 10,
                gap: 1,
              }}
            >
              <span style={{ lineHeight: 1.2 }}>{isReady ? "Ready" : "Today"}</span>
              <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.2, letterSpacing: "0.05em" }}>
                DAY {Math.max(0, currentDay)}
              </span>
            </span>
            {/* Stem + ▼ triangle; the tip touches the top of the track line. */}
            <svg width={10} height={14} viewBox="0 0 10 14" style={{ display: "block" }} aria-hidden>
              <path d="M5 2 L5 7" stroke={RUST} strokeWidth={2} strokeLinecap="round" />
              <path d="M1.5 6 L8.5 6 L5 12.5 Z" fill={RUST} />
            </svg>
          </div>

          {/* Layer 3 — milestone labels, 12px below the track line. */}
          {candling.map((c, i) => {
            const pct = dayFraction(c.day, totalDays) * 100;
            return (
              <span
                key={c.day}
                className="absolute flex flex-col items-center whitespace-nowrap"
                style={{ left: `${pct}%`, top: "calc(100% + 12px)", transform: "translateX(-50%)", zIndex: 5 }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#78716C" }}>
                  {CANDLE_SHORT_LABELS[i] ?? c.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#78716C" }}>
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
              style={{ left: `${pct}%`, top: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}
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
                  <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{i + 1}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mx-1 flex justify-between" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#78716C" }}>
        <span>DAY 1</span>
        <span>DAY {totalDays}</span>
      </div>
    </div>
  );
}
