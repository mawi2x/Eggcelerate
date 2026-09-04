import { LayoutGrid, List } from "lucide-react";

export type ViewMode = "grid" | "list";

interface Props {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

// Reusable grid/list segmented toggle, shared across screens for a consistent pattern.
export function ViewToggle({ view, onChange }: Props) {
  const options: { key: ViewMode; Icon: typeof LayoutGrid; label: string }[] = [
    { key: "grid", Icon: LayoutGrid, label: "Grid view" },
    { key: "list", Icon: List, label: "List view" },
  ];

  return (
    <div
      className="flex items-center gap-1 rounded-full p-1"
      style={{ backgroundColor: "#F5EDD8" }}
    >
      {options.map(({ key, Icon, label }) => {
        const active = view === key;
        return (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => onChange(key)}
            className={`flex h-[var(--control-size-icon)] w-[var(--control-size-icon)] cursor-pointer items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 ${active ? "bg-[var(--surface-card)] text-[var(--brand-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "bg-transparent text-[var(--text-secondary)] hover:bg-white/60 hover:text-[var(--brand-primary)]"}`}
            style={{
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <Icon size={18} strokeWidth={active ? 2.6 : 2} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
