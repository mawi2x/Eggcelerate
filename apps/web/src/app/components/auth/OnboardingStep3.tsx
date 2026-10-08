import { useState } from "react";
import { KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { CHAMBER_NAME_MAX } from "../../data/account";
import { OnboardingStep3Schema } from "../../data/onboarding";
import type { Mode } from "../../domain/types";
import { IncubatorDeviceIcon } from "../icons";
import { AuthCard } from "./AuthCard";
import { FormInput } from "./FormInput";
import { StepperBar } from "./StepperBar";

export function OnboardingStep3({
  onEnter,
  onBack,
  onHaveAccount,
}: {
  onEnter: (data: {
    chamberName: string;
    deviceId: string;
    startingModeId: string;
  }) => Promise<boolean>;
  onBack: () => void;
  onHaveAccount: () => void;
  modes: Mode[];
}) {
  const [chamberName, setChamberName] = useState("Incubator One");
  const [deviceId, setDeviceId] = useState("");
  const [startingModeId] = useState("broiler");
  const [errors, setErrors] = useState<{ chamberName?: string; deviceId?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const submit = async () => {
    if (isSubmitting) return;
    setConnectError(null);
    const r = OnboardingStep3Schema.safeParse({ chamberName, deviceId, startingModeId });
    if (!r.success) {
      const fields = r.error.flatten().fieldErrors;
      setErrors({ chamberName: fields.chamberName?.[0], deviceId: fields.deviceId?.[0] });
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      // Mock connection attempt; no physical device discovery is performed.
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (!/^EGG-\d{4}$/.test(r.data.deviceId)) {
        setConnectError(
          `Could not find an incubator with chamber code '${deviceId.trim()}'. Please check the display screen on your incubator and try again.`,
        );
        return;
      }
      if (!(await onEnter(r.data))) {
        setConnectError("Could not connect this chamber. Check that its code is not already assigned, then try again.");
      }
    } catch {
      setConnectError("Could not complete the connection. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
        Connect your first chamber.
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

      <div className="mt-4 flex flex-col gap-4">
        {connectError && (
          <div
            className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
            style={{
              backgroundColor: "var(--status-danger-bg)",
              border: "var(--border-width-hairline) solid var(--border-blush)",
            }}
            role="alert"
          >
            <TriangleAlert size={16} className="mt-0.5 shrink-0" color="var(--status-danger-fg)" />
            <div>
              <p style={{ fontSize: "var(--type-body-sm)", fontWeight: "var(--weight-bold)", color: "var(--status-danger-fg)" }}>
                Connection Failed
              </p>
              <p id="chamber-connection-error" className="mt-0.5" style={{ fontSize: "var(--type-caption)", color: "var(--status-danger-fg)", lineHeight: "var(--leading-normal)" }}>
                {connectError}
              </p>
            </div>
          </div>
        )}
        <FormInput
          label="Chamber code"
          id="chamber-code"
          icon={KeyRound}
          value={deviceId}
          onChange={(e) => {
            setDeviceId(e.target.value);
            setConnectError(null);
            setErrors((prev) => ({ ...prev, deviceId: undefined }));
          }}
          placeholder="EGG-1015"
          maxLength={20}
          autoCapitalize="characters"
          spellCheck={false}
          disabled={isSubmitting}
          error={errors.deviceId}
          aria-invalid={!!connectError}
          aria-describedby={connectError ? "chamber-connection-error" : undefined}
        />
        <FormInput
          label="Chamber name"
          id="chamber-name"
          icon={IncubatorDeviceIcon}
          value={chamberName}
          onChange={(e) => {
            setChamberName(e.target.value);
            setErrors((prev) => ({ ...prev, chamberName: undefined }));
          }}
          maxLength={CHAMBER_NAME_MAX}
          characterCount={chamberName.length}
          disabled={isSubmitting}
          placeholder="Incubator One"
          error={errors.chamberName}
        />
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border bg-[var(--surface-card)] font-semibold transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          <span>Back</span>
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-xl bg-[var(--brand-primary)] font-semibold text-[var(--on-brand)] hover:bg-[var(--brand-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>Connecting…</span>
            </>
          ) : connectError ? (
            <span>Retry Connection</span>
          ) : (
            <>
              <span className="md:hidden">Enter</span>
              <span className="hidden md:inline">Enter dashboard</span>
            </>
          )}
        </button>
      </div>
    </AuthCard>
  );
}
