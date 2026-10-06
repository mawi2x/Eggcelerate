import type { ReactNode } from "react";
import logoApp from "../../imports/logo-app.webp";

type EmptyStateSize = "compact" | "regular" | "page";

interface EmptyStateProps {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  illustration?: ReactNode;
  size?: EmptyStateSize;
  className?: string;
}

const sizeClasses: Record<EmptyStateSize, string> = {
  compact: "min-h-44 py-8",
  regular: "min-h-64 py-10",
  page: "min-h-[55dvh] py-14",
};

export function EmptyState({
  title,
  description,
  action,
  illustration,
  size = "regular",
  className = "",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={`flex w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border px-5 text-center shadow-sm ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: "var(--surface-card)",
        borderColor: "var(--border-subtle)",
        color: "var(--text-primary)",
      }}
    >
      {illustration ?? (
        <img
          src={logoApp}
          alt="Eggcelerate logo"
          width={size === "compact" ? 56 : 72}
          height={size === "compact" ? 56 : 72}
          className="shrink-0 object-contain"
        />
      )}
      <div className="max-w-2xl space-y-1">
        <h2
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-display)",
            fontSize: "var(--type-heading-sm)",
            fontWeight: "var(--weight-bold)",
            lineHeight: "var(--leading-snug)",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-body-sm)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          {description}
        </p>
      </div>
      {action && (
        <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  );
}
