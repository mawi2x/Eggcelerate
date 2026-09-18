import type { ComponentType, CSSProperties } from "react";
import { Card, CardContent } from "./ui/card";

export interface KpiPill {
  text: string;
  tone: "neutral" | "positive" | "negative" | "warning";
}

export interface KpiFooter {
  primary: string;
  secondary?: string;
  tertiary?: string;
}

/** Any glyph accepting the standard icon props (Lucide or custom SVG). */
export type KpiIcon = ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
}>;

interface Props {
  Icon: KpiIcon;
  label: string;
  value: string;
  accent?: string;
  pill?: KpiPill;
  footer?: KpiFooter;
  minHeight?: "compact" | "standard" | "none";
  /** Hides the glyph below sm (narrow multi-column rows like Trends KPIs). */
  hideIconOnMobile?: boolean;
  /** Moves the glyph to the row's end; text stays left (Overview executive cards). */
  iconRight?: boolean;
  /** 20x4 bar beside the value in its own color (Trends stat tiles). */
  accentBar?: string;
}

const cardStyle: CSSProperties = {
  backgroundColor: "var(--surface-card)",
  borderColor: "var(--border-default)",
  borderRadius: "var(--radius-card)",
  boxShadow: "var(--shadow-card)",
};

export function KpiCard({
  Icon,
  label,
  value,
  accent,
  pill,
  minHeight = "compact",
  footer,
  hideIconOnMobile = false,
  iconRight = false,
  accentBar,
}: Props) {
  const hasDetail = Boolean(pill || footer);
  const heightClass =
    minHeight === "none"
      ? ""
      : minHeight === "standard" || hasDetail
        ? "min-h-[6.3125rem] sm:min-h-[5.875rem] lg:min-h-[7.25rem]"
        : "min-h-[5.625rem]";

  return (
    <Card
      className={`relative ${heightClass}`}
      style={{
        ...cardStyle,
        height: "auto",
      }}
    >
      <CardContent className="flex flex-col px-3 py-2 sm:px-4 sm:py-2">
        <div
          className={
            iconRight
              ? "flex items-start gap-3 flex-row-reverse"
              : "flex items-start gap-3"
          }
        >
          <span
            aria-hidden="true"
            className={
              hideIconOnMobile
                ? "hidden h-11 w-11 shrink-0 items-center justify-center sm:flex"
                : "flex h-11 w-11 shrink-0 items-center justify-center"
            }
            style={{ color: "var(--brand-primary)" }}
          >
            <Icon size={26} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-bold)",
                letterSpacing: "var(--tracking-label)",
                lineHeight: "var(--leading-snug)",
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
            {accentBar ? (
              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-5 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: accentBar }}
                />
                <div
                  className="text-(length:--type-panel-title)"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: "var(--weight-extrabold)",
                    lineHeight: "var(--leading-tight)",
                    color: accent ?? "var(--text-primary)",
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}
                >
                  {value}
                </div>
              </div>
            ) : (
              <div
                className="mt-0.5 text-(length:--type-panel-title)"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: "var(--weight-extrabold)",
                  lineHeight: "var(--leading-tight)",
                  color: accent ?? "var(--text-primary)",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                }}
              >
                {value}
              </div>
            )}
          </div>
        </div>
        {footer && (
          <div className="mt-1 flex items-stretch gap-2 border-t border-[var(--border-subtle)] pt-2">
            <span
              aria-hidden="true"
              className="w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: "var(--brand-primary)" }}
            />
            <div className="min-w-0 flex-1">
              <div
                className="flex items-center gap-1 font-semibold"
                style={{
                  color: "var(--text-primary)",
                  fontSize: "var(--type-label)",
                }}
              >
                {footer.primary}
              </div>
              {footer.secondary && (
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "var(--type-label)",
                  }}
                >
                  {footer.secondary}
                </div>
              )}
              {footer.tertiary && (
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "var(--type-label)",
                  }}
                >
                  {footer.tertiary}
                </div>
              )}
            </div>
          </div>
        )}
        {pill && (
          <span
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-(length:--type-label) font-semibold"
            style={{
              backgroundColor:
                pill.tone === "neutral"
                  ? "var(--status-info-bg)"
                  : pill.tone === "positive"
                    ? "var(--status-success-bg)"
                    : pill.tone === "negative"
                      ? "var(--status-danger-bg)"
                      : "var(--status-warning-bg)",
              color:
                pill.tone === "neutral"
                  ? "var(--status-info-fg)"
                  : pill.tone === "positive"
                    ? "var(--status-success-fg)"
                    : pill.tone === "negative"
                      ? "var(--status-danger-fg)"
                      : "var(--status-warning-fg)",
              borderColor: "var(--border-default)",
            }}
          >
            {pill.tone === "positive" && "↗"} {pill.tone === "negative" && "↘"}{" "}
            {pill.text}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
