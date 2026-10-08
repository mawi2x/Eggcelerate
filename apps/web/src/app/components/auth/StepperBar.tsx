export function StepperBar({
  step,
  onHaveAccount,
}: {
  step: 1 | 2;
  onHaveAccount: () => void;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-label)",
            fontWeight: "var(--weight-bold)",
            letterSpacing: "var(--tracking-label)",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          STEP {step} OF 2
        </span>
        <button
          type="button"
          onClick={onHaveAccount}
          className="flex min-h-11 items-center justify-center rounded px-1 text-sm font-semibold text-[var(--brand-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 md:min-h-8"
        >
          <span>I have an account</span>
        </button>
      </div>
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={2}
        aria-label={`Step ${step} of 2`}
      >
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{
              backgroundColor:
                i <= step ? "var(--brand-primary)" : "var(--surface-muted)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
