import { Egg as EggIcon } from "@phosphor-icons/react";
import { IconClipboardText } from "@tabler/icons-react";
import {
  Activity,
  CalendarDays,
  Droplets,
  RefreshCw,
  Settings2,
  Thermometer,
} from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CURRENT_TRAY_CAPACITY, computeCandling } from "../../domain/candling";
import {
  getKnownFertileEggs,
  validateHarvestCounts,
} from "../../domain/fertility";
import type { Incubator, Mode } from "../../domain/types";
import {
  type IncubatorUpdateIntent,
  useCycleHistoryActions,
  useTurnCommandStatus,
} from "../../features/farm/use-farm-data";
import { useIncubatorReadings } from "../../features/farm/use-incubator-readings";
import { CandlingJournalTab } from "../detail/CandlingJournalTab";
import { DeviceSettingsTab } from "../detail/DeviceSettingsTab";
import { LiveMonitorTab } from "../detail/LiveMonitorTab";
import { SectionCard, StatusCallout } from "../detail/primitives";
import type { DetailTab } from "../detail/types";
import { HarvestModal } from "../HarvestModal";
import { statusIconBadgeGlyphSize } from "../StatusIconBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { FilterBar } from "../ui/filter-bar";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const DETAIL_BANNER_TITLE_STYLE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-body-sm)",
  fontWeight: "var(--weight-extrabold)",
  lineHeight: "var(--leading-snug)",
};

const DETAIL_BANNER_DESCRIPTION_STYLE: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-filter-label)",
  lineHeight: 1.45,
  marginTop: 2,
};

function SubTabNav({
  active,
  onChange,
}: {
  active: DetailTab;
  onChange: (t: DetailTab) => void;
}) {
  return (
    <div className="flex max-w-full justify-start overflow-x-auto overflow-y-hidden pb-1">
      <FilterBar
        ariaLabel="Incubator detail sections"
        variant="segmented"
        fitToScreenOnMobile
        value={active}
        onChange={(key) => onChange(key as DetailTab)}
        options={[
          {
            key: "monitor",
            label: "Live Monitor",
            mobileLabel: "Monitor",
            icon: <Activity size={15} aria-hidden="true" />,
          },
          {
            key: "candling",
            label: "Candling & Inspection",
            mobileLabel: "Candling",
            icon: <IconClipboardText size={15} aria-hidden="true" />,
          },
          {
            key: "settings",
            label: "Device Settings",
            mobileLabel: "Settings",
            icon: <Settings2 size={15} aria-hidden="true" />,
          },
        ]}
        className="md:w-max md:shrink-0"
      />
    </div>
  );
}

