import * as React from "react";
import { cn } from "./utils";

// NOTE (mobile typography): no `labelCompact`/`labelMicro` variants on
// purpose. The only approved 10px/9px uses (timeline milestones,
// gauge/water-status sub-labels) need responsive `md:` overrides, which an
// inline-style primitive cannot express — they consume
// `--type-label-compact`/`--type-label-micro` directly with breakpoint
// classes. Adding variants here would invite general-purpose micro text.
// Contract: 9px is last-resort for short redundant high-contrast labels
// with a visible/accessible full-text path (`title` alone is not enough);
// body/controls/prose/actions never go below 11px. See
// docs/refine/mobile-typography-and-component-sizing-plan.md.
export type TypographyVariant =
  | "pageTitle"
  | "panelTitle"
  | "headingLarge"
  | "headingMedium"
  | "headingSmall"
  | "metric"
  | "body"
  | "bodySmall"
  | "caption"
  | "label";

const typographyStyles = {
  pageTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--type-page-title)",
    fontWeight: "var(--weight-bold)",
    lineHeight: "var(--leading-snug)",
  },
  panelTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--type-panel-title)",
    fontWeight: "var(--weight-bold)",
    lineHeight: "var(--leading-snug)",
  },
  headingLarge: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--type-heading-lg)",
    fontWeight: "var(--weight-bold)",
    lineHeight: "var(--leading-snug)",
  },
  headingMedium: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--type-heading-md)",
    fontWeight: "var(--weight-bold)",
    lineHeight: "var(--leading-snug)",
  },
  headingSmall: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--type-heading-sm)",
    fontWeight: "var(--weight-semibold)",
    lineHeight: "var(--leading-snug)",
  },
  metric: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--type-panel-title)",
    fontWeight: "var(--weight-extrabold)",
    lineHeight: "var(--leading-tight)",
  },
  body: {
    fontFamily: "var(--font-body)",
    fontSize: "var(--type-body)",
    fontWeight: "var(--weight-regular)",
    lineHeight: "var(--leading-normal)",
  },
  bodySmall: {
    fontFamily: "var(--font-body)",
    fontSize: "var(--type-body-sm)",
    fontWeight: "var(--weight-regular)",
    lineHeight: "var(--leading-normal)",
  },
  caption: {
    fontFamily: "var(--font-body)",
    fontSize: "var(--type-caption)",
    fontWeight: "var(--weight-regular)",
    lineHeight: "var(--leading-normal)",
  },
  label: {
    fontFamily: "var(--font-body)",
    fontSize: "var(--type-label)",
    fontWeight: "var(--weight-bold)",
    lineHeight: "var(--leading-snug)",
    letterSpacing: "var(--tracking-label)",
    textTransform: "uppercase",
  },
} satisfies Record<TypographyVariant, React.CSSProperties>;

type TypographyProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  variant?: TypographyVariant;
};

export function Typography({
  as: Component = "p",
  variant = "body",
  className,
  style,
  ...props
}: TypographyProps) {
  return React.createElement(Component, {
    ...props,
    "data-slot": "typography",
    "data-variant": variant,
    className: cn(className),
    style: { ...typographyStyles[variant], ...style },
  });
}
