// Shared visual language for the Settings master-detail panels.
import { Typography } from "../ui/typography";

export const RUST = "var(--brand-primary)";
export const SURFACE = "var(--surface-card)";
export const BORDER = "var(--border-subtle)";
export const DIVIDER = "var(--border-divider)";
export const MUTED = "var(--text-muted)";
export const TEXT = "var(--text-primary)";
export const CRIT = "var(--status-danger-fg)";
export const CRIT_BG = "var(--status-danger-bg)";

export const inputClass =
  "h-auto w-full rounded-xl px-3.5 py-2.5 transition-colors focus-visible:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/25";
export const inputStyle = {
  borderColor: "var(--input-border)",
  backgroundColor: SURFACE,
  color: TEXT,
};
export const labelStyle = {
  color: "var(--status-info-fg)",
  fontSize: "var(--type-body-sm)",
  fontWeight: "var(--weight-semibold)",
};

/** Uppercase micro-heading that opens a group of rows. */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="label" style={{ color: MUTED }}>
      {children}
    </Typography>
  );
}

/** Panel title + supporting line, repeated at the top of every category. */
export function PanelHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="pb-5"
      style={{ borderBottom: `var(--border-width-hairline) solid ${DIVIDER}` }}
    >
      <Typography as="h2" variant="panelTitle" style={{ color: TEXT }}>
        {title}
      </Typography>
      <Typography variant="bodySmall" className="mt-1" style={{ color: MUTED }}>
        {description}
      </Typography>
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
    <div
      className="flex flex-col gap-3 py-3.5 md:flex-row md:items-center md:justify-between md:gap-6"
      style={{ borderBottom: `var(--border-width-hairline) solid ${DIVIDER}` }}
    >
      <label htmlFor={htmlFor} className="min-w-0 flex-1">
        <span
          className="block break-words"
          style={{
            fontSize: "var(--type-body)",
            fontWeight: "var(--weight-semibold)",
            color: TEXT,
          }}
        >
          {label}
        </span>
        {hint && (
          <span
            className="mt-0.5 block break-words"
            style={{
              fontSize: "var(--type-caption)",
              color: MUTED,
              overflowWrap: "anywhere",
            }}
          >
            {hint}
          </span>
        )}
      </label>
      <div className="shrink-0 self-end md:self-auto">{control}</div>
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
        <p
          className="mt-1.5"
          style={{ color: MUTED, fontSize: "var(--type-caption)" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
