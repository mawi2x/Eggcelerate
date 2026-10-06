import { formatXTick } from "../../features/trends/chart-ticks";

import {
  BORDER,
  MUTED,
  type RangeKey,
  TEXT,
  type TooltipMeta,
} from "./presentation";

function formatTooltipTime(timestamp: number) {
  const date = new Date(timestamp);
  const day = date.toLocaleDateString([], { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} at ${time}`;
}

function formatMeasurement(value: number, unit: string) {
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: unit === "°C" ? 1 : 0,
  })}${unit}`;
}

export function ChartTooltip({
  active,
  payload,
  unit,
  meta,
  highlightedId,
  compact = false,
  range = "24h",
}: {
  active?: boolean;
  payload?: {
    value?: unknown;
    dataKey?: string | number;
    color?: string;
    name?: string;
    payload?: { ts?: unknown; [key: string]: unknown };
  }[];
  unit: string;
  meta?: Record<string, TooltipMeta>;
  highlightedId?: string | null;
  /** Mobile value pill: value + timestamp only, pinned near the touch point. */
  compact?: boolean;
  range?: RangeKey;
}) {
  if (!active || !payload?.length) return null;

  const validPayload = payload.filter(
    (item): item is typeof item & { value: number } =>
      typeof item.value === "number",
  );
  const reading =
    validPayload.find((item) => item.dataKey === highlightedId) ??
    validPayload[0];
  if (!reading) return null;

  const info: TooltipMeta | undefined =
    typeof reading.dataKey === "string" ? meta?.[reading.dataKey] : undefined;
  const timestamp = reading.payload?.ts;
  const extrema = reading.payload?.[`${reading.dataKey}_range`];
  const extremaText = Array.isArray(extrema)
    ? `${formatMeasurement(Number(extrema[0]), unit)} – ${formatMeasurement(Number(extrema[1]), unit)}`
    : null;

  // Mobile: minimal dark value pill pinned near the touch point (ref pattern).
  // Chamber name and target range already live in the card legend/subtitle.
  if (compact) {
    return (
      <div
        className="flex max-w-[280px] flex-wrap items-baseline gap-2 rounded-xl px-3 py-1.5 shadow-lg"
        style={{
          backgroundColor: "var(--surface-tooltip)",
          color: "var(--on-brand)",
          fontFamily: "var(--font-body)",
        }}
      >
        <span
          style={{
            fontSize: "var(--type-body)",
            fontWeight: "var(--weight-bold)",
            lineHeight: "var(--leading-snug)",
          }}
        >
          {formatMeasurement(reading.value, unit)}
        </span>
        {extremaText && (
          <span className="w-full text-xs">Min–max {extremaText}</span>
        )}
        {typeof timestamp === "number" && (
          <span
            style={{
              fontSize: "var(--type-label)",
              fontWeight: "var(--weight-semibold)",
              letterSpacing: "var(--tracking-label)",
              color: "var(--text-on-dark-muted)",
            }}
          >
            {formatXTick(timestamp, range)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="min-w-[196px] rounded-xl border bg-[var(--surface-card)] p-3.5 shadow-lg"
      style={{
        borderColor: BORDER,
        color: TEXT,
        fontFamily: "var(--font-body)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-0.5 w-4 shrink-0 rounded-full"
          style={{ backgroundColor: reading.color }}
        />
        <p
          style={{
            fontSize: "var(--type-body-sm)",
            fontWeight: "var(--weight-bold)",
          }}
        >
          {reading.name}
        </p>
      </div>
      {typeof timestamp === "number" && (
        <p
          className="mt-0.5"
          style={{ color: MUTED, fontSize: "var(--type-caption)" }}
        >
          {formatTooltipTime(timestamp)}
        </p>
      )}
      <div
        className="mt-3 space-y-1.5 border-t pt-2.5"
        style={{ borderColor: BORDER }}
      >
        <div className="flex items-baseline justify-between gap-5">
          <span style={{ color: MUTED, fontSize: "var(--type-caption)" }}>
            {info?.metricLabel ?? "Reading"}
          </span>
          <span
            style={{
              fontSize: "var(--type-body)",
              fontWeight: "var(--weight-bold)",
            }}
          >
            {formatMeasurement(reading.value, unit)}
          </span>
        </div>
        {extremaText && (
          <div className="flex items-baseline justify-between gap-5">
            <span className="text-xs text-[var(--text-muted)]">Min–max</span>
            <span className="text-xs font-semibold">{extremaText}</span>
          </div>
        )}
        {info && (
          <div className="flex items-baseline justify-between gap-5">
            <span style={{ color: MUTED, fontSize: "var(--type-caption)" }}>
              Target
            </span>
            <span
              style={{
                color: MUTED,
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-semibold)",
              }}
            >
              {info.band.min} to {info.band.max}
              {unit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
