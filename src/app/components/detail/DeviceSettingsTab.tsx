import { useState } from "react";
import { toast } from "sonner";
import {
  Egg, RotateCw, Zap, Wifi, WifiOff, ChevronRight,
} from "lucide-react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Progress } from "../ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Incubator, Mode, CandlingCheckpoint } from "../../data/mockData";
import {
  TEXT, MUTED, BORDER, SURFACE, OK, CRIT,
  relTime,
} from "./types";
import { KeyValue } from "./primitives";
import { StopCycleModal } from "./StopCycleModal";

interface DeviceSettingsTabProps {
  unit: Incubator;
  modes: Mode[];
  candling: CandlingCheckpoint[];
  isReady: boolean;
  cycleEnded: boolean;
  turningStopped: boolean;
  onUpdate: (patch: Partial<Incubator>) => void;
  onStopCycle: () => void;
  onTurnClick: () => void;
}

export function DeviceSettingsTab({
  unit,
  modes,
  candling,
  isReady,
  cycleEnded,
  turningStopped,
  onUpdate,
  onStopCycle,
  onTurnClick,
}: DeviceSettingsTabProps) {
  const [settingTab, setSettingTab] = useState<"mode" | "turning" | "device">("mode");
  const [stopCycleOpen, setStopCycleOpen] = useState(false);

  const mode = modes.find((m) => m.id === unit.modeId) ?? modes[0];

  const changeMode = (modeId: string) => {
    const m = modes.find((x) => x.id === modeId)!;
    onUpdate({ modeId, turnInterval: m.defaultTurnInterval });
    toast(`Mode changed to ${m.name}`, { description: "Turning interval reset to mode default." });
  };

  const reconnectDevice = () => {
    onUpdate({ connectionState: "connecting" });
    toast("Reconnecting to incubator...", { description: `Attempting handshake with ${unit.deviceId}` });
    setTimeout(() => {
      const unreachable = ["EGG-0000", "EGG-9999", "EGG-1005", "EGG-1010"].includes(unit.deviceId);
      if (unreachable) {
        onUpdate({ paired: false, connectionState: "connection_failed" });
        toast.error("Connection Failed", { description: "Device unreachable on the local network." });
      } else {
        onUpdate({ paired: true, connectionState: "connected" });
        toast.success("Connected", { description: `${unit.name} paired successfully.` });
      }
    }, 1200);
  };

  const nextTurnLabel = () => {
    const diffMin = Math.round((new Date(unit.nextTurn).getTime() - Date.now()) / 60000);
    if (diffMin < 0) return { text: `Overdue by ${Math.abs(diffMin)} min`, overdue: true };
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return { text: `in ${h > 0 ? `${h}h ` : ""}${m}m`, overdue: false };
  };
  const next = nextTurnLabel();

  const outlineBtn = {
    borderColor: "#E5DACB",
    color: "#1A1A1A",
    backgroundColor: "#FFFFFF",
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Left Sub-Nav Card */}
      <nav
        className="shrink-0 rounded-2xl p-4 lg:sticky lg:top-6"
        style={{
          width: "100%",
          maxWidth: 240,
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          padding: 16,
          border: "1px solid #E5DACB",
        }}
        aria-label="Device settings"
      >
        <ul className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {[
            { id: "mode" as const, label: "INCUBATION MODE", Icon: Egg },
            { id: "turning" as const, label: "TURNING SCHEDULE", Icon: RotateCw },
            { id: "device" as const, label: "DEVICE & CONNECTION", Icon: Zap },
          ].map(({ id, label, Icon }) => {
            const isActive = settingTab === id;
            return (
              <li key={id} className="min-w-0 shrink-0 lg:shrink lg:w-full">
                <button
                  onClick={() => setSettingTab(id)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 transition-colors hover:bg-[#FAF6EE]"
                  style={{
                    height: 40,
                    backgroundColor: isActive ? "#8B3A1C" : "transparent",
                    color: isActive ? "#FFFFFF" : "#1A1A1A",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    size={16}
                    strokeWidth={isActive ? 2.5 : 2}
                    className="shrink-0"
                    style={{ color: isActive ? "#FFFFFF" : "#1A1A1A" }}
                  />
                  <span className="min-w-0 truncate" title={label}>
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Right Content Card */}
      <section
        className="min-w-0 flex-1 rounded-2xl"
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          padding: 24,
          border: "1px solid #E5DACB",
        }}
      >
        {settingTab === "mode" && (
          <>
            <div className="pb-5" style={{ borderBottom: "1px solid #E5DACB" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A" }}>
                Incubation Mode
              </h2>
              <p className="mt-1" style={{ fontSize: 13, fontWeight: 400, color: "#6E6259" }}>
                View target temperature, humidity, and candling schedule for the active species preset.
              </p>
            </div>
            <div className="pt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate" style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>
                    {mode.name}
                  </p>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5"
                    style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#F5EFE6", color: "#8B3A1C" }}
                  >
                    {mode.builtIn ? "Built-in" : "Custom"}
                  </span>
                </div>
                <Select
                  value={unit.modeId}
                  disabled={!isReady}
                  onValueChange={(val) => {
                    if (val !== unit.modeId && isReady) changeMode(val);
                  }}
                >
                  <SelectTrigger
                    className="h-auto w-fit rounded-lg [&_svg]:!text-[#1A1A1A]"
                    style={{
                      backgroundColor: "#F4ECE1",
                      border: "1px solid #E5DACB",
                      color: "#1A1A1A",
                      fontSize: 13,
                      fontWeight: 600,
                      padding: "8px 14px",
                    }}
                  >
                    {isReady ? "Choose Mode" : "Mode Locked"}
                  </SelectTrigger>
                  <SelectContent>
                    {modes.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isReady && (
                <p style={{ fontSize: 12, color: MUTED }}>
                  Mode is locked during an active cycle. Stop or finish the cycle before choosing another mode.
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <KeyValue label="Target Temperature" value={`${mode.targetTemp.min} to ${mode.targetTemp.max}°C`} />
                <KeyValue label="Target Humidity" value={`${mode.targetHumidity.min} to ${mode.targetHumidity.max}% RH`} />
                <KeyValue label="Turning Cadence" value={`Every ${mode.defaultTurnInterval} hours`} />
                <KeyValue label="Scheduled Candling Days" value={candling.map((c) => `Day ${c.day}`).join(", ")} />
              </div>
              <button
                onClick={() => toast("Mode Library", { description: "Edit this preset under Settings → Mode Library." })}
                className="inline-flex items-center gap-1.5 text-[#C8623A] transition-colors hover:text-[#8B3A1C]"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                Edit Preset in Mode Library <ChevronRight size={14} />
              </button>
            </div>
          </>
        )}

        {settingTab === "turning" && (
          <>
            <div className="pb-5" style={{ borderBottom: "1px solid #E5DACB" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A" }}>
                Turning Schedule
              </h2>
              <p className="mt-1" style={{ fontSize: 13, fontWeight: 400, color: "#6E6259" }}>
                Configure automatic egg rotation intervals and manual turning controls.
              </p>
            </div>
            <div className="pt-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>Automatic turning</p>
                  <p style={{ color: MUTED, fontSize: 12 }}>Turn eggs on schedule automatically.</p>
                </div>
                <Switch checked={unit.autoTurn} disabled={turningStopped} onCheckedChange={(v) => onUpdate({ autoTurn: v })} />
              </div>
              {turningStopped && (
                <p style={{ fontSize: 12, color: MUTED }}>Turning is stopped during Lockdown and hatch phases.</p>
              )}
              <div className="flex items-center justify-between gap-2">
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Turn every</span>
                <Select
                  disabled={turningStopped}
                  value={String(unit.turnInterval)}
                  onValueChange={(v) => onUpdate({ turnInterval: Number(v) })}
                >
                  <SelectTrigger className="h-9 w-[110px] rounded-xl" style={{ borderColor: "rgba(120,53,15,0.20)", backgroundColor: SURFACE, fontSize: 13 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 4, 6, 8, 12].map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h} Hours
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate" style={{ fontSize: 12, color: next.overdue ? CRIT.fg : MUTED }}>
                  Next: {next.text} • Last: {relTime(unit.lastTurned)}
                </span>
                <Button disabled={turningStopped} onClick={onTurnClick} variant="outline" size="sm" className="shrink-0 rounded-full" style={outlineBtn}>
                  <RotateCw size={14} /> Turn Now
                </Button>
              </div>
            </div>
          </>
        )}

        {settingTab === "device" && (
          <>
            <div className="pb-5" style={{ borderBottom: "1px solid #E5DACB" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A" }}>
                Device & Connection
              </h2>
              <p className="mt-1" style={{ fontSize: 13, fontWeight: 400, color: "#6E6259" }}>
                Manage chamber hardware pairing, connectivity status, and power telemetry.
              </p>
            </div>
            <div className="pt-5 space-y-4">
              <KeyValue label="Device ID" value={unit.deviceId} />
              <KeyValue
                label="Connection Status"
                accent={unit.paired ? OK.fg : CRIT.fg}
                value={
                  <span className="flex items-center gap-1.5">
                    {unit.paired ? <Wifi size={15} /> : <WifiOff size={15} />}
                    {unit.connectionState === "connecting"
                      ? "Connecting"
                      : unit.paired && unit.connectionState === "connected"
                      ? "Connected and Paired"
                      : "Connection Lost"}
                    {(!unit.paired || unit.connectionState !== "connected") && (
                      <Button
                        onClick={reconnectDevice}
                        disabled={unit.connectionState === "connecting"}
                        variant="outline"
                        size="sm"
                        className="ml-1 rounded-full"
                        style={outlineBtn}
                      >
                        <WifiOff size={13} /> {unit.connectionState === "connecting" ? "Connecting" : "Reconnect"}
                      </Button>
                    )}
                  </span>
                }
              />
              <div className="rounded-xl p-3.5" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between">
                  <p style={{ fontSize: 12, color: MUTED }}>Battery</p>
                  <span style={{ fontSize: 13, fontWeight: 700, color: unit.batteryPct <= 25 ? CRIT.fg : TEXT }}>
                    {unit.batteryPct}%
                  </span>
                </div>
                <Progress value={unit.batteryPct} className="mt-1.5 h-2" />
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "#FFF8E7", border: "1px solid #F2C94C" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Advanced</p>
                <p className="mt-1" style={{ fontSize: 12, color: MUTED }}>
                  Stop the current cycle early if the batch must be removed before the expected hatch period.
                </p>
                <Button
                  className="mt-3 rounded-xl"
                  variant="outline"
                  disabled={isReady || cycleEnded || unit.cyclePhase === "stopped_early"}
                  onClick={() => setStopCycleOpen(true)}
                  style={{ borderColor: "#C2410C", color: "#9A3412", backgroundColor: "#FFFFFF" }}
                >
                  Stop Cycle
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <StopCycleModal
        open={stopCycleOpen}
        onOpenChange={setStopCycleOpen}
        unitName={unit.name}
        onConfirm={() => {
          setStopCycleOpen(false);
          onStopCycle();
        }}
      />
    </div>
  );
}
