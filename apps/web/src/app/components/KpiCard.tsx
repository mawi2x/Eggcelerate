import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
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

interface Props {
  Icon: LucideIcon;
  label: string;
  value: string;
  accent?: string;
  pill?: KpiPill;
  footer?: KpiFooter;
  minHeight?: "compact" | "standard";
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
  footer,
  minHeight = "compact",
}: Props) {
  const hasDetail = Boolean(pill || footer);
  const heightClass =
    minHeight === "standard" || hasDetail
      ? "min-h-[6.3125rem] sm:min-h-[5.875rem] lg:min-h-[7.25rem]"
      : "min-h-[5.625rem]";

  return (
    <Card
      className={`relative overflow-hidden ${heightClass}`}
      style={{
        ...cardStyle,
        height: "auto",
      }}
    >
      <Icon
        aria-hidden
        className="pointer-events-none absolute -bottom-3 -right-3"
        style={{
          width: 80,
          height: 80,
          color: "var(--brand-primary)",
          opacity: 0.12,
          transform: "rotate(-12deg)",
        }}
        strokeWidth={1.5}
      />
      <CardContent className="relative flex flex-col p-3 sm:p-4">
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
        <div
          className="mt-1 text-(length:--type-heading-sm) lg:text-(length:--type-panel-title)"
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
        {footer && (
          <div className="mt-2">
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
        )}
      </CardContent>
    </Card>
  );
}
