import { useState } from "react";
import { toast } from "sonner";
import { Package, Bell, Tractor, Zap } from "lucide-react";
import { Button } from "../ui/button";
import { Mode, Incubator } from "../../data/mockData";
import { Account } from "../../data/account";
import { ModeLibraryPanel } from "../settings/ModeLibraryPanel";
import { NotificationsPanel } from "../settings/NotificationsPanel";
import { FarmAccountPanel } from "../settings/FarmAccountPanel";
import { HardwarePanel } from "../settings/HardwarePanel";
import { RUST, SURFACE, BORDER, MUTED } from "../settings/tokens";

interface Props {
  modes: Mode[];
  onUpdateMode: (id: string, patch: Partial<Mode>) => void;
  onAddMode: (mode: Mode) => void;
  onDeleteMode: (id: string) => void;
  account: Account;
  onUpdateAccount: (patch: Partial<Account>) => void;
  units: Incubator[];
}

type CategoryId = "modes" | "notifications" | "account" | "hardware";

const categories: { id: CategoryId; label: string; Icon: typeof Package }[] = [
  { id: "modes", label: "MODE LIBRARY", Icon: Package },
  { id: "notifications", label: "NOTIFICATIONS", Icon: Bell },
  { id: "account", label: "FARM & ACCOUNT", Icon: Tractor },
  { id: "hardware", label: "HARDWARE & DEVICES", Icon: Zap },
];

export function SettingsScreen({
  modes,
  onUpdateMode,
  onAddMode,
  onDeleteMode,
  account,
  onUpdateAccount,
  units,
}: Props) {
  const [category, setCategory] = useState<CategoryId>("modes");

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* ── Left column — category menu ───────────────────────────────────── */}
      <nav
        className="shrink-0 rounded-2xl p-2 lg:sticky lg:top-6"
        style={{ width: "100%", maxWidth: 220, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}
        aria-label="Settings categories"
      >
        <ul className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {categories.map(({ id, label, Icon }) => {
            const isActive = category === id;
            return (
              <li key={id} className="min-w-0 shrink-0 lg:shrink lg:w-full">
                <button
                  onClick={() => setCategory(id)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 transition-colors hover:bg-[#FAF6EE]"
                  style={{
                    height: 40,
                    backgroundColor: isActive ? RUST : "transparent",
                    color: isActive ? "#FFFFFF" : "#78716C",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={17} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                  <span className="min-w-0 whitespace-nowrap" title={label}>
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Right column — selected category only ─────────────────────────── */}
      <section
        className="min-w-0 flex-1 rounded-2xl"
        style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}
      >
        <div className="p-6">
          {category === "modes" && (
            <ModeLibraryPanel
              modes={modes}
              onUpdateMode={onUpdateMode}
              onAddMode={onAddMode}
              onDeleteMode={onDeleteMode}
            />
          )}
          {category === "notifications" && <NotificationsPanel />}
          {category === "account" && <FarmAccountPanel account={account} onUpdateAccount={onUpdateAccount} />}
          {category === "hardware" && <HardwarePanel units={units} />}
        </div>

        {/* Inline save bar, anchored bottom-right of the detail panel. */}
        <div
          className="sticky bottom-0 flex items-center justify-between gap-4 rounded-b-2xl px-6 py-3.5"
          style={{
            backgroundColor: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(8px)",
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <span className="min-w-0 truncate" style={{ fontSize: 12, color: MUTED }}>
            Changes apply to every chamber unless overridden per-incubator.
          </span>
          <Button
            className="shrink-0 rounded-xl px-6"
            style={{ backgroundColor: RUST, color: "#fff", minHeight: 40 }}
            onClick={() => toast.success("Settings saved")}
          >
            Save Changes
          </Button>
        </div>
      </section>
    </div>
  );
}
