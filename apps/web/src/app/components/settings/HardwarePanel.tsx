import { WifiSlash } from "@phosphor-icons/react";
import { BatteryMedium, Info, Minus, Plug, Plus, Wifi } from "lucide-react";
import type { Incubator } from "../../domain/types";
import { Input } from "../ui/input";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import {
  BORDER,
  GroupLabel,
  inputClass,
  inputStyle,
  MUTED,
  PanelHeader,
  RUST,
  SettingRow,
  SURFACE,
  TEXT,
} from "./tokens";

interface Props {
  units: Incubator[];
  view: HardwarePanelView;
  onViewChange: (view: HardwarePanelView) => void;
}

export type HardwarePanelView = "devices" | "preferences";

export function HardwarePanel({ units, view, onViewChange }: Props) {
  return (
    <div>
      <PanelHeader
        id="settings-panel-hardware"
        title="Hardware & Devices"
        description="Pairing, sensor checks, and calibration for all incubators."
      />

      <SegmentedControl
        role="tablist"
        aria-label="Hardware settings sections"
        className="mt-5 w-full md:w-auto"
        flush
      >
        <SegmentedControlItem
          id="hardware-devices-tab"
          role="tab"
          aria-selected={view === "devices"}
          aria-controls="hardware-devices-panel"
          active={view === "devices"}
          flush
          className="flex-1 md:flex-none"
          onClick={() => onViewChange("devices")}
        >
          Paired devices ({units.length})
        </SegmentedControlItem>
        <SegmentedControlItem
          id="hardware-preferences-tab"
          role="tab"
          aria-selected={view === "preferences"}
          aria-controls="hardware-preferences-panel"
          active={view === "preferences"}
          flush
          className="flex-1 md:flex-none"
          onClick={() => onViewChange("preferences")}
        >
          Device preferences
        </SegmentedControlItem>
      </SegmentedControl>

      {view === "devices" ? (
        <div
          id="hardware-devices-panel"
          role="tabpanel"
          aria-labelledby="hardware-devices-tab"
          className="pt-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <GroupLabel>Paired Devices</GroupLabel>
            {units.length > 0 && (
              <span style={{ color: MUTED, fontSize: "var(--type-caption)" }}>
                {
                  units.filter(
                    (unit) =>
                      unit.paired && unit.connectionState === "connected",
                  ).length
                }{" "}
                of {units.length} online
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {units.map((unit) => {
              const online =
                unit.paired && unit.connectionState === "connected";
              return (
                <div
                  key={unit.id}
                  className="flex min-w-0 items-center gap-3 rounded-[var(--radius-compact)] p-2"
                  style={{
                    border: `var(--border-width-hairline) solid ${BORDER}`,
                  }}
                >
                  <span
                    className="flex shrink-0 items-center justify-center rounded-xl"
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: online
                        ? "var(--wash-brand-10)"
                        : "var(--surface-neutral)",
                      color: online ? RUST : MUTED,
                    }}
                  >
                    {online ? (
                      <Wifi size={15} />
                    ) : (
                      <WifiSlash size={15} weight="fill" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="break-words"
                      style={{
                        fontSize: "var(--type-body)",
                        fontWeight: "var(--weight-semibold)",
                        color: TEXT,
                      }}
                    >
                      {unit.name}
                    </p>
                    <p
                      className="break-all"
                      style={{ fontSize: "var(--type-caption)", color: MUTED }}
                    >
                      {unit.deviceId}
                    </p>
                  </div>
                  <span
                    className="hidden shrink-0 items-center gap-1.5 xl:flex"
                    style={{ fontSize: "var(--type-caption)", color: MUTED }}
                  >
                    {unit.powerSource === "battery" ? (
                      <BatteryMedium size={15} />
                    ) : (
                      <Plug size={15} />
                    )}
                    {unit.powerSource === "battery"
                      ? `${unit.batteryPct}%`
                      : "Mains"}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5"
                    style={{
                      backgroundColor: online
                        ? "var(--status-success-bg)"
                        : "var(--surface-neutral)",
                      color: online ? "var(--status-success-fg)" : MUTED,
                      fontSize: "var(--type-label)",
                      fontWeight: "var(--weight-bold)",
                    }}
                  >
                    {unit.connectionState === "connecting"
                      ? "Connecting"
                      : online
                        ? "Online"
                        : "Offline"}
                  </span>
                </div>
              );
            })}
            {units.length === 0 && (
              <div
                className="rounded-[var(--radius-dialog)] px-5 py-10 text-center md:col-span-2"
                style={{
                  backgroundColor: "var(--surface-app)",
                  border: `var(--border-width-hairline) dashed ${BORDER}`,
                }}
              >
                <p
                  style={{
                    fontWeight: "var(--weight-bold)",
                    color: TEXT,
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--type-page-title)",
                    lineHeight: "var(--leading-snug)",
                  }}
                >
                  No devices paired yet
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          id="hardware-preferences-panel"
          role="tabpanel"
          aria-labelledby="hardware-preferences-tab"
          className="grid grid-cols-1 gap-4 pt-5"
        >
          <p
            id="hardware-unavailable"
            className="text-sm"
            style={{ color: MUTED }}
          >
            Hardware preferences are not available yet. The values below are
            previews, not confirmed device settings.
          </p>
          <section
            aria-labelledby="hardware-group-sampling"
            className="rounded-[var(--radius-dialog)] p-4"
            style={{ border: `var(--border-width-hairline) solid ${BORDER}` }}
          >
            <GroupLabel id="hardware-group-sampling">
              Sensor & Sampling
            </GroupLabel>
            <div className="mt-1">
              <SettingRow
                label="Sensor Sampling Interval"
                hint="How often each controller reports temperature and humidity."
                layout="stacked"
                control={
                  <Select value="30" disabled>
                    <SelectTrigger
                      aria-label="Sensor Sampling Interval"
                      aria-describedby="hardware-unavailable"
                      className={`${inputClass} w-full sm:w-[180px]`}
                      style={inputStyle}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">Every 10 seconds</SelectItem>
                      <SelectItem value="30">Every 30 seconds</SelectItem>
                      <SelectItem value="60">Every minute</SelectItem>
                      <SelectItem value="300">Every 5 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
              <SettingRow
                label="Research Logging Interval"
                hint="Stored research records use a fixed five minute interval."
                control={
                  <span
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: "var(--surface-tile)",
                      color: MUTED,
                      border: `var(--border-width-hairline) solid ${BORDER}`,
                    }}
                  >
                    5 min · Fixed
                  </span>
                }
              />
              <SettingRow
                label="Battery saver mode"
                hint="Halves the sampling rate when a chamber runs on battery."
                borderless
                control={
                  <Switch
                    checked={false}
                    disabled
                    aria-describedby="hardware-unavailable"
                    aria-label="Battery saver mode"
                  />
                }
              />
            </div>
          </section>

          <section
            aria-labelledby="hardware-group-calibration"
            className="rounded-[var(--radius-dialog)] p-4"
            style={{ border: `var(--border-width-hairline) solid ${BORDER}` }}
          >
            <GroupLabel id="hardware-group-calibration">
              Advanced and Calibration
            </GroupLabel>
            <div
              className="mt-2.5 flex items-start gap-2.5 rounded-xl p-3"
              style={{
                backgroundColor: "var(--surface-tile)",
                border: `var(--border-width-hairline) solid ${BORDER}`,
              }}
            >
              <Info
                size={16}
                className="mt-0.5 shrink-0"
                style={{ color: "var(--status-info-fg)" }}
                aria-hidden="true"
              />
              <p
                style={{
                  color: MUTED,
                  fontSize: "var(--type-caption)",
                  lineHeight: "var(--leading-snug)",
                }}
              >
                Calibration is unavailable until device configuration is
                supported. No offset is being applied by this control.
              </p>
            </div>
            <div className="mt-2">
              <SettingRow
                label="Temperature Calibration Offset"
                hint="Preview offset in °C. Changes cannot be saved or applied yet."
                htmlFor="calibration"
                layout="stacked"
                borderless
                control={
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    <div
                      className="flex items-center rounded-xl border"
                      style={{
                        borderColor: "var(--input-border)",
                        backgroundColor: SURFACE,
                      }}
                    >
                      <button
                        type="button"
                        disabled
                        aria-label="Decrease offset by 0.1"
                        className="flex h-10 w-9 items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none"
                      >
                        <Minus size={14} />
                      </button>
                      <Input
                        id="calibration"
                        type="number"
                        step={0.1}
                        min={-10}
                        max={10}
                        value="0"
                        disabled
                        aria-describedby="hardware-unavailable"
                        className="h-10 w-16 border-0 bg-transparent px-1 text-center font-semibold focus-visible:ring-0"
                        style={{
                          color: TEXT,
                          fontSize: "var(--type-control-value)",
                        }}
                      />
                      <span
                        className="pr-2 text-xs"
                        style={{ color: MUTED }}
                        aria-hidden="true"
                      >
                        °C
                      </span>
                      <button
                        type="button"
                        disabled
                        aria-label="Increase offset by 0.1"
                        className="flex h-10 w-9 items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled
                      aria-describedby="hardware-unavailable"
                      className="min-h-10 min-w-16 cursor-not-allowed rounded-xl px-3 py-1.5 opacity-60"
                      style={{
                        backgroundColor: "var(--surface-tile)",
                        color: MUTED,
                        fontSize: "var(--type-caption)",
                        fontWeight: "var(--weight-bold)",
                        border: `var(--border-width-hairline) solid ${BORDER}`,
                      }}
                    >
                      Unavailable
                    </button>
                  </div>
                }
              />
            </div>
          </section>

          <section
            aria-labelledby="hardware-group-display"
            className="rounded-[var(--radius-dialog)] p-4"
            style={{ border: `var(--border-width-hairline) solid ${BORDER}` }}
          >
            <GroupLabel id="hardware-group-display">
              Hardware Display
            </GroupLabel>
            <div className="mt-1">
              <SettingRow
                label="Status LED indicators"
                hint="Physical light ring on the controller housing."
                borderless
                control={
                  <Switch
                    checked={true}
                    disabled
                    aria-describedby="hardware-unavailable"
                    aria-label="Status LED indicators"
                  />
                }
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