export function DetailScreen({
  unit,
  modes,
  initialTab = "monitor",
  onUpdate,
  onRequestTurn,
  isUpdating,
  isRequestingTurn,
  onOpenTrends,
  onTabChange,
}: {
  unit: Incubator;
  modes: Mode[];
  initialTab?: DetailTab;
  onUpdate: (intent: IncubatorUpdateIntent) => Promise<boolean>;
  onRequestTurn: () => Promise<boolean>;
  isUpdating: boolean;
  isRequestingTurn: boolean;
  onOpenTrends: () => void;
  onTabChange?: (tab: DetailTab) => void;
}) {
  const { completeCycle, stopCycle: archiveStoppedCycle } =
    useCycleHistoryActions();
  const turnCommand = useTurnCommandStatus(unit.id);
  const readingsQuery = useIncubatorReadings(unit.id, "full");
  const readings = readingsQuery.readings;
  const mode = modes.find((m) => m.id === unit.modeId) ?? modes[0];
  const totalDays = mode.incubationDays;
  const currentDay = unit.dayOfIncubation;
  const totalEggsSet =
    unit.totalEggsLoaded && unit.totalEggsLoaded > 0
      ? unit.totalEggsLoaded
      : CURRENT_TRAY_CAPACITY;
  const candling = computeCandling(mode.incubationDays);

  const [tab, setTab] = useState<DetailTab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);
  const [candlingFocusDay, setCandlingFocusDay] = useState<number | null>(null);
  const selectCandlingDay = useCallback(
    (day: number) => {
      setCandlingFocusDay(day);
      setTab("candling");
      onTabChange?.("candling");
    },
    [onTabChange],
  );
  const clearCandlingFocus = useCallback(() => {
    setCandlingFocusDay(null);
  }, []);
  const [setupModeId, setSetupModeId] = useState("");
  const [setupEggs, setSetupEggs] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupConfirmOpen, setSetupConfirmOpen] = useState(false);
  const [harvestOpen, setHarvestOpen] = useState(false);

  const isReady = unit.cyclePhase === "ready";
  const cycleEnded =
    unit.cyclePhase === "awaiting_finish" || unit.cyclePhase === "hatching";
  const turningStopped =
    unit.cyclePhase === "lockdown" ||
    unit.cyclePhase === "hatching" ||
    unit.cyclePhase === "awaiting_finish";
  const effectiveCandled = unit.candled ?? {};

  const setupMode = modes.find((m) => m.id === setupModeId);
  const setupEggsCount = Number(setupEggs) || 0;
  const setupEggsValid = setupEggsCount >= 1;

  const environmentalReadings = readings;

  const startCycle = async () => {
    if (!setupMode || !setupEggsValid) return;
    const eggs = setupEggsCount;
    const saved = await onUpdate({
      type: "start-cycle",
      input: { modeId: setupMode.id, totalEggs: eggs },
    });
    if (!saved) return false;
    setSetupEggs("");
    setSetupModeId("");
    setSetupOpen(false);
    toast.success(
      `Started ${setupMode.name} cycle (Day 1 of ${setupMode.incubationDays})`,
      {
        description: `${eggs} eggs loaded into ${unit.name}.`,
      },
    );
    return true;
  };

  const stopCycle = async () => {
    const saved = await archiveStoppedCycle({
      incubatorId: unit.id,
      incubator: unit.name,
      modeName: mode.name,
      dayStopped: unit.dayOfIncubation,
      totalEggs: totalEggsSet,
      fertileEggs: getKnownFertileEggs(unit),
    });
    if (!saved) return false;
    toast.error("Incubation cycle stopped early", {
      description: `${unit.name} archived as Stopped Early.`,
    });
    return true;
  };

  const resetStoppedCycle = async () => {
    if (!(await onUpdate({ type: "reset-stopped-cycle" }))) return;
    toast.success("Incubator reset to Ready");
  };

  const saveHarvest = async (hatched: number, _unhatched: number) => {
    const fertileEggs = getKnownFertileEggs(unit);
    const hatchedEggs = Math.floor(Number(hatched) || 0);
    const validationError = validateHarvestCounts({
      totalEggs: totalEggsSet,
      fertileEggs,
      hatchedEggs,
    });
    if (validationError) {
      toast.error(validationError);
      return false;
    }

    const saved = await completeCycle({
      incubatorId: unit.id,
      chamber: unit.name,
      modeName: mode.name,
      cycleDays: Math.max(unit.dayOfIncubation, 1),
      totalEggs: totalEggsSet,
      fertileEggs,
      hatchedEggs,
    });
    if (!saved) return false;
    setHarvestOpen(false);
    toast.success("Cycle completed and recorded", {
      description: `${hatchedEggs} chicks hatched from ${unit.name}.`,
    });
    return true;
  };

  return (
    <div
      className="space-y-2 md:space-y-5"
      style={{ color: "var(--text-primary)" }}
    >
      {/* Ready Incubator — compact setup prompt */}
      {isReady && (
        <div
          role="status"
          className="flex min-h-20 flex-wrap items-center justify-between gap-4 rounded-2xl p-4 shadow-sm"
          style={{
            backgroundColor: "var(--surface-subtle)",
            border: `var(--border-width-hairline) solid var(--border-default)`,
          }}
        >
          <span
            aria-hidden="true"
            className="w-1.5 shrink-0 self-stretch rounded-full"
            style={{ backgroundColor: "var(--brand-primary)" }}
          />
          <div className="min-w-0 flex-1">
            <p
              style={{
                ...DETAIL_BANNER_TITLE_STYLE,
                color: "var(--brand-primary-hover)",
              }}
            >
              Ready for New Cycle
            </p>
            <p
              style={{
                ...DETAIL_BANNER_DESCRIPTION_STYLE,
                color: "var(--text-secondary)",
              }}
            >
              Load the tray, choose an incubation mode, and begin Day 1.
            </p>
          </div>
          <Button
            size="toolbar"
            onClick={() => setSetupOpen(true)}
            className="shrink-0 rounded-xl px-5 font-bold"
            style={{
              backgroundColor: "var(--brand-primary-hover)",
              color: "var(--on-brand)",
              height: "var(--control-height-mobile)",
            }}
          >
            <span>Set Up</span>
          </Button>
        </div>
      )}

      <Dialog
        open={setupOpen && isReady}
        onOpenChange={(open) => {
          if (!isUpdating) setSetupOpen(open);
          if (!open) setSetupConfirmOpen(false);
        }}
      >
        <DialogContent
          className="max-h-[var(--dialog-height-max)] overflow-y-auto p-0 shadow-2xl md:max-w-[var(--dialog-width-wide)]"
          style={{
            backgroundColor: "var(--surface-subtle)",
            border: `var(--border-width-hairline) solid var(--border-default)`,
            borderRadius: "var(--radius-card)",
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (setupMode && setupEggsValid && !isUpdating)
                setSetupConfirmOpen(true);
            }}
          >
            <DialogHeader className="px-5 pt-5 text-left">
              <DialogTitle
                style={{
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--type-heading-md)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-snug)",
                }}
              >
                Set up incubation cycle
              </DialogTitle>
              <DialogDescription
                className="space-y-0.5"
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--type-caption)",
                  lineHeight: 1.5,
                }}
              >
                <span className="block">
                  Configure the new batch for {unit.name}.
                </span>
                <span className="block">
                  Monitoring and the incubation timeline will begin on Day 1.
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 px-5 py-4">
              <div>
                <Label
                  htmlFor="setup-mode"
                  style={{
                    fontSize: "var(--type-body-sm)",
                    color: "var(--text-primary)",
                  }}
                >
                  Incubation mode
                </Label>
                <p
                  className="mt-0.5"
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "var(--type-caption)",
                  }}
                >
                  Select the species profile for this batch.
                </p>
                <Select
                  value={setupModeId}
                  onValueChange={setSetupModeId}
                  disabled={isUpdating}
                >
                  <SelectTrigger
                    id="setup-mode"
                    className="mt-2 w-full rounded-xl"
                    style={{
                      borderColor: "var(--input-border)",
                      backgroundColor: "var(--surface-card)",
                    }}
                  >
                    <SelectValue placeholder="Select an incubation mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {modes.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.incubationDays} days)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label
                  htmlFor="setup-eggs"
                  style={{
                    fontSize: "var(--type-body-sm)",
                    color: "var(--text-primary)",
                  }}
                >
                  Eggs loaded
                </Label>
                <Input
                  id="setup-eggs"
                  type="text"
                  inputMode="numeric"
                  value={setupEggs}
                  onChange={(e) =>
                    setSetupEggs(
                      e.target.value.replace(/[^0-9]/g, "").slice(0, 3),
                    )
                  }
                  placeholder="0"
                  className="mt-2 rounded-xl"
                  style={{
                    borderColor: "var(--input-border)",
                    backgroundColor: "var(--surface-card)",
                    color: "var(--text-primary)",
                  }}
                  aria-describedby="setup-eggs-help"
                  disabled={isUpdating}
                />
                <p
                  id="setup-eggs-help"
                  className="mt-1.5"
                  style={{
                    fontSize: "var(--type-caption)",
                    color:
                      setupEggs !== "" && !setupEggsValid
                        ? "var(--status-danger-fg)"
                        : "var(--text-secondary)",
                    fontWeight:
                      setupEggs !== "" && !setupEggsValid
                        ? "var(--weight-semibold)"
                        : "var(--weight-regular)",
                  }}
                >
                  {setupEggs !== "" && !setupEggsValid
                    ? "Enter at least 1 egg to start."
                    : "Enter the number of eggs you are loading."}
                </p>
              </div>

              {setupMode ? (
                <div
                  className="rounded-[var(--radius-dialog)] p-4"
                  style={{
                    backgroundColor: "var(--surface-app)",
                    border:
                      "var(--border-width-hairline) solid var(--border-preview)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p
                        className="text-sm font-bold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {setupMode.name} profile
                      </p>
                      <p
                        className="mt-0.5"
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "var(--type-caption)",
                        }}
                      >
                        These targets will be applied when the cycle starts.
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 font-bold"
                      style={{
                        fontSize: "var(--type-label)",
                        backgroundColor: "var(--surface-count)",
                        color: "var(--text-earth)",
                      }}
                    >
                      {setupMode.incubationDays} days
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {[
                      {
                        label: "Cycle length",
                        value: `${setupMode.incubationDays} days`,
                        icon: CalendarDays,
                      },
                      {
                        label: "Temperature",
                        value: `${setupMode.targetTemp.min}–${setupMode.targetTemp.max}°C`,
                        icon: Thermometer,
                      },
                      {
                        label: "Humidity",
                        value: `${setupMode.targetHumidity.min}–${setupMode.targetHumidity.max}%`,
                        icon: Droplets,
                      },
                      {
                        label: "Egg turning",
                        value: `Every ${setupMode.defaultTurnInterval}h`,
                        icon: RefreshCw,
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="min-w-0 rounded-[var(--radius-dialog)] bg-[var(--surface-card)] p-3"
                          style={{
                            border:
                              "var(--border-width-hairline) solid var(--border-preview)",
                          }}
                        >
                          <Icon
                            size={16}
                            style={{ color: "var(--brand-primary-hover)" }}
                            aria-hidden="true"
                          />
                          <p
                            className="mt-2 text-(length:--type-label)"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {item.label}
                          </p>
                          <p
                            className="mt-0.5 text-xs font-bold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {item.value}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <StatusCallout
                  size="sm"
                  tone="info"
                  title="No incubation mode selected"
                  description="Choose a mode to preview the cycle length, temperature, humidity, and how often the eggs turn."
                />
              )}
            </div>

            <div
              className="sticky bottom-0 px-5 py-4"
              style={{
                backgroundColor: "var(--surface-subtle)",
                borderTop: `var(--border-width-hairline) solid var(--border-default)`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  disabled={isUpdating}
                  onClick={() => setSetupOpen(false)}
                >
                  <span>Cancel</span>
                </Button>
                <Button
                  type="submit"
                  disabled={!setupMode || !setupEggsValid || isUpdating}
                  aria-busy={isUpdating}
                  className="rounded-full px-5"
                  style={{
                    backgroundColor: "var(--brand-primary)",
                    color: "var(--on-brand)",
                    opacity:
                      !setupMode || !setupEggsValid || isUpdating ? 0.5 : 1,
                  }}
                >
                  <span>
                    {isUpdating ? "Starting…" : "Start Incubation Cycle"}
                  </span>
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={setupConfirmOpen} onOpenChange={setSetupConfirmOpen}>
        <AlertDialogContent
          className="rounded-2xl border-[var(--border-default)]"
          style={{
            backgroundColor: "var(--surface-subtle)",
            color: "var(--text-primary)",
          }}
        >
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle
              style={{
                color: "var(--text-primary)",
                fontSize: "var(--type-heading-md)",
                fontWeight: "var(--weight-bold)",
              }}
            >
              Start incubation cycle?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="mt-2">
                <StatusCallout
                  size="default"
                  tone="info"
                  icon={
                    <EggIcon
                      size={statusIconBadgeGlyphSize("md")}
                      weight="fill"
                      color="var(--status-icon-badge-fg)"
                    />
                  }
                  title="Are you sure?"
                  description={
                    <>
                      Selected mode is{" "}
                      <strong>{setupMode?.name ?? "Incubation"}</strong> with{" "}
                      <strong>{setupEggsCount} eggs</strong> loaded into{" "}
                      {unit.name}. Monitoring and the incubation timeline will
                      begin on Day 1.
                    </>
                  }
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-full"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                height: "var(--control-height-mobile)",
                fontSize: "var(--type-body)",
              }}
            >
              Go back
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--surface-card)",
                height: "var(--control-height-mobile)",
                fontSize: "var(--type-body)",
              }}
              disabled={isUpdating}
              aria-busy={isUpdating}
              onClick={(event) => {
                event.preventDefault();
                setSetupConfirmOpen(false);
                void startCycle();
              }}
            >
              {isUpdating ? "Starting…" : "Start cycle"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stopped Early Banner */}
      {unit.cyclePhase === "stopped_early" && (
        <SectionCard title="Cycle Stopped Early" titleSize={19}>
          <p
            style={{ fontSize: "var(--type-body)", color: "var(--text-farm)" }}
          >
            This batch was archived before hatch day. Reset the incubator when
            you are ready to load a new batch.
          </p>
          <div className="mt-4 flex justify-end">
            <Button
              size="toolbar"
              onClick={() => void resetStoppedCycle()}
              disabled={isUpdating}
              aria-busy={isUpdating}
              className="rounded-full"
              style={{
                backgroundColor: "var(--brand-primary-hover)",
                color: "var(--on-brand)",
              }}
            >
              <span>{isUpdating ? "Resetting…" : "Reset to Ready"}</span>
            </Button>
          </div>
        </SectionCard>
      )}

      {/* Lockdown Active Banner - Slim Alert Strip */}
      {unit.cyclePhase === "lockdown" && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 shadow-sm"
          style={{
            backgroundColor: "var(--status-warning-bg)",
            border: `var(--border-width-hairline) solid var(--border-default)`,
          }}
        >
          <span
            aria-hidden="true"
            className="w-1.5 shrink-0 self-stretch rounded-full"
            style={{ backgroundColor: "var(--status-warning-fg)" }}
          />
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="min-w-0 flex-1">
              <p
                className="break-words"
                style={{
                  ...DETAIL_BANNER_TITLE_STYLE,
                  color: "var(--status-warning-fg)",
                }}
              >
                Lockdown Active, Do Not Open
              </p>
              <p
                className="break-words"
                style={{
                  ...DETAIL_BANNER_DESCRIPTION_STYLE,
                  color: "var(--status-warning-fg)",
                }}
              >
                Turning Stopped. Keep the incubator closed while hatching
                begins.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overtime / Past Hatch Day Banner - Slim Celebratory Strip */}
      {cycleEnded && (
        <div
          className="flex min-h-20 flex-wrap items-center justify-between gap-4 rounded-2xl p-4 shadow-sm"
          style={{
            backgroundColor: "var(--status-warning-bg)",
            border: `var(--border-width-hairline) solid var(--border-default)`,
          }}
        >
          <span
            aria-hidden="true"
            className="w-1.5 shrink-0 self-stretch rounded-full"
            style={{ backgroundColor: "var(--status-warning-fg)" }}
          />
          <div className="min-w-0 flex-1">
            <p
              className="break-words"
              style={{
                ...DETAIL_BANNER_TITLE_STYLE,
                color: "var(--status-warning-fg)",
              }}
            >
              Past Hatch Day
            </p>
            <p
              style={{
                ...DETAIL_BANNER_DESCRIPTION_STYLE,
                color: "var(--status-warning-fg)",
              }}
            >
              Some eggs may still be hatching. Finish the cycle when ready.
            </p>
          </div>
          <Button
            size="toolbar"
            onClick={() => setHarvestOpen(true)}
            className="h-[var(--control-height-mobile)] max-h-[var(--control-height-mobile)] rounded-xl px-5 py-0 font-bold shadow-sm transition-all md:h-[var(--control-height-default)] md:max-h-[var(--control-height-default)]"
            style={{
              backgroundColor: "var(--brand-primary-hover)",
              color: "var(--on-brand)",
              fontSize: "var(--type-button-label)",
              lineHeight: "var(--leading-button)",
            }}
          >
            <span>Finish Cycle</span>
          </Button>
        </div>
      )}

      {/* SubTab Navigation */}
      <div className="pt-1">
        <SubTabNav
          active={tab}
          onChange={(nextTab) => {
            setTab(nextTab);
            onTabChange?.(nextTab);
          }}
        />
      </div>

      {/* Tab Panels */}
      {tab === "monitor" && (
        <LiveMonitorTab
          unit={unit}
          mode={mode}
          currentDay={currentDay}
          totalDays={totalDays}
          candling={candling}
          effectiveCandled={effectiveCandled}
          environmentalReadings={environmentalReadings}
          readingsLoading={readingsQuery.isPending}
          readingsError={readingsQuery.error}
          onRetryReadings={() => void readingsQuery.refetch()}
          onOpenTrends={onOpenTrends}
          onSelectCandlingDay={selectCandlingDay}
        />
      )}

      {tab === "candling" && (
        <CandlingJournalTab
          unit={unit}
          mode={mode}
          candling={candling}
          effectiveCandled={effectiveCandled}
          currentDay={currentDay}
          totalDays={totalDays}
          totalEggsSet={totalEggsSet}
          onUpdate={onUpdate}
          isUpdating={isUpdating}
          focusDay={candlingFocusDay}
          onFocusHandled={clearCandlingFocus}
          onSelectDay={setCandlingFocusDay}
        />
      )}

      {tab === "settings" && (
        <DeviceSettingsTab
          unit={unit}
          modes={modes}
          candling={candling}
          isReady={isReady}
          cycleEnded={cycleEnded}
          turningStopped={turningStopped}
          isUpdating={isUpdating}
          isRequestingTurn={isRequestingTurn}
          turnCommandStatus={turnCommand?.status ?? unit.turnCommandStatus}
          onUpdate={onUpdate}
          onStopCycle={stopCycle}
          onTurnClick={async () => {
            if (unit.cyclePhase !== "incubating") {
              toast("Turning is stopped during this cycle phase.");
              return false;
            }
            const saved = await onRequestTurn();
            if (!saved) return false;
            toast.success(
              "Turn request queued. Waiting for device confirmation.",
            );
            return true;
          }}
        />
      )}

      {/* Finish Cycle / Harvest Modal */}
      <HarvestModal
        open={harvestOpen}
        onOpenChange={setHarvestOpen}
        chamberName={unit.name}
        totalEggsLoaded={totalEggsSet}
        fertileEggs={getKnownFertileEggs(unit)}
        onSave={saveHarvest}
      />
    </div>
  );
}
