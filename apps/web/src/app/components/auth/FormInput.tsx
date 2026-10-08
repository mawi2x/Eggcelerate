import type * as React from "react";

export function FormInput({
  label,
  id,
  icon: Icon,
  trailing,
  error,
  characterCount,
  ...props
}: {
  label: string;
  id: string;
  icon?: React.ComponentType<{
    size?: number | string;
    className?: string;
    style?: React.CSSProperties;
  }>;
  trailing?: React.ReactNode;
  error?: string;
  characterCount?: number;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const invalid = !!error || props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label
        htmlFor={id}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--type-label)",
          fontWeight: "var(--weight-bold)",
          letterSpacing: "var(--tracking-label)",
          textTransform: "uppercase",
          color: "var(--text-primary)",
        }}
      >
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
        )}
        <input
          id={id}
          {...props}
          aria-describedby={
            [
              props["aria-describedby"],
              error ? `${id}-error` : undefined,
              characterCount !== undefined ? `${id}-count` : undefined,
            ].filter(Boolean).join(" ") || undefined
          }
          aria-invalid={invalid}
          className={`w-full rounded-xl border bg-[var(--surface-input)] px-3.5 py-2.5 transition-colors focus-visible:bg-[var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1 ${
            Icon ? "pl-10" : ""
          } ${trailing ? "pr-14" : ""} ${
            invalid
              ? "border-[var(--status-danger-fg)]"
              : "border-[var(--border-default)] hover:border-[var(--input-border)]"
          }`}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-control-value)",
            color: "var(--text-primary)",
          }}
        />
        {trailing && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
            {trailing}
          </div>
        )}
      </div>
      {(error || characterCount !== undefined) && (
        <div className="flex items-start justify-between gap-2">
          {error && (
            <p
              id={`${id}-error`}
              className="min-w-0"
              style={{
                fontSize: "var(--type-caption)",
                color: "var(--status-danger-fg)",
              }}
            >
              {error}
            </p>
          )}
          {characterCount !== undefined && (
            <p
              id={`${id}-count`}
              className="ml-auto shrink-0 text-right"
              style={{
                fontSize: "var(--type-caption)",
                color: "var(--text-muted)",
              }}
            >
              {characterCount}/{props.maxLength}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
