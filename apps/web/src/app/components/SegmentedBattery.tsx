import { ExclamationIcon } from "./icons";

const TRACK = "var(--track-battery)";

/**
 * Solid lightning bolt. Drawn as a filled path rather than a stroked icon so it
 * stays an unmistakable bolt at 12–14px instead of reading as a stray glyph.
 */
function Bolt({ color }: { color: string }) {
  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 10 14"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path d="M6.1 0L0 8.05h3.4L2.9 14 10 5.6H6.2L6.1 0z" fill={color} />
    </svg>
  );
}

// Filled-bar count by charge level — independent of the operational state.
function barCount(pct: number): number {
  if (pct >= 76) return 4;
  if (pct >= 51) return 3;
  if (pct >= 26) return 2;
  if (pct >= 1) return 1;
  return 0;
}

// Three operational states drive both the leading glyph and the colour.
const CHARGING = "var(--status-success-fg)";
const NEUTRAL = "var(--text-note)";
const LOW = "var(--status-danger-fg)";

/**
 * Charge level text followed by a four-bar graphic gauge, in one of three states:
 *   charging  — green bolt, emerald text and bars;
 *   normal    — neutral battery glyph, dark stone text and bars;
 *   low (<30%) — warning triangle, deep red text and bars.
 */
export function SegmentedBattery({
  battery,
  charging = false,
  showLabel = false,
}: {
  battery: number;
  charging?: boolean;
  showLabel?: boolean;
}) {
  const low = !charging && battery < 30;
  const color = charging ? CHARGING : low ? LOW : NEUTRAL;
  const bars = barCount(battery);
  const description = charging
    ? `Charging ${battery}%`
    : low
      ? `Low battery ${battery}%`
      : `Battery ${battery}%`;

  return (
    <span
      className="inline-flex shrink-0 items-center"
      style={{ gap: 6 }}
      title={description}
    >
      {/* Level text first… */}
      {showLabel && (
        <span
          className="inline-flex items-center whitespace-nowrap"
          style={{
            gap: 3,
            fontSize: "var(--type-caption)",
            fontWeight: "var(--weight-bold)",
            color,
          }}
        >
          {charging ? (
            <Bolt color={color} />
          ) : low ? (
            <ExclamationIcon size={12} color={color} />
          ) : null}
          {battery}%
        </span>
      )}
      {/* …then the bars, sitting on the far right edge. */}
      <span
        className="inline-flex items-end"
        style={{ gap: 2 }}
        role="img"
        aria-label={description}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: "var(--battery-bar-height)",
              borderRadius: "var(--radius-bar)",
              backgroundColor: i < bars ? color : TRACK,
            }}
          />
        ))}
      </span>
    </span>
  );
}
