import { useState } from "react";
import { Egg } from "lucide-react";
import { AuthCard } from "./AuthCard";
import { StepperBar } from "./StepperBar";
import { FormInput } from "./FormInput";
import { OnboardingStep3Schema } from "../../data/onboarding";
import { initialModes } from "../../data/mockData";

export function OnboardingStep3({
  onEnter,
  onBack,
  onHaveAccount,
}: {
  onEnter: (data: { chamberName: string; startingModeId: string }) => void;
  onBack: () => void;
  onHaveAccount: () => void;
}) {
  const [chamberName, setChamberName] = useState("Incubator One");
  const [startingModeId] = useState("broiler");
  const [error, setError] = useState<string | undefined>();

  const mode = initialModes.find((m) => m.id === startingModeId) ?? initialModes[0];

  const submit = () => {
    const r = OnboardingStep3Schema.safeParse({ chamberName, startingModeId });
    if (!r.success) {
      setError(r.error.issues[0].message);
      return;
    }
    setError(undefined);
    onEnter({ chamberName, startingModeId });
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
          icon={Egg}
          value={chamberName}
          onChange={(e) => setChamberName(e.target.value)}
          placeholder="Incubator One"
          error={error}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-[#F5E6CC] bg-[#FFFDF9] p-4"> {/* illustration exception per color-guidelines.md:163 */}
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FCE4D6] text-[#AD3A1D]">
            <Egg size={16} />
          </span>
          <div className="flex flex-col">
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
              {mode.targetTemp.min}°C · {mode.targetHumidity.min}% RH · {mode.incubationDays}-day cycle
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-3">
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--type-label)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: "var(--weight-bold)" }}>
              Target temp
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--type-body)", fontWeight: "var(--weight-bold)", color: "var(--text-primary)" }}>
              37.5°C
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-3">
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--type-label)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: "var(--weight-bold)" }}>
              Humidity
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--type-body)", fontWeight: "var(--weight-bold)", color: "var(--text-primary)" }}>
              55% RH
            </p>
          </div>
        </div>
        <p
          className="mt-3"
          style={{ fontFamily: "var(--font-body)", fontSize: "var(--type-caption)", color: "var(--text-muted)" }}
        >
          37.5°C · 55% RH · 21-day
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-12 flex-1 items-center justify-center rounded-xl border bg-white font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
          style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={submit}
          className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[var(--brand-primary)] font-semibold text-white hover:bg-[var(--brand-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
        >
          Enter dashboard ✓
        </button>
      </div>
    </AuthCard>
  );
}
