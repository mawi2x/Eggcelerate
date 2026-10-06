import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";

interface Props {
  incubators: number;
  running: number;
  idle: number;
  eggs: number;
  needsAttention: number;
  hatchesDue: number;
  offline: number;
  nextHatch: string;
  nextChamber?: string;
  alerts: number;
  criticalAlerts: number;
  onStartChecks: () => void;
}

const labelStyle: CSSProperties = {
  fontSize: "var(--type-label)",
  fontWeight: "var(--weight-bold)",
  letterSpacing: "var(--tracking-label)",
  lineHeight: "var(--leading-normal)",
  color: "var(--overview-summary-muted)",
};

export function OverviewSummary({
  incubators,
  running,
  idle,
  eggs,
  needsAttention,
  hatchesDue,
  offline,
  nextHatch,
  nextChamber,
  alerts,
  criticalAlerts,
  onStartChecks,
}: Props) {
  const stats = [
    {
      label: "INCUBATORS",
      value: String(incubators),
      detail: `${running} running and ${idle} idle`,
    },
    {
      label: "EGGS",
      value: String(eggs),
      detail: `Across ${incubators} ${incubators === 1 ? "chamber" : "chambers"}`,
    },
    {
      label: "NEXT HATCH",
      value: nextHatch,
      detail: nextChamber ?? "No active cycles",
    },
    {
      label: "ALERTS",
      value: String(alerts),
      detail: `${criticalAlerts} critical`,
    },
  ];
  return (
    <section
      aria-labelledby="overview-today-title"
      className="overflow-hidden"
      style={{
        borderRadius: "var(--radius-card)",
        backgroundColor: "var(--overview-summary-bg)",
        border: "1px solid var(--overview-summary-border)",
        color: "var(--overview-summary-fg)",
        fontFamily: "var(--font-body)",
      }}
    >
      <div className="flex flex-col items-start gap-3 p-5 min-[22.5rem]:flex-row min-[22.5rem]:flex-wrap min-[22.5rem]:items-center md:gap-6 md:p-6">
        <div className="min-w-0 min-[22.5rem]:min-w-[min(100%,10rem)] min-[22.5rem]:flex-1">
          <h2 id="overview-today-title" style={labelStyle}>
            TODAY
          </h2>
          <p
            className="mt-1 text-balance text-(length:--type-body-lg) md:text-(length:--type-heading-md)"
            style={{
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-normal)",
            }}
          >
            <span style={{ color: "var(--overview-summary-accent)" }}>
              {needsAttention}{" "}
              {needsAttention === 1 ? "chamber needs" : "chambers need"}{" "}
              {needsAttention > 0 ? "you now" : "attention"}
            </span>
            ,{" "}
            <span className="inline-block max-w-full">
              {hatchesDue} {hatchesDue === 1 ? "hatch is" : "hatches are"} due,
            </span>{" "}
            <span className="inline-block max-w-full">
              and {offline} {offline === 1 ? "is" : "are"} offline.
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onStartChecks}
          className="inline-flex h-[var(--control-height-mobile)] max-h-[var(--control-height-mobile)] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-0 bg-[var(--brand-primary)] text-[var(--on-brand)] text-(length:--type-button-label) transition-colors hover:bg-[var(--brand-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--overview-summary-fg)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--overview-summary-bg)] md:h-[var(--control-height-default)] md:max-h-[var(--control-height-default)]"
          style={{
            fontWeight: "var(--weight-extrabold)",
            lineHeight: "var(--leading-button)",
          }}
        >
          <span>Check</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <dl className="grid grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, detail }, index) => (
          <div
            key={label}
            className={`min-w-0 border-t px-5 py-4 md:px-6 ${index % 2 === 1 ? "border-l" : ""} ${index === 2 ? "lg:border-l" : ""}`}
            style={{ borderColor: "var(--overview-summary-divider)" }}
          >
            <dt style={labelStyle}>{label}</dt>
            <dd
              className="mt-1 break-words text-(length:--type-page-title)"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: "var(--weight-extrabold)",
                lineHeight: "var(--leading-tight)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </dd>
            <dd
              className="mt-1"
              style={{
                color: "var(--overview-summary-muted)",
                fontSize: "var(--type-caption)",
                lineHeight: "var(--leading-normal)",
                overflowWrap: "anywhere",
              }}
            >
              {detail}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
