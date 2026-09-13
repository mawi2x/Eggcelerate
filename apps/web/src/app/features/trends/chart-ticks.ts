import type { ReadingWindow } from "../../data/repositories/repository";

/**
 * Chart tick formatting for the Trends environmental chart.
 * Pure functions (no React/recharts) so the mobile tick contract is unit-testable.
 * Tick *style* (font, color) stays in `TrendsScreen.tsx` with `--type-label`.
 */

/** Decimals for y-tick labels from the visible domain span. */
export function yTickDecimals(span: number): number {
  if (!Number.isFinite(span) || span <= 0) return 0;
  if (span <= 0.5) return 2;
  if (span <= 2) return 1;
  return 0;
}

/** Uniform-decimal y label — trailing `.0` is intentional (ragged decimals are the bug). */
export function formatYTick(value: number, span: number): string {
  return value.toFixed(yTickDecimals(span));
}

/**
 * X tick: 24h renders hour-only ("11 PM") so ticks spread over a day never
 * repeat the same wall time; longer ranges render short dates ("Sep 5").
 */
export function formatXTick(timestamp: number, range: ReadingWindow): string {
  const date = new Date(timestamp);
  if (range === "24h")
    return date
      .toLocaleTimeString([], { hour: "numeric", hour12: true })
      .toUpperCase();
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Evenly spaced tick timestamps across sorted data — deterministic, no recharts guessing. */
export function pickTimeTicks(sortedTs: number[], count: number): number[] {
  if (sortedTs.length === 0 || count <= 0) return [];
  if (sortedTs.length <= count) return [...sortedTs];
  if (count === 1) return [sortedTs[sortedTs.length - 1]];
  const last = sortedTs.length - 1;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(sortedTs[Math.round((i * last) / (count - 1))]);
  }
  return Array.from(new Set(out));
}

/** Blank consecutive duplicate labels (keeps the first); recharts renders "" as an empty tick. */
export function dedupeTickLabels(labels: string[]): string[] {
  let prev: string | null = null;
  return labels.map((label) => {
    if (label === prev) return "";
    prev = label;
    return label;
  });
}
