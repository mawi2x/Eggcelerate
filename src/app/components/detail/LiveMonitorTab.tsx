import React, { useState } from "react";
import { toast } from "sonner";
import {
  RotateCw, Flame, Fan, Waves,
  TrendingDown, TrendingUp, ArrowUpRight, Droplets, Thermometer,
} from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { GaugeDial } from "../GaugeDial";
import { WaterDroplet } from "../WaterDroplet";
import { SegmentedBattery } from "../SegmentedBattery";
import { Incubator, Mode, Reading, CandlingCheckpoint } from "../../data/mockData";
import {
  RUST, CARD, SURFACE, BORDER, TEXT, MUTED,
  OK, WARN, CRIT, NEUTRAL, relTime,
} from "./types";
import { SectionCard, StatusPill } from "./primitives";
import { Timeline } from "./Timeline";

function ActuatorRow({
  icon,
  name,
  on,
  tone,
  label,
  offLabel,
  pulse = false,
}: {
  icon: React.ReactNode;
  name: string;
  on: boolean;
  tone: typeof OK;
  label: string;
  offLabel: string;
  pulse?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-3.5"
      style={{
        backgroundColor: on ? tone.bg : SURFACE,
        border: `1px solid ${on ? `${tone.fg}33` : BORDER}`,
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: on ? "#FFFFFF" : "#F3ECDD", color: on ? tone.fg : "#9E8B72" }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{name}</p>
      </div>
      {on ? (
        <StatusPill tone={tone} pulse={pulse}>
          {label}
        </StatusPill>
      ) : (
        <StatusPill tone={NEUTRAL}>{offLabel}</StatusPill>
      )}
    </div>
  );
}

function readingStamp(ts: number) {
  const date = new Date(ts);
  return {
    date: date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

function ExtremumTile({
  label,
  value,
  unit,
  reading,
  icon,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  reading: Reading;
  icon: React.ReactNode;
  accent: string;
}) {
  const stamp = readingStamp(reading.ts);
  return (
    <div
      className="rounded-2xl p-3"
      style={{ backgroundColor: "#FCFAF6", border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {label}
        </span>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2" style={{ color: TEXT, fontFamily: "Baloo 2, sans-serif", fontSize: 21, fontWeight: 700, lineHeight: 1 }}>
        {value}<span style={{ color: MUTED, fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 600 }}> {unit}</span>
      </p>
      <p className="mt-1.5 truncate" style={{ color: MUTED, fontSize: 11 }} title={`${stamp.date} · ${stamp.time}`}>
        {stamp.date} · {stamp.time}
      </p>
    </div>
  );
}

function EnvironmentalSummary({ readings, onViewTrends }: { readings: Reading[]; onViewTrends: () => void }) {
  if (readings.length === 0) return null;

  const highestTemp = readings.reduce((best, reading) => (reading.temp > best.temp ? reading : best), readings[0]);
  const lowestTemp = readings.reduce((best, reading) => (reading.temp < best.temp ? reading : best), readings[0]);
  const highestHumidity = readings.reduce((best, reading) => (reading.humidity > best.humidity ? reading : best), readings[0]);
  const lowestHumidity = readings.reduce((best, reading) => (reading.humidity < best.humidity ? reading : best), readings[0]);
  const latest = [...readings].sort((a, b) => b.ts - a.ts).slice(0, 3);

  return (
    <SectionCard
      title="Environmental readings"
      subtitle="Recorded during this incubation cycle"
      action={
        <button
          type="button"
          onClick={onViewTrends}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-[#F5EFE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ color: RUST, fontSize: 12, fontWeight: 700 }}
        >
          Full trends <ArrowUpRight size={14} />
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2.5">
        <ExtremumTile
          label="Highest temperature"
          value={highestTemp.temp.toFixed(1)}
          unit="°C"
          reading={highestTemp}
          icon={<TrendingUp size={15} />}
          accent={RUST}
        />
        <ExtremumTile
          label="Lowest temperature"
          value={lowestTemp.temp.toFixed(1)}
          unit="°C"
          reading={lowestTemp}
          icon={<TrendingDown size={15} />}
          accent={RUST}
        />
        <ExtremumTile
          label="Highest humidity"
          value={highestHumidity.humidity.toFixed(1)}
          unit="% RH"
          reading={highestHumidity}
          icon={<TrendingUp size={15} />}
          accent={RUST}
        />
        <ExtremumTile
          label="Lowest humidity"
          value={lowestHumidity.humidity.toFixed(1)}
          unit="% RH"
          reading={lowestHumidity}
          icon={<TrendingDown size={15} />}
          accent={RUST}
        />
      </div>

      <div className="mt-4 border-t pt-3.5" style={{ borderColor: BORDER }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p style={{ color: TEXT, fontSize: 13, fontWeight: 700 }}>Latest readings</p>
            <p style={{ color: MUTED, fontSize: 11 }}>Most recent three check-ins</p>
          </div>
          <span className="rounded-full px-2 py-1" style={{ backgroundColor: "#F4ECE1", color: MUTED, fontSize: 10, fontWeight: 700 }}>
            TOP 3
          </span>
        </div>
        <div className="mt-2 divide-y" style={{ borderColor: BORDER }}>
          {latest.map((reading, index) => {
            const stamp = readingStamp(reading.ts);
            return (
              <div key={reading.ts} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#F4ECE1", color: RUST, fontSize: 11, fontWeight: 800 }}>
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p style={{ color: TEXT, fontSize: 12, fontWeight: 700 }}>{stamp.time}</p>
                    <p style={{ color: MUTED, fontSize: 11 }}>{stamp.date}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3" style={{ color: MUTED, fontSize: 12, fontWeight: 600 }}>
                  <span className="inline-flex items-center gap-1"><Thermometer size={13} color={RUST} />{reading.temp.toFixed(1)}°C</span>
                  <span className="inline-flex items-center gap-1"><Droplets size={13} color={RUST} />{reading.humidity.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

interface LiveMonitorTabProps {
  unit: Incubator;
  mode: Mode;
  currentDay: number;
  totalDays: number;
  candling: CandlingCheckpoint[];
  effectiveCandled: Record<number, boolean>;
  environmentalReadings: Reading[];
  onUpdate: (patch: Partial<Incubator>) => void;
  onOpenTrends: () => void;
}

export function LiveMonitorTab({
  unit,
  mode,
  currentDay,
  totalDays,
  candling,
  effectiveCandled,
  environmentalReadings,
  onUpdate,
  onOpenTrends,
}: LiveMonitorTabProps) {
  const [earlyTurnOpen, setEarlyTurnOpen] = useState(false);
  const [syncChoice, setSyncChoice] = useState<"reset" | "maintain">("reset");

  const heaterOn = unit.temp < mode.targetTemp.max;
  const overheating = unit.temp > mode.targetTemp.max;
  const fanOn = heaterOn || overheating;
  const mistOn = unit.humidity < mode.targetHumidity.max && unit.waterOk;

  const nextTurnLabel = () => {
    const diffMin = Math.round((new Date(unit.nextTurn).getTime() - Date.now()) / 60000);
    if (diffMin < 0) return { text: `Overdue by ${Math.abs(diffMin)} min`, overdue: true };
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return { text: `in ${h > 0 ? `${h}h ` : ""}${m}m`, overdue: false };
  };
  const next = nextTurnLabel();

  const handleTurn = () => {
    if (unit.cyclePhase !== "incubating") {
      toast("Turning is stopped during this cycle phase.");
      return;
    }
    onUpdate({
      lastTurned: new Date().toISOString(),
      nextTurn: new Date(Date.now() + unit.turnInterval * 3_600_000).toISOString(),
    });
    toast.success("Egg tray turned successfully");
  };

  const confirmEarlyTurn = () => {
    const now = new Date();
    const nextTurnDate =
      syncChoice === "reset"
        ? new Date(now.getTime() + unit.turnInterval * 3_600_000).toISOString()
        : unit.nextTurn;
    onUpdate({
      lastTurned: now.toISOString(),
      nextTurn: nextTurnDate,
    });
    setEarlyTurnOpen(false);
    toast.success(
      syncChoice === "reset"
        ? "Tray turned. Schedule reset to next turn."
        : "Tray turned. Original schedule maintained."
    );
  };

  const executeTurn = () => {
    if (unit.cyclePhase !== "incubating") {
      toast("Turning is stopped during this cycle phase.");
      return;
    }
    const diffMin = Math.round((new Date(unit.nextTurn).getTime() - Date.now()) / 60000);
    if (diffMin > 30) {
      setEarlyTurnOpen(true);
      return;
    }
    handleTurn();
  };

  return (
    <div className="space-y-5">
      {/* Hero: Incubation Timeline + Current Conditions (Temp -> Humid -> Water) */}
      <SectionCard title="Incubation Timeline">
        <Timeline currentDay={currentDay} totalDays={totalDays} candling={candling} candled={effectiveCandled} />
        <div className="my-4" style={{ height: 1, backgroundColor: BORDER }} />
        <div className="grid grid-cols-1 items-start sm:grid-cols-3" style={{ gap: 24 }}>
          <GaugeDial
            value={unit.temp}
            min={30}
            max={42}
            safe={mode.targetTemp}
            unit="°C"
            label="Temperature"
            size={120}
          />
          <GaugeDial
            value={unit.humidity}
            min={20}
            max={90}
            safe={mode.targetHumidity}
            unit="%"
            label="Humidity"
            size={120}
          />
          <WaterDroplet ok={unit.waterOk} />
        </div>
      </SectionCard>

      {/* Grid: Actuators, Turning, Power */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* Actuators & Controls */}
        <SectionCard title="Actuators & Controls">
          <div className="space-y-3">
            <ActuatorRow
              icon={<Flame size={18} />}
              name="Heating Element"
              on={heaterOn}
              tone={WARN}
              label="Heating"
              offLabel="Standby"
              pulse
            />
            <ActuatorRow
              icon={<Waves size={18} />}
              name="Ultrasonic Mist Maker"
              on={mistOn}
              tone={OK}
              label="Misting"
              offLabel="Off"
            />
            <ActuatorRow
              icon={<Fan size={18} />}
              name="Circulation Fan"
              on={fanOn}
              tone={OK}
              label="Active"
              offLabel="Off"
            />
          </div>
        </SectionCard>

        {/* Egg Turning Module */}
        <SectionCard title="Egg Turning">
          <div className="flex h-full flex-col justify-between space-y-3">
            <div className="space-y-2.5">
              <div className="rounded-xl p-3" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 12, color: MUTED }}>Auto-turn schedule</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
                    Every {unit.turnInterval}h
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span style={{ fontSize: 12, color: MUTED }}>Next scheduled turn</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: next.overdue ? CRIT.fg : TEXT }}>
                    {next.text}
                  </span>
                </div>
              </div>

              <div className="rounded-xl p-3" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 12, color: MUTED }}>Last manual/auto turn</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>
                    {relTime(unit.lastTurned)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span style={{ fontSize: 12, color: MUTED }}>Tray motor status</span>
                  <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 700, color: unit.cyclePhase === "incubating" ? OK.fg : MUTED }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: unit.cyclePhase === "incubating" ? OK.fg : MUTED }} />
                    {unit.cyclePhase === "incubating" ? "Ready" : "Halted"}
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={executeTurn}
              disabled={unit.cyclePhase !== "incubating"}
              className="w-full rounded-xl transition-all"
              style={{
                backgroundColor: unit.cyclePhase === "incubating" ? RUST : "#EAE7E1",
                color: unit.cyclePhase === "incubating" ? "#FFFFFF" : "#78716C",
                fontWeight: 600,
                minHeight: 38,
              }}
            >
              <RotateCw size={15} /> Turn Tray Now
            </Button>
          </div>
        </SectionCard>

        {/* Power & Diagnostics */}
        <SectionCard title="Power & Diagnostics">
          <div className="space-y-3">
            <div className="rounded-xl p-3.5" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, color: MUTED }}>Battery backup</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: unit.batteryPct <= 25 ? CRIT.fg : TEXT }}>
                  {unit.batteryPct}%
                </span>
              </div>
              <div className="mt-2">
                <SegmentedBattery battery={unit.batteryPct} charging={unit.powerSource !== "battery"} showLabel />
              </div>
            </div>

            <div className="rounded-xl p-3.5" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, color: MUTED }}>Device ID</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>
                  {unit.deviceId}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span style={{ fontSize: 12, color: MUTED }}>Connection</span>
                <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 700, color: unit.paired ? OK.fg : CRIT.fg }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: unit.paired ? OK.fg : CRIT.fg }} />
                  {unit.paired ? "Connected" : "Offline"}
                </span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <EnvironmentalSummary readings={environmentalReadings} onViewTrends={onOpenTrends} />

      {/* Early Turn Confirmation Dialog */}
      <Dialog open={earlyTurnOpen} onOpenChange={setEarlyTurnOpen}>
        <DialogContent className="max-w-[420px] rounded-2xl p-6" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
          <DialogHeader className="text-left">
            <DialogTitle style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>Turn Tray Ahead of Schedule?</DialogTitle>
            <DialogDescription style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
              The next scheduled turn is {next.text}. Turning eggs too frequently can disrupt embryo positioning.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm text-[#1A1A1A]">
              <input
                type="radio"
                name="syncChoice"
                checked={syncChoice === "reset"}
                onChange={() => setSyncChoice("reset")}
              />
              Turn now and reset schedule to {unit.turnInterval}h from now
            </label>
            <label className="flex items-center gap-2 text-sm text-[#1A1A1A]">
              <input
                type="radio"
                name="syncChoice"
                checked={syncChoice === "maintain"}
                onChange={() => setSyncChoice("maintain")}
              />
              Turn now but keep existing schedule ({next.text})
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setEarlyTurnOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" style={{ backgroundColor: RUST, color: "#fff" }} onClick={confirmEarlyTurn}>
              Confirm Turn
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
