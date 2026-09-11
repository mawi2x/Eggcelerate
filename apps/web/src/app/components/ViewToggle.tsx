import { LayoutGrid, List } from "lucide-react";

export type ViewMode = "grid" | "list";

interface Props {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

// Reusable grid/list segmented toggle, shared across screens for a consistent pattern.
// Compact 32px buttons in 4px group padding land the group on the shared 36px
// filter-row height (glyph stays 18px). Do not count the outer padding as part
// of either button's target.
export function ViewToggle({ view, onChange }: Props) {
  const options: { key: ViewMode; Icon: typeof LayoutGrid; label: string }[] = [
    { key: "grid", Icon: LayoutGrid, label: "Grid view" },
    { key: "list", Icon: List, label: "List view" },
  ];

  return (
    <div
      className="flex items-center gap-1 rounded-full p-0.5"
      style={{ backgroundColor: "var(--surface-muted)" }}
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
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 ${active ? "bg-[var(--surface-card)] text-[var(--brand-primary)]" : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--wash-white-60)] hover:text-[var(--brand-primary)]"}`}
            style={{
              boxShadow: active ? "var(--shadow-lift)" : "none",
            }}
          >
            <Icon size={18} strokeWidth={active ? 2.6 : 2} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
