import { Droplets, Thermometer } from "lucide-react";
import { useState } from "react";
import { OnboardingStep3Schema } from "../../data/onboarding";
import type { Mode } from "../../domain/types";
import { IncubatingIcon } from "../icons";
import { AuthCard } from "./AuthCard";
import { FormInput } from "./FormInput";
import { StepperBar } from "./StepperBar";

export function OnboardingStep3({
  onEnter,
  onBack,
  onHaveAccount,
  modes,
}: {
  onEnter: (data: {
    chamberName: string;
    startingModeId: string;
  }) => Promise<boolean>;
  onBack: () => void;
  onHaveAccount: () => void;
  modes: Mode[];
}) {
  const [chamberName, setChamberName] = useState("Incubator One");
  const [startingModeId] = useState("broiler");
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mode =
    modes.find((candidate) => candidate.id === startingModeId) ?? modes[0];

  const submit = async () => {
    const r = OnboardingStep3Schema.safeParse({ chamberName, startingModeId });
    if (!r.success) {
      setError(r.error.issues[0].message);
      return;
    }
    setError(undefined);
    setIsSubmitting(true);
    await onEnter({ chamberName, startingModeId });
    setIsSubmitting(false);
  };

  return (
    <AuthCard>
      <StepperBar step={3} onHaveAccount={onHaveAccount} />
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--type-page-title)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-primary)",
          lineHeight: "var(--leading-snug)",
        }}
      >
        Name your first chamber.
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--type-body)",
          color: "var(--text-secondary)",
        }}
      >
        You can add more incubators any time from the dashboard.
      </p>

      <div className="mt-4">
        <FormInput
          label="Chamber name"
          id="chamber-name"
          icon={IncubatingIcon}
          value={chamberName}
          onChange={(e) => setChamberName(e.target.value)}
          placeholder="Incubator One"
          error={error}
        />
      </div>

      <div className="mt-5">
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-label)",
            fontWeight: "var(--weight-bold)",
            letterSpacing: "var(--tracking-label)",
            textTransform: "uppercase",
            color: "var(--text-primary)",
          }}
        >
          Recommended starting Mode
        </p>
        <div className="mt-2 rounded-2xl border border-[#F5E6CC] bg-[#FFFDF9] p-4">
          {" "}
          {/* illustration exception per color-guidelines.md:163 */}
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FCE4D6] text-[#AD3A1D]">
              <IncubatingIcon size={18} />
            </span>
            <div className="flex flex-col text-left">
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-body)",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--text-primary)",
                }}
              >
                Chicken · Standard
              </span>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-caption)",
                  color: "var(--text-muted)",
                }}
              >
                {mode.targetTemp.min}°C · {mode.targetHumidity.min}% RH ·{" "}
                {mode.incubationDays}-day cycle
              </span>
            </div>
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-xl border border-[var(--border-subtle)] bg-white p-3 text-left">
              <div
                className="flex items-center gap-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                <Thermometer size={14} className="text-[#AD3A1D]" />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-label)",
                    letterSpacing: "var(--tracking-label)",
                    textTransform: "uppercase",
                    fontWeight: "var(--weight-bold)",
                  }}
                >
                  Target temp
                </span>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-body)",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--text-primary)",
                }}
              >
                {mode.targetTemp.min}°C
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-[var(--border-subtle)] bg-white p-3 text-left">
              <div
                className="flex items-center gap-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                <Droplets size={14} className="text-[#0284C7]" />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-label)",
                    letterSpacing: "var(--tracking-label)",
                    textTransform: "uppercase",
                    fontWeight: "var(--weight-bold)",
                  }}
                >
                  Humidity
                </span>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-body)",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--text-primary)",
                }}
              >
                {mode.targetHumidity.min}% RH
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border bg-white font-semibold transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-xl bg-[var(--brand-primary)] font-semibold text-white hover:bg-[var(--brand-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
        >
          {isSubmitting ? "Preparing dashboard…" : "Enter dashboard ✓"}
        </button>
      </div>
    </AuthCard>
  );
}
