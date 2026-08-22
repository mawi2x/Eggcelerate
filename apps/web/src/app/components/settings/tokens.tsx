// Shared visual language for the Settings master-detail panels.
export const RUST = "#C8623A";
export const SURFACE = "#FFFFFF";
export const BORDER = "#EAE7E1";
export const DIVIDER = "#F0EDE6";
export const MUTED = "#78716C";
export const TEXT = "#1A1A1A";
export const CRIT = "#DC2626";
export const CRIT_BG = "#FEE2E2";

export const inputClass =
  "h-auto w-full rounded-xl px-3.5 py-2.5 transition-colors focus-visible:border-[#C8623A] focus-visible:ring-2 focus-visible:ring-[#C8623A]/25";
export const inputStyle = { borderColor: "#DDD8CE", backgroundColor: "#FFFFFF", color: TEXT };
export const labelStyle = { color: "#57534E", fontSize: 13, fontWeight: 600 };

/** Uppercase micro-heading that opens a group of rows. */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: MUTED,
      }}
    >
      {children}
    </p>
  );
}

/** Panel title + supporting line, repeated at the top of every category. */
export function PanelHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="pb-5" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
      <h2 style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 22, fontWeight: 700, color: TEXT }}>
        {title}
      </h2>
      <p className="mt-1" style={{ color: MUTED, fontSize: 13 }}>
        {description}
      </p>
    </div>
  );
}

/**
 * One horizontal setting: label + optional help text on the left, control on the
 * right, with a hairline rule between consecutive rows.
 */
export function SettingRow({
  label,
  hint,
  control,
  htmlFor,
}: {
  label: string;
  hint?: string;
  control: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
      <label htmlFor={htmlFor} className="min-w-0 flex-1">
        <span className="block truncate" style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block" style={{ fontSize: 12, color: MUTED }}>
            {hint}
          </span>
        )}
      </label>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

/** Stacked form field for inputs and selects. */
export function Field({
  label,
  hint,
  htmlFor,
  labelSlot,
  children,
}: {
  label?: string;
  hint?: string;
  htmlFor?: string;
  labelSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      {labelSlot ?? (
        <label htmlFor={htmlFor} style={labelStyle}>
          {label}
        </label>
      )}
      <div className="mt-1.5">{children}</div>
      {hint && (
        <p className="mt-1.5" style={{ color: MUTED, fontSize: 12 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
