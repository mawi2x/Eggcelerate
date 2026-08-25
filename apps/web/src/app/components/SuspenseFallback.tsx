export function SuspenseFallback({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-12 animate-pulse"
      style={{ color: "var(--text-muted)" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-6 w-48 rounded bg-[var(--surface-muted)] mb-4" />
      <div className="h-40 rounded-2xl bg-[var(--surface-muted)]" />
      <p className="mt-3 text-sm">{label}</p>
    </div>
  );
}
