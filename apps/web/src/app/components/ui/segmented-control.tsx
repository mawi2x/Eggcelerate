import type * as React from "react";

import { cn } from "./utils";

export type SegmentedControlSize = "compact" | "default" | "toolbar";

const itemSizeClasses: Record<SegmentedControlSize, string> = {
  compact:
    "h-[var(--control-height-default)] px-3 md:h-[var(--control-height-compact)]",
  default: "h-[var(--control-segment-height)] px-4",
  toolbar: "h-[var(--control-height-toolbar)] px-4",
};

export function SegmentedControl({
  className,
  children,
  flush = false,
  role = "group",
  style,
  ...props
}: React.ComponentProps<"div"> & { flush?: boolean }) {
  return (
    <div
      role={role}
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--border-subtle)]",
        flush ? "h-[var(--control-segment-height)] gap-0 p-0" : "gap-1 p-1",
        className,
      )}
      style={{ backgroundColor: "var(--surface-muted)", ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export function SegmentedControlItem({
  active = false,
  className,
  children,
  flush = false,
  size = "default",
  style,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & {
  active?: boolean;
  flush?: boolean;
  size?: SegmentedControlSize;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        flush ? "h-full min-h-0 py-0 gap-1.5" : itemSizeClasses[size],
        className,
      )}
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "var(--type-body-sm)",
        fontWeight: "var(--weight-semibold)",
        lineHeight: "var(--leading-normal)",
        backgroundColor: active ? "var(--surface-card)" : "transparent",
        color: active ? "var(--brand-primary)" : "var(--text-secondary)",
        boxShadow: active ? "var(--shadow-lift)" : "none",
        ...style,
      }}
      data-state={active ? "on" : "off"}
      {...props}
    >
      {children}
    </button>
  );
}
