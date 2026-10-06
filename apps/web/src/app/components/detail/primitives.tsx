import type React from "react";
import { CheckIcon } from "../icons/CheckIcon";
import { InfoIcon } from "../icons/CircleInfoIcon";
import { ExclamationIcon } from "../icons/ExclamationIcon";
import { StatusIconBadge, statusIconBadgeGlyphSize } from "../StatusIconBadge";
import { Card, CardContent } from "../ui/card";
import { Typography, type TypographyVariant } from "../ui/typography";
export function StatusPill({
  tone,
  children,
  dot = true,
  pulse = false,
}: {
  tone: { fg: string; bg: string; ring: string };
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{
        backgroundColor: tone.bg,
        color: tone.fg,
        fontSize: "var(--type-caption)",
        fontWeight: "var(--weight-bold)",
      }}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${pulse ? "animate-pulse" : ""}`}
          style={{ backgroundColor: tone.fg }}
        />
      )}
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  centered = false,
  titleSize,
  titleVariant = "headingSmall",
  divider = false,
  titleId,
  section = false,
  density = "default",
  bare = false,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  centered?: boolean;
  titleSize?: number;
  titleVariant?: TypographyVariant;
  divider?: boolean;
  /** Heading id used as the labelled-section name when `section` is true. */
  titleId?: string;
  /** Wraps the card in a labelled `<section>` for meaningful page sections. */
  section?: boolean;
  /** Compact trims body padding (dense cards like the timeline). */
  density?: "default" | "compact";
  /** Bare drops the card chrome (border, fill, shadow) for sheet/dialog hosts. */
  bare?: boolean;
}) {
  const card = (
    <Card
      style={{
        backgroundColor: bare ? "transparent" : "var(--surface-card)",
        border: bare
          ? "var(--border-width-hairline) solid transparent"
          : "var(--border-width-hairline) solid var(--border-subtle)",
        borderRadius: "var(--radius-card)",
        boxShadow: bare ? "none" : "var(--shadow-subtle)",
      }}
    >
      <CardContent className={density === "compact" ? "p-4" : "p-4 sm:p-5"}>
        <div
          className={`flex flex-wrap items-start justify-between gap-3 ${divider ? "mb-3 border-b pb-2 min-h-[var(--control-height-mobile)]" : "mb-4 h-[var(--control-height-mobile)]"}`}
          style={{
            ...(centered
              ? { justifyContent: "center", textAlign: "center" }
              : {}),
            ...(divider ? { borderColor: "var(--border-sand)" } : {}),
          }}
        >
          <div className="min-w-0 flex-1">
            <Typography
              as="h3"
              variant={titleVariant}
              id={titleId}
              style={{
                color: "var(--text-primary)",
                ...(titleSize === undefined ? {} : { fontSize: titleSize }),
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="caption"
                style={{ color: "var(--text-secondary)" }}
              >
                {subtitle}
              </Typography>
            )}
          </div>
          {action && <div className="shrink-0 pt-0.5">{action}</div>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
  return section && titleId ? (
    <section aria-labelledby={titleId}>{card}</section>
  ) : (
    card
  );
}

export function InnerTile({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: tone ? `${tone}0D` : "var(--surface-card)",
        border: `var(--border-width-hairline) solid ${tone ? `${tone}40` : "var(--border-default)"}`,
      }}
    >
      {children}
    </div>
  );
}

export function KeyValue({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        backgroundColor: "var(--surface-card)",
        border: `var(--border-width-hairline) solid var(--border-default)`,
      }}
    >
      <p
        style={{
          fontSize: "var(--type-caption)",
          color: "var(--text-secondary)",
          marginBottom: 4,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "var(--type-body)",
          fontWeight: "var(--weight-bold)",
          color: accent ?? "var(--text-primary)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

export function StatusCallout({
  tone,
  size = "default",
  icon,
  dense = false,
  hideIcon = false,
  title,
  description,
  action,
  className = "",
  role,
}: {
  tone: "success" | "danger" | "warning" | "info";
  size?: "sm" | "default" | "lg";
  icon?: React.ReactNode;
  hideIcon?: boolean;
  /** Compact 10/9 type for tight instances (keeps sm geometry). */
  dense?: boolean;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  role?: string;
}) {
  const badgeSize: "sm" | "md" | "lg" =
    size === "lg" ? "lg" : size === "sm" ? "sm" : "md";
  const iconSize = statusIconBadgeGlyphSize(badgeSize);
  const toneMap = {
    success: {
      bg: "var(--status-success-bg)",
      fg: "var(--status-success-fg)",
      border: `var(--status-success-fg)33`,
      defaultIcon: (
        <CheckIcon size={iconSize} color="var(--status-icon-badge-fg)" />
      ),
    },
    danger: {
      bg: "var(--status-danger-bg)",
      fg: "var(--status-danger-fg)",
      border: `var(--status-danger-fg)33`,
      defaultIcon: (
        <ExclamationIcon size={iconSize} color="var(--status-icon-badge-fg)" />
      ),
    },
    warning: {
      bg: "var(--status-warning-bg)",
      fg: "var(--status-warning-fg)",
      border: "color-mix(in srgb, var(--status-warning-fg) 20%, transparent)",
      defaultIcon: (
        <ExclamationIcon size={iconSize} color="var(--status-icon-badge-fg)" />
      ),
    },
    info: {
      bg: "var(--status-info-bg)",
      fg: "var(--status-info-fg)",
      border: "color-mix(in srgb, var(--status-info-fg) 20%, transparent)",
      defaultIcon: (
        <InfoIcon size={iconSize} color="var(--status-icon-badge-fg)" />
      ),
    },
  }[tone];

  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : "status")}
      className={`flex ${action ? "items-start" : "items-center"} ${
        size === "lg"
          ? "gap-4 rounded-2xl p-5"
          : size === "sm"
            ? "gap-2.5 rounded-xl px-3.5 py-2.5"
            : "gap-3 rounded-xl px-4 py-3"
      } ${className}`}
      style={{
        backgroundColor: toneMap.bg,
        border: `var(--border-width-hairline) solid ${toneMap.border}`,
      }}
    >
      {!hideIcon && (
        <StatusIconBadge
          size={badgeSize}
          backgroundColor={toneMap.fg}
          className={action ? "mt-0.5" : undefined}
          icon={icon ?? toneMap.defaultIcon}
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          style={{
            color: toneMap.fg,
            fontFamily: "var(--font-display)",
            fontSize: dense
              ? "var(--type-filter-label)"
              : size === "lg"
                ? "var(--type-heading-md)"
                : size === "sm"
                  ? "var(--type-body-sm)"
                  : "var(--type-heading-sm)",
            fontWeight: dense
              ? "var(--weight-extrabold)"
              : "var(--weight-bold)",
            lineHeight: "var(--leading-snug)",
          }}
        >
          {title}
        </p>
        {description && (
          <p
            className={size === "sm" ? "mt-0.5" : "mt-1"}
            style={{
              color: "var(--text-secondary)",
              fontFamily: "var(--font-body)",
              fontSize: dense
                ? "var(--type-label)"
                : size === "lg"
                  ? "var(--type-body-lg)"
                  : size === "sm"
                    ? "var(--type-caption)"
                    : "var(--type-body)",
              lineHeight: size === "sm" ? 1.35 : "var(--leading-relaxed)",
            }}
          >
            {description}
          </p>
        )}
        {action && (
          <div className={size === "sm" ? "mt-2" : "mt-3"}>{action}</div>
        )}
      </div>
    </div>
  );
}
