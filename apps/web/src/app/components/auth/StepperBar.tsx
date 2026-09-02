export function StepperBar({ step, onHaveAccount }: { step: 1|2|3; onHaveAccount: () => void }) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--type-label)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-muted)" }}>STEP {step} OF 3</span>
        <button type="button" onClick={onHaveAccount} className="cursor-pointer text-sm font-semibold text-[var(--brand-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1">I have an account</button>
      </div>
      <div className="flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3} aria-label={`Step ${step} of 3`}>
        {[1,2,3].map((i) => <div key={i} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: i <= step ? "var(--brand-primary)" : "var(--surface-muted)" }} />)}
      </div>
    </div>
  );
}
