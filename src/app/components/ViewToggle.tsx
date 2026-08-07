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
    <div className="flex items-center gap-1 rounded-full p-1" style={{ backgroundColor: "#F5EDD8" }}>
      {options.map(({ key, Icon, label }) => {
        const active = view === key;
        return (
          <button
            key={key}
            aria-label={label}
            title={label}
            onClick={() => onChange(key)}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
            style={{
              backgroundColor: active ? "#FFFFFF" : "transparent",
              color: active ? "#AD3A1D" : "#8A6B52",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <Icon size={18} strokeWidth={active ? 2.6 : 2} />
          </button>
        );
      })}
    </div>
  );
}
