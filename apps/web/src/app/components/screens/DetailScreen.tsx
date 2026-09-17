import { Egg as EggIcon, Notepad } from "@phosphor-icons/react";
import {
  Activity,
  CalendarDays,
  Droplets,
  RefreshCw,
  Settings2,
  Thermometer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CURRENT_TRAY_CAPACITY, computeCandling } from "../../domain/candling";
import {
  getKnownFertileEggs,
  validateHarvestCounts,
} from "../../domain/fertility";
import { resetChamberToReady } from "../../domain/incubator";
import type { Incubator, Mode } from "../../domain/types";
import { useCycleHistoryActions } from "../../features/farm/use-farm-data";
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
            icon: <Notepad size={15} aria-hidden="true" />,
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
  isUpdating,
  onOpenTrends,
  onTabChange,
}: {
  unit: Incubator;
  modes: Mode[];
  initialTab?: DetailTab;
  onUpdate: (patch: Partial<Incubator>) => Promise<boolean>;
  isUpdating: boolean;
  onOpenTrends: () => void;
  onTabChange?: (tab: DetailTab) => void;
}) {
  const { completeCycle, stopCycle: archiveStoppedCycle } =
    useCycleHistoryActions();
  const { readings } = useIncubatorReadings(unit.id, "full");
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

  const environmentalReadings = useMemo(() => {
    if (readings.length === 0) return readings;
    return readings.map((reading, index) =>
      index === readings.length - 1
        ? { ...reading, temp: unit.temp, humidity: unit.humidity }
        : reading,
    );
  }, [readings, unit.temp, unit.humidity]);

  const startCycle = async () => {
    if (!setupMode || !setupEggsValid) return;
    const eggs = setupEggsCount;
    const saved = await onUpdate({
      modeId: setupMode.id,
      dayOfIncubation: 1,
      totalEggsLoaded: eggs,
      cyclePhase: "incubating",
      status: "optimal",
      turnInterval: setupMode.defaultTurnInterval,
      candled: {},
      candlingLog: [],
      lastTurned: new Date().toISOString(),
      nextTurn: new Date(
        Date.now() + setupMode.defaultTurnInterval * 3_600_000,
      ).toISOString(),
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
    if (!(await onUpdate(resetChamberToReady(unit)))) return;
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
          className="flex flex-col gap-4 rounded-2xl p-4 shadow-sm md:flex-row md:items-center md:justify-between"
          style={{
            backgroundColor: "var(--surface-subtle)",
            border: `1px solid var(--border-default)`,
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: "var(--brand-primary-soft)",
                color: "var(--brand-primary-hover)",
              }}
              aria-hidden="true"
            >
              <EggIcon size={22} weight="fill" />
            </span>
            <div className="min-w-0">
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--type-heading-sm)",
                  fontWeight: "var(--weight-extrabold)",
                  lineHeight: "var(--leading-snug)",
                  color: "var(--brand-primary-hover)",
                }}
              >
                Ready for a new incubation cycle
              </p>
              <p
                className="mt-0.5"
                style={{
                  fontSize: "var(--type-body-sm)",
                  color: "var(--text-secondary)",
                  lineHeight: 1.45,
                }}
              >
                Load the tray, choose an incubation mode, and begin Day 1.
              </p>
            </div>
          </div>
          <Button
            size="toolbar"
            onClick={() => setSetupOpen(true)}
            className="w-full rounded-xl px-5 md:w-auto"
            style={{
              backgroundColor: "var(--brand-primary-hover)",
              color: "var(--on-brand)",
            }}
          >
            Set up incubation
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
            border: `1px solid var(--border-default)`,
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
                  className="rounded-2xl p-4"
                  style={{
                    backgroundColor: "var(--surface-app)",
                    border: "1px solid var(--border-preview)",
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
                          className="min-w-0 rounded-xl bg-[var(--surface-card)] p-3"
                          style={{ border: "1px solid var(--border-preview)" }}
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
                borderTop: `1px solid var(--border-default)`,
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
                  Cancel
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
                  {isUpdating ? "Starting…" : "Start Incubation Cycle"}
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
                height: 34,
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
                height: 34,
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
              {isUpdating ? "Resetting…" : "Reset to Ready"}
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
            border: `1px solid var(--border-default)`,
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
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "calc(var(--type-heading-sm) - 1px)",
                  fontWeight: "var(--weight-extrabold)",
                  lineHeight: "var(--leading-snug)",
                  color: "var(--status-warning-fg)",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                }}
              >
                Lockdown Active, Do Not Open
              </p>
              <p
                style={{
                  fontSize: "calc(var(--type-body-sm) - 1px)",
                  color: "var(--status-warning-fg)",
                  marginTop: 2,
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
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 shadow-sm"
          style={{
            backgroundColor: "var(--status-warning-bg)",
            border: `1px solid var(--border-default)`,
          }}
        >
          <span
            aria-hidden="true"
            className="w-1.5 shrink-0 self-stretch rounded-full"
            style={{ backgroundColor: "var(--status-warning-fg)" }}
          />
          <div className="min-w-0 flex-1">
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--type-body-sm)",
                fontWeight: "var(--weight-extrabold)",
                lineHeight: "var(--leading-snug)",
                color: "var(--status-warning-fg)",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
              }}
            >
              Past Hatch Day
            </p>
            <p
              style={{
                fontSize: "var(--type-filter-label)",
                color: "var(--status-warning-fg)",
                marginTop: 2,
              }}
            >
              Some eggs may still be hatching. Finish the cycle when ready.
            </p>
          </div>
          <Button
            size="toolbar"
            onClick={() => setHarvestOpen(true)}
            className="rounded-xl px-5 font-bold shadow-sm transition-all"
            style={{
              backgroundColor: "var(--brand-primary-hover)",
              color: "var(--on-brand)",
              height: 34,
            }}
          >
            Finish Cycle
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
          onOpenTrends={onOpenTrends}
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
          onUpdate={onUpdate}
          onStopCycle={stopCycle}
          onTurnClick={async () => {
            if (unit.cyclePhase !== "incubating") {
              toast("Turning is stopped during this cycle phase.");
              return false;
            }
            const saved = await onUpdate({
              lastTurned: new Date().toISOString(),
              nextTurn: new Date(
                Date.now() + unit.turnInterval * 3_600_000,
              ).toISOString(),
            });
            if (!saved) return false;
            toast.success("Egg tray turned successfully");
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
