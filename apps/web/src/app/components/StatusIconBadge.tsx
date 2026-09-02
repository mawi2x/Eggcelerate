import type { ReactNode } from "react";

export type StatusIconBadgeSize = "sm" | "md" | "lg" | "banner";
export type StatusIconBadgeTone = "success" | "warning" | "danger" | "info" | "brand";

const toneBackgrounds: Record<StatusIconBadgeTone, string> = {
  success: "var(--status-success-fg)",
  warning: "var(--status-warning-fg)",
  danger: "var(--status-danger-fg)",
  info: "var(--status-info-fg)",
  brand: "var(--brand-primary)",
};

const sizeTokens: Record<StatusIconBadgeSize, { circle: string; glyph: string }> = {
  sm: {
    circle: "var(--status-icon-badge-size-sm)",
    glyph: "var(--status-icon-badge-glyph-sm)",
  },
  md: {
    circle: "var(--status-icon-badge-size-md)",
    glyph: "var(--status-icon-badge-glyph-md)",
  },
  lg: {
    circle: "var(--status-icon-badge-size-lg)",
    glyph: "var(--status-icon-badge-glyph-lg)",
  },
  banner: {
    circle: "var(--status-icon-badge-size-banner)",
    glyph: "var(--status-icon-badge-glyph-banner)",
  },
};

export function StatusIconBadge({
  icon,
  tone = "brand",
  backgroundColor,
  size = "md",
  decorative = true,
  className = "",
}: {
  icon: ReactNode;
  tone?: StatusIconBadgeTone;
  backgroundColor?: string;
  size?: StatusIconBadgeSize;
  decorative?: boolean;
  className?: string;
}) {
  const dimensions = sizeTokens[size];

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: dimensions.circle,
        height: dimensions.circle,
        backgroundColor: backgroundColor ?? toneBackgrounds[tone],
        color: "var(--status-icon-badge-fg)",
      }}
      aria-hidden={decorative ? true : undefined}
    >
      {icon}
    </span>
  );
}

export function statusIconBadgeGlyphSize(size: StatusIconBadgeSize): string {
  return sizeTokens[size].glyph;
}
