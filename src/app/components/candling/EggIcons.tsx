// Domain-specific candling icons: an egg silhouette whose interior communicates
// the candling result (vascular network / hollow / unresolved).

const EGG_PATH = "M12 2.5C8.6 2.5 5.2 8.2 5.2 13.4a6.8 6.8 0 0 0 13.6 0C18.8 8.2 15.4 2.5 12 2.5Z";

interface IconProps {
  size?: number;
  color?: string;
}

function EggFrame({ size = 15, color = "currentColor", children }: IconProps & { children?: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path d={EGG_PATH} stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      {children}
    </svg>
  );
}

/** Fertile — egg with a branching vascular network (spider veining). */
export function EggFertileIcon({ size, color }: IconProps) {
  return (
    <EggFrame size={size} color={color}>
      <g stroke={color} strokeWidth={1.25} strokeLinecap="round">
        <path d="M12 8.4v7" />
        <path d="M12 10.6 9.7 8.9M12 10.6l2.3-1.7" />
        <path d="M12 13.2 9.3 11.9M12 13.2l2.7-1.3" />
      </g>
      <circle cx={12} cy={7.2} r={1.15} fill={color} />
    </EggFrame>
  );
}

/** Clear / infertile — hollow eggshell, nothing inside. */
export function EggClearIcon({ size, color }: IconProps) {
  return (
    <EggFrame size={size} color={color}>
      {/* Faint shell highlight so it reads as an empty shell, not a missing icon. */}
      <path d="M8.6 12.4c0-2.6 1-5 2.3-6.6" stroke={color} strokeWidth={1.1} strokeLinecap="round" opacity={0.5} />
    </EggFrame>
  );
}

/** Uncertain — egg containing a question mark. */
export function EggUncertainIcon({ size, color }: IconProps) {
  return (
    <EggFrame size={size} color={color}>
      <path
        d="M10.4 10.6a1.7 1.7 0 1 1 2.6 1.5c-.6.4-1 .8-1 1.6"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <circle cx={12} cy={16.2} r={0.85} fill={color} />
    </EggFrame>
  );
}

// ─── Fertility pill ───────────────────────────────────────────────────────────

export type Fertility = "fertile" | "clear" | "uncertain";

// Each pairing is >= 4.5:1 against its own pill and against the cream card.
export const fertilityTones: Record<Fertility, { bg: string; text: string; icon: string; label: string }> = {
  fertile:   { bg: "#DCFCE7", text: "#166534", icon: "#16A34A", label: "Fertile" },
  clear:     { bg: "#F2EEE5", text: "#334155", icon: "#475569", label: "Clear" },
  uncertain: { bg: "#FEF3C7", text: "#92400E", icon: "#D97706", label: "Uncertain" },
};

const icons: Record<Fertility, (p: IconProps) => React.ReactElement> = {
  fertile: EggFertileIcon,
  clear: EggClearIcon,
  uncertain: EggUncertainIcon,
};

export function FertilityIcon({ kind, size, color }: { kind: Fertility } & IconProps) {
  const Icon = icons[kind];
  return <Icon size={size} color={color ?? fertilityTones[kind].icon} />;
}

/** Pill chip, e.g. "23 Fertile (95.8%)". */
export function FertilityPill({ kind, value, suffix }: { kind: Fertility; value: number; suffix?: string }) {
  const tone = fertilityTones[kind];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1"
      style={{ backgroundColor: tone.bg, color: tone.text, fontSize: 12, fontWeight: 700 }}
    >
      <FertilityIcon kind={kind} size={14} />
      {value} {tone.label}
      {suffix ? <span style={{ fontWeight: 600 }}>({suffix})</span> : null}
    </span>
  );
}

/** Horizontal distribution bar showing the fertile/clear/uncertain split. */
export function TrayFertilityBar({ fertile, clear, uncertain }: { fertile: number; clear: number; uncertain: number }) {
  const total = fertile + clear + uncertain;
  if (total === 0) return null;
  const segments: { kind: Fertility; value: number }[] = [
    { kind: "fertile", value: fertile },
    { kind: "uncertain", value: uncertain },
    { kind: "clear", value: clear },
  ];
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: "#EFE9DC" }}
      role="img"
      aria-label={`Tray fertility: ${fertile} fertile, ${uncertain} uncertain, ${clear} clear of ${total} eggs`}
    >
      {segments.map((s) =>
        s.value > 0 ? (
          <span
            key={s.kind}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: fertilityTones[s.kind].icon }}
          />
        ) : null,
      )}
    </div>
  );
}
