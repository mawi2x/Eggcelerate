import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Package, Bell, Tractor, Zap } from "lucide-react";
import { Button } from "../ui/button";
import type { Incubator, Mode } from "../../domain/types";
import type { SettingsPreferences } from "../../data/settings";
import { ModeLibraryPanel } from "../settings/ModeLibraryPanel";
import { NotificationsPanel, validateNotificationPreferences } from "../settings/NotificationsPanel";
import { FarmAccountPanel } from "../settings/FarmAccountPanel";
import { HardwarePanel } from "../settings/HardwarePanel";
import { RUST, SURFACE, BORDER, MUTED } from "../settings/tokens";

interface Props {
  modes: Mode[];
  onUpdateMode: (id: string, patch: Partial<Mode>) => Promise<boolean>;
  onAddMode: (mode: Mode) => Promise<boolean>;
  onDeleteMode: (id: string) => Promise<boolean>;
  settings: SettingsPreferences;
  onSaveSettings: (settings: SettingsPreferences) => Promise<boolean>;
  isSaving: boolean;
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
  settings,
  onSaveSettings,
  isSaving,
  units,
}: Props) {
  const [category, setCategory] = useState<CategoryId>("modes");
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);

  const save = async () => {
    const notificationError = validateNotificationPreferences(draft.notifications);
    if (!draft.account.farmName.trim() || !draft.account.accountHolder.trim()) {
      toast.error("Farm name and account holder are required.");
      setCategory("account");
      return;
    }
    if (notificationError) {
      toast.error(notificationError);
      setCategory("notifications");
      return;
    }
    if (!await onSaveSettings(draft)) return;
    toast.success("Settings saved");
  };

  const discard = () => {
    setDraft(settings);
    toast("Unsaved changes discarded");
  };

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <nav
        className="w-full max-w-none shrink-0 rounded-2xl p-2 lg:sticky lg:top-6 lg:max-w-[220px]"
        style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}
        aria-label="Settings categories"
      >
        <ul className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {categories.map(({ id, label, Icon }) => {
            const isActive = category === id;
            return (
              <li key={id} className="min-w-0 shrink-0 lg:shrink lg:w-full">
                <button
                  type="button"
                  onClick={() => setCategory(id)}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 ${isActive ? "border-[var(--brand-primary-soft)] bg-[var(--local-nav-selected-bg)] text-[var(--local-nav-selected-fg)]" : "border-transparent bg-transparent text-[var(--text-muted)] hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--brand-primary)]"}`}
                  style={{ height: 40, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em" }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={17} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 whitespace-nowrap" title={label}>{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="min-w-0 flex-1 rounded-2xl" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
        <div className="p-6">
          {category === "modes" && (
            <ModeLibraryPanel modes={modes} onUpdateMode={onUpdateMode} onAddMode={onAddMode} onDeleteMode={onDeleteMode} />
          )}
          {category === "notifications" && (
            <NotificationsPanel
              value={draft.notifications}
              onChange={(notifications) => setDraft((current) => ({ ...current, notifications }))}
            />
          )}
          {category === "account" && (
            <FarmAccountPanel
              account={draft.account}
              onUpdateAccount={(patch) => setDraft((current) => ({
                ...current,
                account: { ...current.account, ...patch },
              }))}
              temperatureUnit={draft.temperatureUnit}
              timeZone={draft.timeZone}
              onTemperatureUnitChange={(temperatureUnit) => setDraft((current) => ({ ...current, temperatureUnit }))}
              onTimeZoneChange={(timeZone) => setDraft((current) => ({ ...current, timeZone }))}
            />
          )}
          {category === "hardware" && <HardwarePanel units={units} />}
        </div>

        <div
          className="sticky bottom-[var(--mobile-bottom-nav-clearance)] z-30 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl px-6 py-3.5 md:bottom-0"
          style={{ backgroundColor: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", borderTop: `1px solid ${BORDER}` }}
        >
          <span className="min-w-0 text-xs" style={{ color: MUTED }} role="status" aria-live="polite" aria-atomic="true">
            {isDirty ? "You have unsaved settings changes." : "All settings changes are saved."}
            {category === "modes" ? " Mode library actions save individually." : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl" disabled={!isDirty || isSaving} onClick={discard}>
              Discard
            </Button>
            <Button
              className="rounded-xl px-6"
              style={{ backgroundColor: RUST, color: "#fff", minHeight: 40 }}
              disabled={!isDirty || isSaving}
              aria-busy={isSaving}
              onClick={() => void save()}
            >
              {isSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
