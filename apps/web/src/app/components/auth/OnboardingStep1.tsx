import { Feather, MapPin, User } from "lucide-react";
import { useState } from "react";
import { OnboardingStep1Schema } from "../../data/onboarding";
import { AuthCard } from "./AuthCard";
import { FormInput } from "./FormInput";
import { StepperBar } from "./StepperBar";

export function OnboardingStep1({
  onContinue,
  onHaveAccount,
}: {
  onContinue: (data: {
    name: string;
    farmName: string;
    location: string;
  }) => void;
  onHaveAccount: () => void;
}) {
  const [name, setName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [location, setLocation] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    farmName?: string;
    location?: string;
  }>({});

  const submit = () => {
    const r = OnboardingStep1Schema.safeParse({ name, farmName, location });
    if (!r.success) {
      const next: typeof errors = {};
      for (const issue of r.error.issues) {
        const key = issue.path[0] as keyof typeof errors;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onContinue({ name, farmName, location });
  };

  return (
    <AuthCard>
      <StepperBar step={1} onHaveAccount={onHaveAccount} />
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--type-page-title)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-primary)",
          lineHeight: "var(--leading-snug)",
        }}
      >
        Let’s set up your farm.
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--type-body)",
          color: "var(--text-secondary)",
        }}
      >
        A few details so your dashboard feels like home.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <FormInput
          label="Your name"
          id="onboard-name"
          icon={User}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Marisol Vega"
          error={errors.name}
        />
        <FormInput
          label="Farm name"
          id="onboard-farm"
          icon={Feather}
          value={farmName}
          onChange={(e) => setFarmName(e.target.value)}
          placeholder="Brightwood Poultry Co."
          error={errors.farmName}
        />
        <FormInput
          label="Location"
          id="onboard-location"
          icon={MapPin}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Willamette Valley, OR"
          error={errors.location}
        />
      </div>
      <button
        type="button"
        onClick={submit}
        className="mt-6 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] font-semibold text-[var(--on-brand)] hover:bg-[var(--brand-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
      >
        Continue →
      </button>
    </AuthCard>
  );
}
