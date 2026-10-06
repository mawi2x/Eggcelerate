import type { ReadingWindow } from "../../data/repositories/repository";
// ── Design tokens ───────────────────────────────────────────────────────────
export const RUST = "var(--brand-primary)";
export const CARD = "var(--surface-subtle)";
export const SURFACE = "var(--surface-card)";
export const BORDER = "var(--border-default)";
export const TEXT = "var(--text-primary)";
export const MUTED = "var(--text-secondary)";
export const OK = "var(--status-success-fg)";
export const OK_BG = "var(--status-success-bg)";
export const WARN = "var(--status-warning-fg)";
export const WARN_BG = "var(--status-warning-bg)";
// Target-range band accent resolves from --chart-target-band (chart exception
// zone): recharts SVG fill takes an attribute, which cannot resolve var(),
// so the token is read once here instead of inlining hex.
export const TARGET_BAND_COLOR = getComputedStyle(document.documentElement)
  .getPropertyValue("--chart-target-band")
  .trim();
export const TARGET_BAND_OPACITY = 0.1;
export const inputStyle = {
  borderColor: "var(--input-border)",
  backgroundColor: "var(--surface-tile)",
};
// Framed white control used inside the trends toolbar.
export const toolbarInputStyle = {
  borderColor: "var(--input-border)",
  backgroundColor: SURFACE,
};
// One typographic voice for every control in the trends toolbar.
export const CONTROL_FONT: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-body-sm)",
  fontWeight: "var(--weight-semibold)",
  lineHeight: "var(--leading-normal)",
};
export const COMPARE_FONT: React.CSSProperties = {
  ...CONTROL_FONT,
  fontSize: "var(--type-filter-value)",
};

export type RangeKey = ReadingWindow;
export const ranges: { key: RangeKey; label: string; hours: number | null }[] =
  [
    { key: "24h", label: "LAST 24H", hours: 24 },
    { key: "7d", label: "LAST 7 DAYS", hours: 24 * 7 },
    { key: "full", label: "FULL CYCLE", hours: null },
  ];

export type TrendView = "environmental" | "hatch";
export type Metric = "temp" | "humidity";

// Chamber-identity series resolve from --chart-series-1..12 (theme.css chart
// exception zone): same attribute constraint as the target band above.
export const CHAMBER_COLORS = Array.from({ length: 12 }, (_, i) =>
  getComputedStyle(document.documentElement)
    .getPropertyValue(`--chart-series-${i + 1}`)
    .trim(),
);

export const metricInfo: Record<
  Metric,
  { label: string; unit: string; domain: [number, number] }
> = {
  temp: { label: "Temperature", unit: "°C", domain: [35, 40] },
  humidity: { label: "Humidity", unit: "%", domain: [40, 80] },
};

export const HATCH_ROWS = 10;

// Per-chamber context the tooltip needs to judge each reading.
export interface TooltipMeta {
  band: { min: number; max: number };
  metricLabel: string;
}
