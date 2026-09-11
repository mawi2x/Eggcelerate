import { useEffect, useState } from "react";

function formatDate(d: Date): string {
  // e.g. "Tuesday, Aug 25" — no year, browser local timezone, en-US
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(d: Date): string {
  // e.g. "10:03 PM" — 12-hour with AM/PM, en-US
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function LiveDateTime({ compact = false }: { compact?: boolean } = {}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let intervalId: number | undefined;
    let timeoutId: number | undefined;

    const tick = () => setNow(new Date());

    // Align first tick to the next minute boundary so the display flips exactly on the minute,
    // then update every 60s. Falls back to immediate interval if needed.
    const msToNextMinute = 60000 - (Date.now() % 60000);
    timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 60000);
    }, msToNextMinute);

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  const dateStr = formatDate(now);
  const timeStr = formatTime(now);

  if (compact) {
    return (
      <div
        className="flex items-center gap-1.5 text-left leading-none"
        aria-live="polite"
        aria-atomic="true"
        title={dateStr}
      >
        <span
          style={{
            fontSize: "var(--type-caption)",
            fontWeight: "var(--weight-medium)",
            color: "var(--text-muted)",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
          }}
        >
          {dateStr}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 flex-col items-end text-right leading-none"
      aria-live="polite"
      aria-atomic="true"
      title={`${dateStr} at ${timeStr}`}
    >
      {/* Date — emphasized (weekday prominent), no card/border */}
      <span
        style={{
          fontSize: "var(--type-body)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--text-primary)",
          lineHeight: 1.2,
          letterSpacing: "var(--tracking-tight)",
          whiteSpace: "nowrap",
        }}
      >
        {dateStr}
      </span>
      <span
        style={{
          fontSize: "var(--type-body-sm)",
          fontWeight: "var(--weight-medium)",
          color: "var(--text-muted)",
          lineHeight: 1.2,
          marginTop: 2,
          whiteSpace: "nowrap",
        }}
      >
        {timeStr}
      </span>
    </div>
  );
}
