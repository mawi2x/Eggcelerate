import * as React from "react";
import logoApp from "../../../imports/logo-app.webp";
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] p-4 sm:p-6">
      <div className="w-full max-w-[440px] rounded-3xl border border-[var(--border-subtle)] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#F5E6CC] bg-[#FDF8EE]"> {/* illustration exception per color-guidelines.md:163 */}
            <img src={logoApp} alt="" className="h-8 w-8 object-cover" />
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-md)", fontWeight: "var(--weight-bold)", color: "var(--brand-primary)" }}>Eggcelerate</span>
        </div>
        {children}
      </div>
    </div>
  );
}
