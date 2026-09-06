import {
  BatteryPlus,
  Fan,
  Flame,
  Lightning,
  Waves,
  WifiHigh,
  WifiSlash,
} from "@phosphor-icons/react";
import {
  ArrowUpRight,
  ChevronDown,
  Droplets,
  Thermometer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type React from "react";
import type {
  CandlingCheckpoint,
  Incubator,
  Mode,
  Reading,
} from "../../domain/types";
import { GaugeDial } from "../GaugeDial";
import { useIsMobile } from "../ui/use-mobile";
import { WaterDroplet } from "../WaterDroplet";
import { SectionCard } from "./primitives";
import { Timeline } from "./Timeline";

type StatusTone = { fg: string; bg: string; ring: string };

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
      className="flex min-h-[50px] items-center gap-2 rounded-xl px-2.5 py-2 md:min-h-16 md:gap-3 md:px-3.5 md:py-3"
      style={{
        backgroundColor: "var(--surface-porcelain)",
        border: `1px solid var(--border-default)`,
      }}
    >
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm [&>svg]:size-4 md:h-9 md:w-9 md:text-base md:[&>svg]:size-[18px]"
        style={{ backgroundColor: tone.bg, color: tone.fg }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="break-words"
          style={{
            color: "var(--text-secondary)",
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
          className="tabular-nums break-words font-bold text-(length:--type-caption) md:text-(length:--type-body-sm)"
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
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
    date: date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    shortDate: date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    }),
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
    <div
      className="rounded-xl px-3 py-2 md:px-3.5 md:py-3"
      style={{
        backgroundColor: "var(--surface-porcelain)",
        border: `1px solid var(--border-default)`,
      }}
    >
      <div className="flex items-center gap-1.5 md:gap-2">
        <span
          aria-hidden="true"
          className="shrink-0"
          style={{ color: "var(--brand-primary)" }}
        >
          {icon}
        </span>
        <span
          className="min-w-0"
          style={{
            color: "var(--text-secondary)",
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
        className="mt-1.5 tabular-nums text-(length:--type-heading-sm) md:mt-2 md:text-(length:--type-heading-lg)"
        style={{
          color: "var(--text-primary)",
          fontFamily: "var(--font-display)",
          fontWeight: "var(--weight-bold)",
          lineHeight: "var(--leading-tight)",
        }}
      >
        {value}
        <span
          style={{
            color: "var(--text-secondary)",
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
        className="mt-1 break-words md:mt-1.5"
        style={{
          color: "var(--text-secondary)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--type-label)",
          fontWeight: "var(--weight-regular)",
          lineHeight: "var(--leading-snug)",
        }}
        title={`${stamp.date} at ${stamp.time}`}
      >
        <span className="md:hidden">
          {stamp.shortDate} at {stamp.time}
        </span>
        <span className="hidden md:inline">
          {stamp.date} at {stamp.time}
        </span>
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

  const highestTemp = readings.reduce(
    (best, reading) => (reading.temp > best.temp ? reading : best),
    readings[0],
  );
  const lowestTemp = readings.reduce(
    (best, reading) => (reading.temp < best.temp ? reading : best),
    readings[0],
  );
  const highestHumidity = readings.reduce(
    (best, reading) => (reading.humidity > best.humidity ? reading : best),
    readings[0],
  );
  const lowestHumidity = readings.reduce(
    (best, reading) => (reading.humidity < best.humidity ? reading : best),
    readings[0],
  );
  const latest = [...readings].sort((a, b) => b.ts - a.ts).slice(0, 3);

  const tempLowDelta = mode.targetTemp.min - lowestTemp.temp;
  const tempHighDelta = highestTemp.temp - mode.targetTemp.max;
  const temperatureException =
    tempLowDelta <= 0 && tempHighDelta <= 0
      ? null
      : tempHighDelta >= tempLowDelta
        ? { direction: "high" as const, value: highestTemp.temp }
        : { direction: "low" as const, value: lowestTemp.temp };

  const humidityLowDelta = mode.targetHumidity.min - lowestHumidity.humidity;
  const humidityHighDelta = highestHumidity.humidity - mode.targetHumidity.max;
  const humidityException =
    humidityLowDelta <= 0 && humidityHighDelta <= 0
      ? null
      : humidityHighDelta >= humidityLowDelta
        ? { direction: "high" as const, value: highestHumidity.humidity }
        : { direction: "low" as const, value: lowestHumidity.humidity };

  const hasExceptions =
    temperatureException !== null || humidityException !== null;

  return (
    <SectionCard
      title="History & trends"
      subtitle="Past readings are available when you need more context"
      action={
        <button
          type="button"
          onClick={onViewTrends}
          className="inline-flex min-h-[var(--control-height-default)] cursor-pointer items-center gap-1 rounded-lg px-2.5 transition-colors hover:bg-[var(--surface-track)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 md:min-h-9"
          style={{
            color: "var(--brand-primary)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-caption)",
            fontWeight: "var(--weight-bold)",
          }}
        >
          Full trends <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      }
    >
      <details
        className="group scroll-mt-24 scroll-mb-[var(--mobile-bottom-nav-clearance)] rounded-2xl"
        style={{
          border: `1px solid var(--border-default)`,
          backgroundColor: "var(--surface-porcelain)",
        }}
        onToggle={(e) => {
          // Expanding pushes content below the fold behind the bottom nav —
          // glide the revealed region into view (same pattern as the
          // chamber dot-nav). Focus stays on the summary.
          const el = e.currentTarget;
          if (!el.open) return;
          const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          requestAnimationFrame(() => {
            el.scrollIntoView({
              behavior: reduceMotion ? "auto" : "smooth",
              block: "nearest",
            });
          });
        }}
      >
        <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 max-[19rem]:justify-start">
            <p
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-body-sm)",
                fontWeight: "var(--weight-bold)",
              }}
            >
              {hasExceptions ? "Cycle exceptions" : "Cycle stability"}
            </p>
            <span
              className="inline-flex shrink-0 items-center gap-1.5"
              style={{
                color: "var(--brand-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-bold)",
              }}
            >
              Review history
              <ChevronDown
                size={16}
                aria-hidden="true"
                className="transition-transform group-open:rotate-180"
              />
            </span>
          </div>

          <p
            className="mt-1 grid gap-1 tabular-nums"
            style={{
              color: "var(--text-secondary)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-caption)",
            }}
          >
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
        </summary>

        <div
          className="border-t p-4"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="grid grid-cols-2 gap-2 md:gap-2.5 lg:grid-cols-4">
            <ExtremumTile
              label="Highest temperature"
              value={highestTemp.temp.toFixed(1)}
              unit="°C"
              reading={highestTemp}
              icon={<TrendingUp size={15} />}
            />
            <ExtremumTile
              label="Lowest temperature"
              value={lowestTemp.temp.toFixed(1)}
              unit="°C"
              reading={lowestTemp}
              icon={<TrendingDown size={15} />}
            />
            <ExtremumTile
              label="Highest humidity"
              value={highestHumidity.humidity.toFixed(1)}
              unit="% RH"
              reading={highestHumidity}
              icon={<TrendingUp size={15} />}
            />
            <ExtremumTile
              label="Lowest humidity"
              value={lowestHumidity.humidity.toFixed(1)}
              unit="% RH"
              reading={lowestHumidity}
              icon={<TrendingDown size={15} />}
            />
          </div>

          <div
            className="mt-4 border-t pt-3"
            style={{ borderColor: "var(--border-default)" }}
          >
            <p
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-body-sm)",
                fontWeight: "var(--weight-bold)",
              }}
            >
              Recent readings
            </p>
            <div
              className="mt-1 divide-y"
              style={{ borderColor: "var(--border-default)" }}
            >
              {latest.map((reading) => {
                const stamp = readingStamp(reading.ts);
                return (
                  <div
                    key={reading.ts}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 md:py-2.5"
                  >
                    <div>
                      <p
                        className="tabular-nums"
                        style={{
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--type-caption)",
                          fontWeight: "var(--weight-bold)",
                        }}
                      >
                        {stamp.date} at {stamp.time}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-3 tabular-nums"
                      style={{
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-caption)",
                        fontWeight: "var(--weight-semibold)",
                      }}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Thermometer
                          size={13}
                          color={"var(--brand-primary)"}
                          aria-hidden="true"
                        />
                        {reading.temp.toFixed(1)}°C
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Droplets
                          size={13}
                          color={"var(--brand-primary)"}
                          aria-hidden="true"
                        />
                        {reading.humidity.toFixed(1)}%
                      </span>
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
  const isMobile = useIsMobile();
  const dialSize = isMobile ? 96 : 120;
  const heaterOn = unit.temp < mode.targetTemp.max;
  const overheating = unit.temp > mode.targetTemp.max;
  const fanOn = heaterOn || overheating;
  const mistOn = unit.humidity < mode.targetHumidity.max && unit.waterOk;

  return (
    <div className="space-y-5">
      <SectionCard title="Incubation Timeline">
        <Timeline
          currentDay={currentDay}
          totalDays={totalDays}
          candling={candling}
          candled={effectiveCandled}
          labelSize={9}
        />
        <div
        className="my-2.5 md:my-4"
          style={{ height: 1, backgroundColor: "var(--border-default)" }}
        />
        <div className="grid grid-cols-3 items-start gap-2 md:gap-6">
          <GaugeDial
            value={unit.temp}
            min={30}
            max={42}
            safe={mode.targetTemp}
            unit="°C"
            label="Temperature"
            size={dialSize}
          />
          <GaugeDial
            value={unit.humidity}
            min={20}
            max={90}
            safe={mode.targetHumidity}
            unit="%"
            label="Humidity"
            size={dialSize}
          />
          <WaterDroplet ok={unit.waterOk} size={dialSize} />
        </div>
      </SectionCard>

      <SectionCard
        title="Chamber status"
        subtitle="Live systems, power, and connectivity"
      >
        <div className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-3">
          <SystemStatusTile
            icon={<Flame size={18} weight="fill" />}
            label="Heating element"
            value={heaterOn ? "Heating" : "Standby"}
            tone={
              heaterOn
                ? {
                    fg: "var(--status-warning-fg)",
                    bg: "var(--status-warning-bg)",
                    ring: "var(--status-warning-fg)",
                  }
                : {
                    fg: "var(--text-secondary)",
                    bg: "var(--surface-subtle)",
                    ring: "var(--border-default)",
                  }
            }
          />
          <SystemStatusTile
            icon={<Waves size={18} weight="fill" />}
            label="Mist maker"
            value={mistOn ? "Misting" : "Off"}
            tone={
              mistOn
                ? {
                    fg: "var(--status-success-fg)",
                    bg: "var(--status-success-bg)",
                    ring: "var(--status-success-fg)",
                  }
                : {
                    fg: "var(--text-secondary)",
                    bg: "var(--surface-subtle)",
                    ring: "var(--border-default)",
                  }
            }
          />
          <SystemStatusTile
            icon={<Fan size={18} weight="fill" />}
            label="Circulation fan"
            value={fanOn ? "Active" : "Off"}
            tone={
              fanOn
                ? {
                    fg: "var(--status-success-fg)",
                    bg: "var(--status-success-bg)",
                    ring: "var(--status-success-fg)",
                  }
                : {
                    fg: "var(--text-secondary)",
                    bg: "var(--surface-subtle)",
                    ring: "var(--border-default)",
                  }
            }
          />
          <SystemStatusTile
            icon={<Lightning size={18} weight="fill" />}
            label="Power"
            value={
              unit.powerSource === "battery" ? "Battery power" : "Grid power"
            }
            tone={
              unit.powerSource === "battery"
                ? {
                    fg: "var(--status-warning-fg)",
                    bg: "var(--status-warning-bg)",
                    ring: "var(--status-warning-fg)",
                  }
                : {
                    fg: "var(--status-success-fg)",
                    bg: "var(--status-success-bg)",
                    ring: "var(--status-success-fg)",
                  }
            }
          />
          <SystemStatusTile
            icon={
              unit.paired ? (
                <WifiHigh size={18} weight="fill" />
              ) : (
                <WifiSlash size={18} weight="fill" />
              )
            }
            label="Connection"
            value={unit.paired ? "Connected" : "Offline"}
            tone={
              unit.paired
                ? {
                    fg: "var(--status-success-fg)",
                    bg: "var(--status-success-bg)",
                    ring: "var(--status-success-fg)",
                  }
                : {
                    fg: "var(--status-danger-fg)",
                    bg: "var(--status-danger-bg)",
                    ring: "var(--status-danger-fg)",
                  }
            }
          />
          <SystemStatusTile
            icon={<BatteryPlus size={18} weight="fill" />}
            label="Battery"
            value={
              unit.batteryPct <= 25
                ? `${unit.batteryPct}% · Low`
                : `${unit.batteryPct}%`
            }
            tone={
              unit.batteryPct <= 25
                ? {
                    fg: "var(--status-danger-fg)",
                    bg: "var(--status-danger-bg)",
                    ring: "var(--status-danger-fg)",
                  }
                : {
                    fg: "var(--status-success-fg)",
                    bg: "var(--status-success-bg)",
                    ring: "var(--status-success-fg)",
                  }
            }
          />
        </div>
      </SectionCard>

      <EnvironmentalSummary
        readings={environmentalReadings}
        mode={mode}
        onViewTrends={onOpenTrends}
      />
    </div>
  );
}
