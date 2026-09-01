import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Activity, ScanSearch, Settings2 } from "lucide-react";
import { ExclamationIcon } from "../icons";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { HarvestModal } from "../HarvestModal";
import {
  Incubator, Mode,
  CURRENT_TRAY_CAPACITY,
  buildHistory, computeCandling, getKnownFertileEggs,
  recordAbortedCycle, recordHarvest, resetChamberToReady,
} from "../../data/mockData";
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
  const tabs: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    { id: "monitor", label: "Live Monitor", icon: <Activity size={15} /> },
    { id: "candling", label: "Candling & Inspection", icon: <ScanSearch size={15} /> },
    { id: "settings", label: "Device Settings", icon: <Settings2 size={15} /> },
  ];

  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-3 self-end"
      style={{ backgroundColor: "#F4ECE1", borderRadius: 9999, padding: 4 }}
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className="flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              backgroundColor: isActive ? "#FFFFFF" : "transparent",
              boxShadow: isActive ? "0px 2px 6px rgba(0,0,0,0.05)" : "none",
              color: isActive ? "#8B3A1C" : "#6E5E53",
              fontWeight: 500,
              fontSize: 13,
              borderRadius: 9999,
              padding: "12px 16px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.icon} {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function DetailScreen({
  unit,
  modes,
  initialTab = "monitor",
  onUpdate,
  onOpenTrends,
  onHistoryChanged,
}: {
  unit: Incubator;
  modes: Mode[];
  initialTab?: DetailTab;
  onUpdate: (patch: Partial<Incubator>) => void;
  onOpenTrends: () => void;
  onHistoryChanged: () => void;
}) {
  const mode = modes.find((m) => m.id === unit.modeId) ?? modes[0];
  const totalDays = mode.incubationDays;
  const currentDay = unit.dayOfIncubation;
  const totalEggsSet =
    unit.totalEggsLoaded && unit.totalEggsLoaded > 0
      ? unit.totalEggsLoaded
      : CURRENT_TRAY_CAPACITY;
  const candling = computeCandling(mode.incubationDays);

  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [setupModeId, setSetupModeId] = useState("");
  const [setupEggs, setSetupEggs] = useState("");
  const [harvestOpen, setHarvestOpen] = useState(false);

  const isReady = unit.cyclePhase === "ready";
  const cycleEnded = unit.cyclePhase === "awaiting_finish" || unit.cyclePhase === "hatching";
  const turningStopped = unit.cyclePhase === "lockdown" || unit.cyclePhase === "hatching" || unit.cyclePhase === "awaiting_finish";
  const effectiveCandled = unit.candled ?? {};

  const setupMode = modes.find((m) => m.id === setupModeId);

  const environmentalReadings = useMemo(() => {
    const generated = buildHistory(unit, mode);
    if (generated.length === 0) return generated;
    return generated.map((reading, index) =>
      index === generated.length - 1
        ? { ...reading, temp: unit.temp, humidity: unit.humidity }
        : reading
    );
  }, [
    unit.id,
    unit.dayOfIncubation,
    unit.status,
    unit.temp,
    unit.humidity,
    mode.id,
    mode.targetTemp.min,
    mode.targetTemp.max,
    mode.targetHumidity.min,
    mode.targetHumidity.max,
  ]);

  const startCycle = () => {
    if (!setupMode) return;
    const eggs = Math.min(CURRENT_TRAY_CAPACITY, Math.max(1, Number(setupEggs) || CURRENT_TRAY_CAPACITY));
    onUpdate({
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
    setSetupEggs("");
    setSetupModeId("");
    toast.success(`Started ${setupMode.name} cycle (Day 1 of ${setupMode.incubationDays})`, {
      description: `${eggs} eggs loaded into installed 38-egg tray.`,
    });
  };

  const stopCycle = () => {
    recordAbortedCycle({
      incubator: unit.name,
      modeName: mode.name,
      dayStopped: unit.dayOfIncubation,
      totalEggs: totalEggsSet,
      fertileEggs: getKnownFertileEggs(unit),
    });
    onHistoryChanged();
    onUpdate({
      cyclePhase: "stopped_early",
      status: "warning",
    });
    toast.error("Incubation cycle stopped early", {
      description: `${unit.name} archived as Stopped Early.`,
    });
  };

  const resetStoppedCycle = () => {
    onUpdate(resetChamberToReady(unit));
    toast.success("Incubator reset to Ready");
  };

  const saveHarvest = (hatched: number, _unhatched: number) => {
    const fertileEggs = getKnownFertileEggs(unit);
    const hatchedEggs = Math.floor(Number(hatched) || 0);

    recordHarvest({
      chamber: unit.name,
      modeName: mode.name,
      cycleDays: Math.max(unit.dayOfIncubation, 1),
      totalEggs: totalEggsSet,
      fertileEggs,
      hatchedEggs,
    });

    onHistoryChanged();
    onUpdate(resetChamberToReady(unit));
    setHarvestOpen(false);
    toast.success("Cycle completed and recorded", {
      description: `${hatchedEggs} chicks hatched from ${unit.name}.`,
    });
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
              onClick={startCycle}
              disabled={!setupMode}
              className="rounded-full"
              style={{ backgroundColor: "#8B3A1C", color: "#fff", minHeight: 40 }}
            >
              Start Incubation Cycle
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
            <Button onClick={resetStoppedCycle} className="rounded-full" style={{ backgroundColor: "#8B3A1C", color: "#fff", minHeight: 40 }}>
              Reset to Ready
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
              <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)", fontWeight: "var(--weight-extrabold)", lineHeight: "var(--leading-snug)", color: "#92400E", whiteSpace: "normal", wordBreak: "break-word" }}>Lockdown Active · Do Not Open</p>
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
            onClick={() => setHarvestOpen(true)}
            className="rounded-xl px-5 font-bold shadow-sm transition-all"
            style={{ backgroundColor: "#8B3A1C", color: "#FFFFFF", minHeight: 40 }}
          >
            Finish Cycle
          </Button>
        </div>
      )}

      {/* SubTab Navigation */}
      <div className="pt-1">
        <SubTabNav active={tab} onChange={setTab} />
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
          onUpdate={onUpdate}
          onStopCycle={stopCycle}
          onTurnClick={() => {
            if (unit.cyclePhase !== "incubating") {
              toast("Turning is stopped during this cycle phase.");
              return;
            }
            onUpdate({
              lastTurned: new Date().toISOString(),
              nextTurn: new Date(Date.now() + unit.turnInterval * 3_600_000).toISOString(),
            });
            toast.success("Egg tray turned successfully");
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
