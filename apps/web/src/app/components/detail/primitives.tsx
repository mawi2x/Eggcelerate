import type React from "react";
import { CheckIcon } from "../icons/CheckIcon";
import { InfoIcon } from "../icons/CircleInfoIcon";
import { ExclamationIcon } from "../icons/ExclamationIcon";
import { StatusIconBadge, statusIconBadgeGlyphSize } from "../StatusIconBadge";
import { Card, CardContent } from "../ui/card";
import { Typography } from "../ui/typography";
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
  titleSize = 16,
  divider = false,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  centered?: boolean;
  titleSize?: number;
  divider?: boolean;
}) {
  void titleSize;
  return (
    <Card
      style={{
        backgroundColor: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-subtle)",
      }}
    >
      <CardContent className="p-4 sm:p-5">
        <div
          className={`flex items-start justify-between gap-3 min-h-[32px] ${divider ? "mb-3 border-b pb-3" : "mb-4"}`}
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
              variant="headingSmall"
              style={{ color: "var(--text-primary)" }}
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
        border: `1px solid ${tone ? `${tone}40` : "var(--border-default)"}`,
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
        border: `1px solid var(--border-default)`,
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
        border: `1px solid ${toneMap.border}`,
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
            fontSize:
              size === "lg"
                ? "var(--type-heading-md)"
                : size === "sm"
                  ? "var(--type-body-sm)"
                  : "var(--type-heading-sm)",
            fontWeight: "var(--weight-bold)",
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
              fontSize:
                size === "lg"
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
