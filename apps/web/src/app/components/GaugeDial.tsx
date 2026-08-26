import { Range } from "../data/mockData";

interface GaugeDialProps {
  value: number;
  min: number;
  max: number;
  safe: Range;
  unit: string;
  label: string;
  size?: number;
  /** Decimal places on the centre value. Water reads as a whole number. */
  decimals?: number;
  /** Overrides the numeric "Safe range: x–y" caption, e.g. "Optimal". */
  safeLabel?: string;
  /** Extra content under the caption — sub-label, action button, etc. */
  footer?: React.ReactNode;
  /** Binary sensors: force the arc to a fixed color ("ok"=green, "crit"=red). */
  accent?: "ok" | "crit";
  /** Binary sensors: replaces the centre number with text (e.g. "Normal"). */
  centerLabel?: string;
  /** Text color for centerLabel (green/red for binary sensors). */
  centerColor?: string;
}

// Shared semantic status colors used throughout the dashboard.
const TRACK = "#ECE6D9";
const SAFE = "var(--status-success-fg)";
const WARN = "var(--status-warning-fg)";
const CRITICAL = "var(--status-danger-fg)";
const TEXT = "var(--text-primary)";
const MUTED = "var(--text-secondary)";

// Open-bottom circular gauge (270° sweep) with a shaded safe band.
export function GaugeDial({
  value,
  min,
  max,
  safe,
  unit,
  label,
  size = 176,
  decimals = 1,
  safeLabel,
  footer,
  accent,
  centerLabel,
  centerColor,
}: GaugeDialProps) {
  const cx = size / 2;
  const cy = size / 2;
  // Everything scales off `size` so the dial stays legible at 120px.
  const stroke = Math.max(9, Math.round(size * 0.08));
  const r = size / 2 - stroke / 2 - 4;
  const valueFont = Math.round(size * 0.19);
  const unitFont = Math.round(size * 0.088);
  const labelFont = Math.max(10, Math.round(size * 0.072));

  const START = 225; // bottom-left
  const SWEEP = 270; // clockwise, open bottom

  // 0deg = top, angle increases clockwise.
  const polar = (angleDeg: number) => {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const arc = (startDeg: number, endDeg: number) => {
    const s = polar(startDeg);
    const e = polar(endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };
  const valueToAngle = (v: number) => {
    const clamped = Math.min(max, Math.max(min, v));
    const t = (clamped - min) / (max - min);
    return START + t * SWEEP;
  };

  const inSafe = value >= safe.min && value <= safe.max;
  const arcColor =
    accent === "ok" ? SAFE :
    accent === "crit" ? CRITICAL :
    inSafe ? SAFE : value > safe.max ? CRITICAL : WARN;
  // Low binary state keeps a short visible red stub instead of an empty arc.
  const arcValue = accent === "crit" ? min + (max - min) * 0.22 : value;
  const valAngle = valueToAngle(arcValue);
  const knob = polar(valAngle);

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={centerLabel ? `${label}: ${centerLabel}` : `${label} ${value}${unit}`}
      >
        {/* Track */}
        <path d={arc(START, START + SWEEP)} stroke={TRACK} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        {/* Safe band (binary sensors have no safe range) */}
        {!accent && (
          <path
            d={arc(valueToAngle(safe.min), valueToAngle(safe.max))}
            stroke={SAFE}
            strokeOpacity={0.28}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
        )}
        {/* Value arc */}
        <path d={arc(START, valAngle)} stroke={arcColor} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        {/* Knob */}
        <circle cx={knob.x} cy={knob.y} r={stroke * 0.57} fill="#FFFFFF" stroke={arcColor} strokeWidth={stroke * 0.29} />
        {/* Center value */}
        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontSize={centerLabel ? Math.round(valueFont * 0.72) : valueFont}
          fontWeight={700}
          fill={centerColor ?? TEXT}
        >
          {centerLabel ?? value.toFixed(decimals)}
          {!centerLabel && (
            <tspan fontSize={unitFont} dx={1}>
              {unit}
            </tspan>
          )}
        </text>
        <text
          x={cx}
          y={cy + Math.round(size * 0.14)}
          textAnchor="middle"
          fontFamily="var(--font-body)"
          fontSize={labelFont}
          fontWeight={600}
          fill={MUTED}
        >
          {label}
        </text>
      </svg>
      <p className="mt-1 text-center" style={{ color: MUTED, fontSize: 12 }}>
        {safeLabel ?? (
          <>
            Safe range: {safe.min} to {safe.max}
            {unit === "%" ? "% RH" : unit}
          </>
        )}
      </p>
      {footer}
    </div>
  );
}
