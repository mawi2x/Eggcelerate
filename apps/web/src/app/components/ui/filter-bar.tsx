export interface FilterBarOption { key: string; label: string; count?: number; }
interface FilterBarProps { options: FilterBarOption[]; value: string; onChange: (key: string) => void; ariaLabel?: string; }
export function FilterBar({ options, value, onChange, ariaLabel = "Filter" }: FilterBarProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            className="rounded-full px-3.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
            style={{
              backgroundColor: active ? "var(--brand-primary)" : "var(--surface-card)",
              color: active ? "var(--on-brand)" : "var(--text-muted)",
              border: `1px solid ${active ? "var(--brand-primary)" : "var(--border-default)"}`,
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-label)",
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-snug)",
              letterSpacing: "var(--tracking-label)",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {opt.label}
            {typeof opt.count === "number" && <span style={{ opacity: active ? 0.9 : 0.75 }}> ({opt.count})</span>}
          </button>
        );
      })}
    </div>
  );
}
