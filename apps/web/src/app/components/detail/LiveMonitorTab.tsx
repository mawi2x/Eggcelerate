import React from "react";
import {
  ArrowUpRight,
  BatteryMedium,
  ChevronDown,
  Droplets,
  Fan,
  Flame,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Waves,
  Wifi,
  Zap,
} from "lucide-react";
import { WifiSlash } from "@phosphor-icons/react";
import { GaugeDial } from "../GaugeDial";
import { WaterDroplet } from "../WaterDroplet";
import type { CandlingCheckpoint, Incubator, Mode, Reading } from "../../domain/types";
import {
  RUST, BORDER, TEXT, MUTED,
  OK, WARN, CRIT, NEUTRAL,
} from "./types";
import { SectionCard } from "./primitives";
import { Timeline } from "./Timeline";

type StatusTone = typeof OK;

function SystemStatusTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: StatusTone;
}) {
  return (
    <div
      className="flex min-h-16 items-center gap-3 rounded-xl px-3.5 py-3"
      style={{ backgroundColor: "#FCFAF6", border: `1px solid ${BORDER}` }}
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: tone.bg, color: tone.fg }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p
          style={{
            color: MUTED,
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-label)",
            fontWeight: "var(--weight-bold)",
            letterSpacing: "var(--tracking-label)",
            lineHeight: "var(--leading-snug)",
          }}
        >
          {label}
        </p>
        <p
          className="tabular-nums"
          style={{
            color: TEXT,
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-body-sm)",
            fontWeight: "var(--weight-bold)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          {value}
        </p>
      </div>
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
}: {
  label: string;
  value: string;
  unit: string;
  reading: Reading;
  icon: React.ReactNode;
}) {
  const stamp = readingStamp(reading.ts);
  return (
    <div className="rounded-xl px-3.5 py-3" style={{ backgroundColor: "#FCFAF6", border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" style={{ color: RUST }}>{icon}</span>
        <span
          style={{
            color: MUTED,
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-label)",
            fontWeight: "var(--weight-bold)",
            letterSpacing: "var(--tracking-label)",
            lineHeight: "var(--leading-snug)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>
      <p
        className="mt-2 tabular-nums"
        style={{
          color: TEXT,
          fontFamily: "var(--font-display)",
          fontSize: "var(--type-heading-lg)",
          fontWeight: "var(--weight-bold)",
          lineHeight: "var(--leading-tight)",
        }}
      >
        {value}
        <span
          style={{
            color: MUTED,
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-caption)",
            fontWeight: "var(--weight-semibold)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          {" "}
          {unit}
        </span>
      </p>
      <p
        className="mt-1.5 truncate"
        style={{
          color: MUTED,
          fontFamily: "var(--font-body)",
          fontSize: "var(--type-label)",
          fontWeight: "var(--weight-regular)",
          lineHeight: "var(--leading-snug)",
        }}
        title={`${stamp.date} at ${stamp.time}`}
      >
        {stamp.date} at {stamp.time}
      </p>
    </div>
  );
}

function EnvironmentalSummary({
  readings,
  mode,
  onViewTrends,
}: {
  readings: Reading[];
  mode: Mode;
  onViewTrends: () => void;
}) {
  if (readings.length === 0) return null;

  const highestTemp = readings.reduce((best, reading) => (reading.temp > best.temp ? reading : best), readings[0]);
  const lowestTemp = readings.reduce((best, reading) => (reading.temp < best.temp ? reading : best), readings[0]);
  const highestHumidity = readings.reduce((best, reading) => (reading.humidity > best.humidity ? reading : best), readings[0]);
  const lowestHumidity = readings.reduce((best, reading) => (reading.humidity < best.humidity ? reading : best), readings[0]);
  const latest = [...readings].sort((a, b) => b.ts - a.ts).slice(0, 3);

  const tempLowDelta = mode.targetTemp.min - lowestTemp.temp;
  const tempHighDelta = highestTemp.temp - mode.targetTemp.max;
  const temperatureException = tempLowDelta <= 0 && tempHighDelta <= 0
    ? null
    : tempHighDelta >= tempLowDelta
      ? { direction: "high" as const, value: highestTemp.temp }
      : { direction: "low" as const, value: lowestTemp.temp };

  const humidityLowDelta = mode.targetHumidity.min - lowestHumidity.humidity;
  const humidityHighDelta = highestHumidity.humidity - mode.targetHumidity.max;
  const humidityException = humidityLowDelta <= 0 && humidityHighDelta <= 0
    ? null
    : humidityHighDelta >= humidityLowDelta
      ? { direction: "high" as const, value: highestHumidity.humidity }
      : { direction: "low" as const, value: lowestHumidity.humidity };

  const hasExceptions = temperatureException !== null || humidityException !== null;

  return (
    <SectionCard
      title="History & trends"
      subtitle="Past readings are available when you need more context"
      action={
        <button
          type="button"
          onClick={onViewTrends}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg px-2.5 transition-colors hover:bg-[#F5EFE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ color: RUST, fontSize: 12, fontWeight: 700 }}
        >
          Full trends <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      }
    >
      <details className="group rounded-2xl" style={{ border: `1px solid ${BORDER}`, backgroundColor: "#FCFAF6" }}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p style={{ color: TEXT, fontSize: 13, fontWeight: 700 }}>
              {hasExceptions ? "Cycle exceptions" : "Cycle stability"}
            </p>
            <p className="mt-0.5 grid gap-1 tabular-nums" style={{ color: MUTED, fontSize: 12 }}>
              <span className="inline-flex items-center gap-1">
                <Thermometer size={13} aria-hidden="true" />
                {temperatureException
                  ? `Temperature went ${temperatureException.direction}: ${temperatureException.direction === "high" ? "peaked at" : "dropped to"} ${temperatureException.value.toFixed(1)}°C`
                  : "Temperature stayed within target"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Droplets size={13} aria-hidden="true" />
                {humidityException
                  ? `Humidity went ${humidityException.direction}: ${humidityException.direction === "high" ? "peaked at" : "dropped to"} ${humidityException.value.toFixed(1)}% RH`
                  : "Humidity stayed within target"}
              </span>
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5" style={{ color: RUST, fontSize: 12, fontWeight: 700 }}>
            Review history
            <ChevronDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" />
          </span>
        </summary>

        <div className="border-t p-4" style={{ borderColor: BORDER }}>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <ExtremumTile label="Highest temperature" value={highestTemp.temp.toFixed(1)} unit="°C" reading={highestTemp} icon={<TrendingUp size={15} />} />
            <ExtremumTile label="Lowest temperature" value={lowestTemp.temp.toFixed(1)} unit="°C" reading={lowestTemp} icon={<TrendingDown size={15} />} />
            <ExtremumTile label="Highest humidity" value={highestHumidity.humidity.toFixed(1)} unit="% RH" reading={highestHumidity} icon={<TrendingUp size={15} />} />
            <ExtremumTile label="Lowest humidity" value={lowestHumidity.humidity.toFixed(1)} unit="% RH" reading={lowestHumidity} icon={<TrendingDown size={15} />} />
          </div>

          <div className="mt-4 border-t pt-3" style={{ borderColor: BORDER }}>
            <p style={{ color: TEXT, fontSize: 13, fontWeight: 700 }}>Recent readings</p>
            <div className="mt-1 divide-y" style={{ borderColor: BORDER }}>
              {latest.map((reading) => {
                const stamp = readingStamp(reading.ts);
                return (
                  <div key={reading.ts} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="tabular-nums" style={{ color: TEXT, fontSize: 12, fontWeight: 700 }}>{stamp.date} at {stamp.time}</p>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums" style={{ color: MUTED, fontSize: 12, fontWeight: 600 }}>
                      <span className="inline-flex items-center gap-1"><Thermometer size={13} color={RUST} aria-hidden="true" />{reading.temp.toFixed(1)}°C</span>
                      <span className="inline-flex items-center gap-1"><Droplets size={13} color={RUST} aria-hidden="true" />{reading.humidity.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </details>
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
  onOpenTrends,
}: LiveMonitorTabProps) {
  const heaterOn = unit.temp < mode.targetTemp.max;
  const overheating = unit.temp > mode.targetTemp.max;
  const fanOn = heaterOn || overheating;
  const mistOn = unit.humidity < mode.targetHumidity.max && unit.waterOk;

  return (
    <div className="space-y-5">
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

      <SectionCard title="Chamber status" subtitle="Live systems, power, and connectivity">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SystemStatusTile
            icon={<Flame size={18} />}
            label="Heating element"
            value={heaterOn ? "Heating" : "Standby"}
            tone={heaterOn ? WARN : NEUTRAL}
          />
          <SystemStatusTile
            icon={<Waves size={18} />}
            label="Mist maker"
            value={mistOn ? "Misting" : "Off"}
            tone={mistOn ? OK : NEUTRAL}
          />
          <SystemStatusTile
            icon={<Fan size={18} />}
            label="Circulation fan"
            value={fanOn ? "Active" : "Off"}
            tone={fanOn ? OK : NEUTRAL}
          />
          <SystemStatusTile
            icon={<Zap size={18} />}
            label="Power"
            value={unit.powerSource === "battery" ? "Battery power" : "Grid power"}
            tone={unit.powerSource === "battery" ? WARN : OK}
          />
          <SystemStatusTile
            icon={unit.paired ? <Wifi size={18} /> : <WifiSlash size={18} weight="fill" />}
            label="Connection"
            value={unit.paired ? "Connected" : "Offline"}
            tone={unit.paired ? OK : CRIT}
          />
          <SystemStatusTile
            icon={<BatteryMedium size={18} />}
            label="Battery"
            value={unit.batteryPct <= 25 ? `${unit.batteryPct}% · Low` : `${unit.batteryPct}%`}
            tone={unit.batteryPct <= 25 ? CRIT : OK}
          />
        </div>
      </SectionCard>

      <EnvironmentalSummary readings={environmentalReadings} mode={mode} onViewTrends={onOpenTrends} />
    </div>
  );
}
