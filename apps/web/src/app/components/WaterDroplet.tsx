import { Droplet } from "lucide-react";

// Binary water sensor styled as a sibling to GaugeDial. The float switch only
// gives us sufficient/low, so the two arc halves communicate state rather than
// pretending to report an exact percentage.
const TRACK = "#ECE6D9";
const OK = "var(--status-success-fg)";
const ALERT = "var(--status-danger-fg)";
const TEXT = "var(--text-primary)";
const MUTED = "var(--text-secondary)";

interface WaterDropletProps {
  /** Binary float switch: true = closed (sufficient), false = open (low). */
  ok: boolean;
  size?: number;
}

export function WaterDroplet({ ok, size = 120 }: WaterDropletProps) {
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(9, Math.round(size * 0.08));
  const r = size / 2 - stroke / 2 - 4;
  const start = 225;
  const sweep = 270;
  const gap = 18;
  const segmentSweep = (sweep - gap) / 2;
  const leftEnd = start + segmentSweep;
  const rightStart = leftEnd + gap;

  const polar = (angleDeg: number) => {
    const angle = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };
  const arc = (startDeg: number, endDeg: number) => {
    const from = polar(startDeg);
    const to = polar(endDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${from.x} ${from.y} A ${r} ${r} 0 ${largeArc} 1 ${to.x} ${to.y}`;
  };
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Water status: ${ok ? "Sufficient" : "Low"}`}
        >
          {/* Two physically separated, fixed-size segments. The visible gap
              makes this a binary status mark instead of a partial percentage
              gauge. */}
          <path
            d={arc(start, leftEnd)}
            stroke={ok ? OK : ALERT}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={arc(rightStart, start + sweep)}
            stroke={ok ? OK : TRACK}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
        </svg>

        {/* A compact status lockup keeps the binary state readable without
            competing with the arc or adding another large shape. */}
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center"
          style={{ paddingTop: size * 0.255 }}
        >
          <Droplet
            aria-hidden="true"
            size={Math.round(size * 0.17)}
            strokeWidth={2.4}
            color={ok ? OK : ALERT}
            fill={ok ? "#DCFCE7" : "#FEE2E2"}
          />
          <span
            style={{
              color: TEXT,
              fontFamily: "var(--font-display)",
              fontSize: Math.round(size * 0.14),
              fontWeight: 700,
              lineHeight: 1.05,
              marginTop: 1,
            }}
          >
            {ok ? "Normal" : "Low"}
          </span>
          <span
            style={{
              color: MUTED,
              fontFamily: "var(--font-body)",
              fontSize: Math.max(9, Math.round(size * 0.07)),
              fontWeight: 600,
              lineHeight: 1.1,
              marginTop: 1,
            }}
          >
            Water status
          </span>
        </div>
      </div>
      <p
        className="mt-1 text-center"
        style={{ fontSize: 12, color: ok ? OK : ALERT }}
      >
        {ok ? "Status: Sufficient" : "Status: Refill Needed"}
      </p>
    </div>
  );
}
