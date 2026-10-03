import { Bell, Package, Tractor, Zap } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { SettingsPreferences } from "../../data/settings";
import type { Incubator, Mode } from "../../domain/types";
import { FarmAccountPanel } from "../settings/FarmAccountPanel";
import {
  HardwarePanel,
  type HardwarePanelView,
} from "../settings/HardwarePanel";
import { ModeLibraryPanel } from "../settings/ModeLibraryPanel";
import {
  type NotificationPanelView,
  NotificationsPanel,
  validateNotificationPreferences,
} from "../settings/NotificationsPanel";
import { BORDER, MUTED, RUST, SURFACE } from "../settings/tokens";
import { Button } from "../ui/button";
import { FilterBar } from "../ui/filter-bar";

interface Props {
  modes: Mode[];
  onUpdateMode: (id: string, patch: Partial<Mode>) => Promise<boolean>;
  onAddMode: (mode: Mode) => Promise<boolean>;
  onDeleteMode: (id: string) => Promise<boolean>;
  settings: SettingsPreferences;
  onSaveSettings: (settings: SettingsPreferences) => Promise<boolean>;
  isSaving: boolean;
  units: Incubator[];
  /** Shell page header rendered inside the sticky toolbar (settings route). */
  header?: ReactNode;
}

type CategoryId = "modes" | "notifications" | "account" | "hardware";

const categories: {
  id: CategoryId;
  label: string;
  mobileLabel: string;
  Icon: typeof Package;
}[] = [
  { id: "modes", label: "MODE LIBRARY", mobileLabel: "Modes", Icon: Package },
  {
    id: "notifications",
    label: "NOTIFICATIONS",
    mobileLabel: "Alerts",
    Icon: Bell,
  },
  {
    id: "account",
    label: "FARM & ACCOUNT",
    mobileLabel: "Account",
    Icon: Tractor,
  },
  {
    id: "hardware",
    label: "HARDWARE & DEVICES",
    mobileLabel: "Hardware",
    Icon: Zap,
  },
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
  header,
}: Props) {
  const [category, setCategory] = useState<CategoryId>("modes");
  const [notificationView, setNotificationView] =
    useState<NotificationPanelView>("delivery");
  const [hardwareView, setHardwareView] =
    useState<HardwarePanelView>("devices");
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings],
  );

  const save = async () => {
    const notificationError = validateNotificationPreferences(
      draft.notifications,
    );
    if (!draft.account.farmName.trim() || !draft.account.accountHolder.trim()) {
      toast.error("Farm name and account holder are required.");
      setCategory("account");
      return;
    }
    if (notificationError) {
      toast.error(notificationError);
      setCategory("notifications");
      setNotificationView("delivery");
      return;
    }
    if (!(await onSaveSettings(draft))) return;
    toast.success("Settings saved");
  };

  const discard = () => {
    setDraft(settings);
    toast("Unsaved changes discarded");
  };

  return (
    <div className="flex flex-col">
      <nav
        aria-label="Settings categories"
        className="sticky top-0 z-30 pb-2 md:pb-6"
        style={{
          backgroundColor: "var(--surface-app)",
          paddingTop: 8,
        }}
      >
        <div className="mb-3">{header}</div>
        <FilterBar
          ariaLabel="Settings categories"
          variant="segmented"
          fitToScreenOnMobile
          value={category}
          onChange={(key) => setCategory(key as CategoryId)}
          options={categories.map(({ id, label, mobileLabel }) => ({
            key: id,
            label,
            mobileLabel,
          }))}
        />
      </nav>

      <div
        className="min-w-0 flex-1 rounded-2xl"
        style={{
          backgroundColor: SURFACE,
          border: `var(--border-width-hairline) solid ${BORDER}`,
        }}
      >
        <div className="p-4 md:p-6">
          {category === "modes" && (
            <section aria-labelledby="settings-panel-modes">
              <ModeLibraryPanel
                modes={modes}
                onUpdateMode={onUpdateMode}
                onAddMode={onAddMode}
                onDeleteMode={onDeleteMode}
              />
            </section>
          )}
          {category === "notifications" && (
            <section aria-labelledby="settings-panel-notifications">
              <NotificationsPanel
                value={draft.notifications}
                onChange={(notifications) =>
                  setDraft((current) => ({ ...current, notifications }))
                }
                view={notificationView}
                onViewChange={setNotificationView}
              />
            </section>
          )}
          {category === "account" && (
            <section aria-labelledby="settings-panel-account">
              <FarmAccountPanel
                account={draft.account}
                onUpdateAccount={(patch) =>
                  setDraft((current) => ({
                    ...current,
                    account: { ...current.account, ...patch },
                  }))
                }
                temperatureUnit={draft.temperatureUnit}
                timeZone={draft.timeZone}
                onTemperatureUnitChange={(temperatureUnit) =>
                  setDraft((current) => ({ ...current, temperatureUnit }))
                }
                onTimeZoneChange={(timeZone) =>
                  setDraft((current) => ({ ...current, timeZone }))
                }
              />
            </section>
          )}
          {category === "hardware" && (
            <section aria-labelledby="settings-panel-hardware">
              <HardwarePanel
                units={units}
                view={hardwareView}
                onViewChange={setHardwareView}
              />
            </section>
          )}
        </div>

        {(category !== "modes" || isDirty) && (
          <div
            className={`sticky bottom-[var(--mobile-bottom-nav-clearance)] z-30 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl pl-4 pr-16 py-2.5 transition-all duration-200 md:bottom-0 md:px-6 md:py-3.5 ${
              !isDirty
                ? "max-md:hidden"
                : "border-t-[var(--brand-primary-soft)] shadow-md"
            }`}
            style={{
              backgroundColor: isDirty
                ? "var(--surface-card)"
                : "var(--scrim-card)",
              backdropFilter: "blur(8px)",
              borderTop: `var(--border-width-hairline) solid ${isDirty ? "var(--brand-primary-soft)" : BORDER}`,
            }}
          >
            <span
              className="min-w-0"
              style={{ color: MUTED, fontSize: "var(--type-body-sm)" }}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {isDirty
                ? "You have unsaved settings changes."
                : "All settings changes are saved."}
              {category === "modes"
                ? " Mode library actions save individually."
                : ""}
            </span>
            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 max-[19rem]:w-full">
              <Button
                variant="outline"
                className="h-[var(--control-height-mobile)] md:h-[var(--control-height-toolbar)] rounded-xl max-[19rem]:w-full max-[19rem]:whitespace-normal"
                disabled={!isDirty || isSaving}
                onClick={discard}
              >
                Discard
              </Button>
              <Button
                className="h-[var(--control-height-mobile)] md:h-[var(--control-height-toolbar)] rounded-xl px-4 md:px-6 max-[19rem]:w-full max-[19rem]:whitespace-normal"
                style={{
                  backgroundColor: RUST,
                  color: "var(--on-brand)",
                }}
                disabled={!isDirty || isSaving}
                aria-busy={isSaving}
                onClick={() => void save()}
              >
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
