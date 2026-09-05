import { Label } from "./ui/label";

const MUTED = "var(--text-secondary)";
const CRIT = "var(--status-danger-fg)";

/**
 * Field label with a live character counter on the right, e.g. "11 / 20".
 * The counter turns red once the value reaches the cap so the limit is visible
 * rather than silently swallowing keystrokes.
 */
export function FieldCounterLabel({
  htmlFor,
  label,
  value,
  max,
  labelStyle,
}: {
  htmlFor: string;
  label: string;
  value: string;
  max: number;
  labelStyle?: React.CSSProperties;
}) {
  const atLimit = value.length >= max;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <Label htmlFor={htmlFor} style={labelStyle}>
        {label}
      </Label>
      <span
        aria-live="polite"
        style={{
          color: atLimit ? CRIT : MUTED,
          fontSize: "var(--type-caption)",
          fontWeight: "var(--weight-semibold)",
          whiteSpace: "nowrap",
        }}
      >
        {value.length} / {max}
      </span>
    </div>
  );
}
