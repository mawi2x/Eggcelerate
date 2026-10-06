import type { CSSProperties, ReactNode } from "react";
import { cn } from "./ui/utils";

interface ChamberCardShellProps {
  children: ReactNode;
  labelledBy?: string;
  highlighted?: boolean;
  className?: string;
}

interface ChamberCardHeaderProps {
  title: ReactNode;
  titleId?: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  subtitleTrailing?: ReactNode;
  titleClassName?: string;
  subtitleStyle?: CSSProperties;
  className?: string;
}

interface ChamberCardFooterProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function ChamberCardShell({
  children,
  labelledBy,
  highlighted = false,
  className,
}: ChamberCardShellProps) {
  return (
    <article
      aria-labelledby={labelledBy}
      className={cn(
        "group relative flex h-full min-w-0 min-h-[var(--mobile-chamber-card-min-height)] flex-col overflow-hidden rounded-2xl border transition-all duration-200 md:min-h-0 lg:min-h-[300px]",
        highlighted
          ? "border-[var(--nav-hover-border)] bg-[var(--nav-hover-bg)] shadow-md"
          : "border-[var(--border-default)] bg-[var(--surface-subtle)] shadow-[var(--shadow-card)] hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)]",
        className,
      )}
      style={{ borderRadius: "var(--radius-card)" }}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col p-5">{children}</div>
    </article>
  );
}

export function ChamberCardHeader({
  title,
  titleId,
  subtitle,
  trailing,
  subtitleTrailing,
  titleClassName,
  subtitleStyle,
  className,
}: ChamberCardHeaderProps) {
  return (
    <header className={cn("mb-4 min-w-0", className)}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            id={titleId}
            className={cn("max-w-full break-words", titleClassName)}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--type-heading-sm)",
              fontWeight: "var(--weight-semibold)",
              lineHeight: "var(--leading-snug)",
              color: "var(--text-primary)",
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </h3>
          {subtitle !== undefined && (
            <div
              className={cn(
                "mt-0.5 min-w-0",
                subtitleTrailing && "flex items-center justify-between gap-2",
              )}
            >
              <p
                className={cn(
                  "max-w-full break-words",
                  subtitleTrailing && "min-w-0 flex-1",
                )}
                style={{
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-body-sm)",
                  fontWeight: "var(--weight-regular)",
                  lineHeight: "var(--leading-normal)",
                  overflowWrap: "anywhere",
                  ...subtitleStyle,
                }}
              >
                {subtitle}
              </p>
              {subtitleTrailing}
            </div>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    </header>
  );
}

export function ChamberCardFooter({
  children,
  style,
  className,
}: ChamberCardFooterProps) {
  return (
    <footer
      className={cn(
        "mt-4 flex items-center justify-between gap-2 rounded-full p-1.5",
        className,
      )}
      style={{
        backgroundColor: "var(--surface-track)",
        border: "var(--border-width-hairline) solid var(--border-default)",
        ...style,
      }}
    >
      {children}
    </footer>
  );
}
