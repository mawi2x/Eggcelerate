import type * as React from "react";
import logoApp from "../../../imports/logo-app.webp";
export function AuthCard({
  children,
  compactHeader = false,
}: {
  children: React.ReactNode;
  compactHeader?: boolean;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--surface-page)] p-4 sm:p-6">
      <div className="w-full max-w-[var(--auth-card-width)] rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm sm:p-8">
        <div className={`flex flex-col items-center gap-2 ${compactHeader ? "mb-2" : "mb-6"}`}>
          <img
            src={logoApp}
            alt="Eggcelerate logo"
            className="h-14 w-14 object-contain transition-transform hover:scale-105"
          />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--type-heading-md)",
              fontWeight: "var(--weight-bold)",
              color: "var(--brand-primary)",
            }}
          >
            Eggcelerate
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
