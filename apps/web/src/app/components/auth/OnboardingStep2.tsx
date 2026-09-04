import { Egg, Feather, FlaskConical, Sparkles } from "lucide-react";
import { useState } from "react";
import type { PrimaryFocus } from "../../data/onboarding";
import { OnboardingStep2Schema } from "../../data/onboarding";
import { AuthCard } from "./AuthCard";
import { StepperBar } from "./StepperBar";

type FocusOption = {
  id: PrimaryFocus;
  label: string;
  icon: typeof Egg;
};

const FOCUS_OPTIONS: FocusOption[] = [
  { id: "commercial", label: "Commercial hatchery", icon: Egg },
  { id: "heritage", label: "Heritage breeding", icon: Feather },
  { id: "backyard", label: "Backyard flock", icon: Sparkles },
  { id: "research", label: "Research / education", icon: FlaskConical },
];

const SPECIES_OPTIONS = [
  "chicken",
  "duck",
  "quail",
  "turkey",
  "goose",
  "guinea_fowl",
] as const;
const SPECIES_LABELS: Record<(typeof SPECIES_OPTIONS)[number], string> = {
  chicken: "Chicken",
  duck: "Duck",
  quail: "Quail",
  turkey: "Turkey",
  goose: "Goose",
  guinea_fowl: "Guinea fowl",
};

export function OnboardingStep2({
  onContinue,
  onBack,
  onHaveAccount,
}: {
  onContinue: (data: { primaryFocus: PrimaryFocus; species: string[] }) => void;
  onBack: () => void;
  onHaveAccount: () => void;
}) {
  const [primaryFocus, setPrimaryFocus] = useState<PrimaryFocus>("commercial");
  const [species, setSpecies] = useState<string[]>(["chicken"]);
  const [error, setError] = useState<string | undefined>();

  const toggleSpecies = (s: string) => {
    setSpecies((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const submit = () => {
    const r = OnboardingStep2Schema.safeParse({ primaryFocus, species });
    if (!r.success) {
      setError(r.error.issues[0].message);
      return;
    }
    setError(undefined);
    onContinue({ primaryFocus, species });
  };

  return (
    <AuthCard>
      <StepperBar step={2} onHaveAccount={onHaveAccount} />
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--type-page-title)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-primary)",
          lineHeight: "var(--leading-snug)",
        }}
      >
        What are you hatching?
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--type-body)",
          color: "var(--text-secondary)",
        }}
      >
        We’ll tailor Mode presets to the species you incubate.
      </p>
      <div className="mt-4">
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
          Primary focus
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          {FOCUS_OPTIONS.map((opt) => {
            const selected = primaryFocus === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setPrimaryFocus(opt.id)}
                className="flex cursor-pointer items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left transition-all hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1"
                style={{
                  backgroundColor: selected ? "#FFF8F5" : "#FFFFFF",
                  borderColor: selected ? "var(--brand-primary)" : "#E8E2D5",
                  color: selected
                    ? "var(--brand-primary)"
                    : "var(--text-primary)",
                }}
              >
                <Icon size={18} className="shrink-0" />
                <span
                  className="truncate"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-body-sm)",
                    fontWeight: "var(--weight-semibold)",
                  }}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
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
          Species (pick any)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SPECIES_OPTIONS.map((s) => {
            const selected = species.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleSpecies(s)}
                className="cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
                style={{
                  backgroundColor: selected
                    ? "var(--brand-primary)"
                    : "var(--surface-card)",
                  color: selected ? "var(--on-brand)" : "var(--text-primary)",
                  borderColor: selected
                    ? "var(--brand-primary)"
                    : "var(--border-default)",
                }}
              >
                {selected ? "✓ " : ""}
                {SPECIES_LABELS[s]}
              </button>
            );
          })}
        </div>
        {error && (
          <p
            className="mt-2 text-xs"
            style={{ color: "var(--status-danger-fg)" }}
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onBack}
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
          onClick={submit}
          className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-xl bg-[var(--brand-primary)] font-semibold text-white hover:bg-[var(--brand-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
        >
          Continue →
        </button>
      </div>
    </AuthCard>
  );
}
