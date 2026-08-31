import * as React from "react";

export function FormInput({
  label,
  id,
  icon: Icon,
  trailing,
  error,
  ...props
}: {
  label: string;
  id: string;
  icon?: React.ComponentType<{ size?: number | string; className?: string; style?: React.CSSProperties }>;
  trailing?: React.ReactNode;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
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
            style={{ color: "#78716C" }}
          />
        )}
        <input
          id={id}
          {...props}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={!!error}
          className={`w-full rounded-xl border bg-[#FAF7F2] px-3.5 py-2.5 text-sm transition-colors focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1 ${
            Icon ? "pl-10" : ""
          } ${trailing ? "pr-10" : ""} ${
            error
              ? "border-[var(--status-danger-fg)]"
              : "border-[#E8E2D5] hover:border-[#D8D0C0]"
          }`}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-body)",
            color: "var(--text-primary)",
          }}
        />
        {trailing && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
            {trailing}
          </div>
        )}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="text-xs"
          style={{ color: "var(--status-danger-fg)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
