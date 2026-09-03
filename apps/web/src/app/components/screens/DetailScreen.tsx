import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Activity, ScanSearch, Settings2 } from "lucide-react";
import { ExclamationIcon } from "../icons";
import { Button } from "../ui/button";
import { SegmentedControl, SegmentedControlItem } from "../ui/segmented-control";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { HarvestModal } from "../HarvestModal";
import { CURRENT_TRAY_CAPACITY, computeCandling } from "../../domain/candling";
import { getKnownFertileEggs, validateHarvestCounts } from "../../domain/fertility";
import { resetChamberToReady } from "../../domain/incubator";
import type { Incubator, Mode } from "../../domain/types";
import { useCycleHistoryActions } from "../../features/farm/use-farm-data";
import { useIncubatorReadings } from "../../features/farm/use-incubator-readings";
import {
  DetailTab,
  TEXT,
  MUTED,
  INPUT_BORDER,
  SURFACE,
} from "../detail/types";
import { SectionCard } from "../detail/primitives";
import { LiveMonitorTab } from "../detail/LiveMonitorTab";
import { CandlingJournalTab } from "../detail/CandlingJournalTab";
import { DeviceSettingsTab } from "../detail/DeviceSettingsTab";

function SubTabNav({ active, onChange }: { active: DetailTab; onChange: (t: DetailTab) => void }) {
  const tabs: { id: DetailTab; label: string; mobileLabel: string; icon: React.ReactNode }[] = [
    { id: "monitor", label: "Live Monitor", mobileLabel: "Monitor", icon: <Activity size={15} aria-hidden="true" /> },
    { id: "candling", label: "Candling & Inspection", mobileLabel: "Candling", icon: <ScanSearch size={15} aria-hidden="true" /> },
    { id: "settings", label: "Device Settings", mobileLabel: "Settings", icon: <Settings2 size={15} aria-hidden="true" /> },
  ];

  return (
    <div className="flex max-w-full justify-start overflow-x-auto pb-1 lg:justify-end">
      <SegmentedControl role="tablist" aria-label="Incubator detail sections" className="w-max shrink-0">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <SegmentedControlItem
              key={t.id}
              size="toolbar"
              active={isActive}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              style={{
                color: isActive ? "var(--brand-primary)" : "var(--text-secondary)",
                fontWeight: isActive ? "var(--weight-semibold)" : "var(--weight-medium)",
              }}
            >
              {t.icon}
              <span className="sm:hidden">{t.mobileLabel}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </SegmentedControlItem>
          );
        })}
      </SegmentedControl>
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
  const { completeCycle, stopCycle: archiveStoppedCycle } = useCycleHistoryActions();
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
  const [harvestOpen, setHarvestOpen] = useState(false);

  const isReady = unit.cyclePhase === "ready";
  const cycleEnded = unit.cyclePhase === "awaiting_finish" || unit.cyclePhase === "hatching";
  const turningStopped = unit.cyclePhase === "lockdown" || unit.cyclePhase === "hatching" || unit.cyclePhase === "awaiting_finish";
  const effectiveCandled = unit.candled ?? {};

  const setupMode = modes.find((m) => m.id === setupModeId);

  const environmentalReadings = useMemo(() => {
    if (readings.length === 0) return readings;
    return readings.map((reading, index) =>
      index === readings.length - 1
        ? { ...reading, temp: unit.temp, humidity: unit.humidity }
        : reading
    );
  }, [
    readings,
    unit.temp,
    unit.humidity,
  ]);

  const startCycle = async () => {
    if (!setupMode) return;
    const eggs = Math.min(CURRENT_TRAY_CAPACITY, Math.max(1, Number(setupEggs) || CURRENT_TRAY_CAPACITY));
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
      nextTurn: new Date(Date.now() + setupMode.defaultTurnInterval * 3_600_000).toISOString(),
    });
    if (!saved) return false;
    setSetupEggs("");
    setSetupModeId("");
    toast.success(`Started ${setupMode.name} cycle (Day 1 of ${setupMode.incubationDays})`, {
      description: `${eggs} eggs loaded into installed 38-egg tray.`,
    });
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
    if (!await onUpdate(resetChamberToReady(unit))) return;
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
    <div className="space-y-5" style={{ color: TEXT }}>
      {/* Ready Incubator — Setup Card */}
      {isReady && (
        <SectionCard title="Incubation Cycle Setup" subtitle="Incubator ready. Load eggs, choose a mode, and start Day 1.">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <Label style={{ fontSize: 13, color: TEXT }}>Species Mode</Label>
                <Select value={setupModeId} onValueChange={setSetupModeId}>
                  <SelectTrigger className="mt-1.5 w-full rounded-xl" style={{ borderColor: INPUT_BORDER, backgroundColor: SURFACE }}>
                    <SelectValue placeholder="Select Incubation Mode..." />
                  </SelectTrigger>
                  <SelectContent>
                    {modes.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} · {m.incubationDays} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ fontSize: 13, color: TEXT }}>Total eggs loaded (Max {CURRENT_TRAY_CAPACITY})</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={setupEggs}
                  onChange={(e) => setSetupEggs(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                  placeholder="38"
                  className="mt-1.5 w-28 rounded-xl"
                  style={{ borderColor: INPUT_BORDER, backgroundColor: SURFACE, color: TEXT }}
                  disabled={isUpdating}
                />
              </div>
              {setupMode && (
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Temperature", value: `${setupMode.targetTemp.min} to ${setupMode.targetTemp.max}°C` },
                    { label: "Humidity", value: `${setupMode.targetHumidity.min} to ${setupMode.targetHumidity.max}% RH` },
                    { label: "Turning cadence", value: `Every ${setupMode.defaultTurnInterval} hours` },
                  ].map((s) => (
                    <span
                      key={s.label}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
                      style={{ backgroundColor: "#F5EFE6", color: MUTED, fontSize: 12, fontWeight: 600 }}
                    >
                      {s.label}: {s.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button
              size="toolbar"
              onClick={startCycle}
              disabled={!setupMode || isUpdating}
              aria-busy={isUpdating}
              className="rounded-full"
              style={{ backgroundColor: "#8B3A1C", color: "#fff" }}
            >
              {isUpdating ? "Starting…" : "Start Incubation Cycle"}
            </Button>
          </div>
        </SectionCard>
      )}

      {/* Stopped Early Banner */}
      {unit.cyclePhase === "stopped_early" && (
        <SectionCard title="Cycle Stopped Early" titleSize={19}>
          <p style={{ fontSize: 14, color: "#6E6259" }}>
            This batch was archived before hatch day. Reset the incubator when you are ready to load a new batch.
          </p>
          <div className="mt-4 flex justify-end">
            <Button size="toolbar" onClick={() => void resetStoppedCycle()} disabled={isUpdating} aria-busy={isUpdating} className="rounded-full" style={{ backgroundColor: "#8B3A1C", color: "#fff" }}>
              {isUpdating ? "Resetting…" : "Reset to Ready"}
            </Button>
          </div>
        </SectionCard>
      )}

      {/* Lockdown Active Banner - Slim Alert Strip */}
      {unit.cyclePhase === "lockdown" && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 shadow-sm"
          style={{ backgroundColor: "#FFF8EB", border: "1px solid #FDE68A" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold"
              style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}
            >
              <ExclamationIcon size={22} color="#B45309" />
            </span>
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)", fontWeight: "var(--weight-extrabold)", lineHeight: "var(--leading-snug)", color: "#92400E", whiteSpace: "normal", wordBreak: "break-word" }}>Lockdown Active, Do Not Open</p>
              <p style={{ fontSize: 13, color: "#B45309", marginTop: 2 }}>
                Turning Stopped. Keep the incubator closed while hatching begins.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overtime / Past Hatch Day Banner - Slim Celebratory Strip */}
      {cycleEnded && (
        <div
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 shadow-sm"
          style={{ backgroundColor: "#FFF8EB", border: "1px solid #FDE68A" }}
        >
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)", fontWeight: "var(--weight-extrabold)", lineHeight: "var(--leading-snug)", color: "#92400E", whiteSpace: "normal", wordBreak: "break-word" }}>
              Past Hatch Day
            </p>
            <p style={{ fontSize: 13, color: "#B45309", marginTop: 2 }}>
              Some eggs may still be hatching. Finish the cycle when ready.
            </p>
          </div>
          <Button
            size="toolbar"
            onClick={() => setHarvestOpen(true)}
            className="rounded-xl px-5 font-bold shadow-sm transition-all"
            style={{ backgroundColor: "#8B3A1C", color: "#FFFFFF" }}
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
              nextTurn: new Date(Date.now() + unit.turnInterval * 3_600_000).toISOString(),
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
