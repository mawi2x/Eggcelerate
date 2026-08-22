import React from "react";
import { Card, CardContent } from "../ui/card";
import { OK, MUTED, SURFACE, BORDER, TEXT } from "./types";

export function StatusPill({
  tone,
  children,
  dot = true,
  pulse = false,
}: {
  tone: typeof OK;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ backgroundColor: tone.bg, color: tone.fg, fontSize: 12, fontWeight: 700 }}
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
  return (
    <Card style={{ backgroundColor: "#FFFFFF", border: "1px solid #EAE7E1", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <CardContent className="p-5">
        <div
          className={`flex flex-wrap items-center gap-3 min-h-[32px] ${divider ? "mb-3 border-b pb-3" : "mb-4"}`}
          style={{
            ...(centered ? { justifyContent: "center", textAlign: "center" } : { justifyContent: "space-between" }),
            ...(divider ? { borderColor: "#EFE9DC" } : {}),
          }}
        >
          <div>
            <h3 style={{ fontSize: titleSize, fontWeight: 600, color: "#1A1A1A" }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 12, color: MUTED }}>{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function InnerTile({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: tone ? `${tone}0D` : SURFACE,
        border: `1px solid ${tone ? `${tone}40` : BORDER}`,
      }}
    >
      {children}
    </div>
  );
}

export function KeyValue({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
      <p style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: accent ?? TEXT }}>{value}</p>
    </div>
  );
}
