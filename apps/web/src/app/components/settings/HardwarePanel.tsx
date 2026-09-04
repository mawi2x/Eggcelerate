import { WifiSlash } from "@phosphor-icons/react";
import { BatteryMedium, Plug, Wifi } from "lucide-react";
import { useState } from "react";
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
  TEXT,
} from "./tokens";

interface Props {
  units: Incubator[];
  view: HardwarePanelView;
  onViewChange: (view: HardwarePanelView) => void;
}

export type HardwarePanelView = "devices" | "preferences";

export function HardwarePanel({ units, view, onViewChange }: Props) {
  const [ledIndicators, setLedIndicators] = useState(true);
  const [batterySaver, setBatterySaver] = useState(false);
  const [pollInterval, setPollInterval] = useState("30");
  const [calibration, setCalibration] = useState("0");
  const [calibrationSaved, setCalibrationSaved] = useState(false);

  return (
    <div>
      <PanelHeader
        title="Hardware & Devices"
        description="Paired controllers, sensor sampling, and calibration across every incubator."
      />

      <SegmentedControl
        role="tablist"
        aria-label="Hardware settings sections"
        className="mt-5 w-full sm:w-auto"
      >
        <SegmentedControlItem
          id="hardware-devices-tab"
          role="tab"
          aria-selected={view === "devices"}
          aria-controls="hardware-devices-panel"
          active={view === "devices"}
          size="toolbar"
          className="flex-1 sm:flex-none"
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
          size="toolbar"
          className="flex-1 sm:flex-none"
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
              <span className="text-xs" style={{ color: MUTED }}>
                {
                  units.filter(
                    (unit) =>
                      unit.paired && unit.connectionState === "connected",
                  ).length
                }{" "}
                online · {units.length} total
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {units.map((unit) => {
              const online =
                unit.paired && unit.connectionState === "connected";
              return (
                <div
                  key={unit.id}
                  className="flex min-w-0 items-center gap-3 rounded-xl p-3"
                  style={{ border: `1px solid ${BORDER}` }}
                >
                  <span
                    className="flex shrink-0 items-center justify-center rounded-xl"
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: online
                        ? "rgba(200,90,50,0.10)"
                        : "#F5F5F4",
                      color: online ? RUST : MUTED,
                    }}
                  >
                    {online ? (
                      <Wifi size={17} />
                    ) : (
                      <WifiSlash size={17} weight="fill" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate"
                      style={{ fontSize: 14, fontWeight: 600, color: TEXT }}
                    >
                      {unit.name}
                    </p>
                    <p
                      className="truncate"
                      style={{ fontSize: 12, color: MUTED }}
                    >
                      {unit.deviceId}
                    </p>
                  </div>
                  <span
                    className="hidden shrink-0 items-center gap-1.5 xl:flex"
                    style={{ fontSize: 12, color: MUTED }}
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
                      backgroundColor: online ? "#DCFCE7" : "#F5F5F4",
                      color: online ? "#15803D" : MUTED,
                      fontSize: 11,
                      fontWeight: 700,
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
                className="rounded-2xl px-5 py-10 text-center md:col-span-2"
                style={{
                  backgroundColor: "#FAF6F0",
                  border: `1px dashed ${BORDER}`,
                }}
              >
                <p style={{ fontWeight: 700, color: TEXT }}>
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
          <section
            className="rounded-2xl p-4"
            style={{ border: `1px solid ${BORDER}` }}
          >
            <GroupLabel>Sensor & Sampling</GroupLabel>
            <div className="mt-1">
              <SettingRow
                label="Sensor Sampling Interval"
                hint="How often each controller reports temperature and humidity."
                control={
                  <Select value={pollInterval} onValueChange={setPollInterval}>
                    <SelectTrigger
                      className={`${inputClass} w-[150px]`}
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
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
                    Every 5 minutes
                  </span>
                }
              />
              <SettingRow
                label="Battery saver mode"
                hint="Halves the sampling rate when a chamber runs on battery."
                control={
                  <Switch
                    checked={batterySaver}
                    onCheckedChange={(value) => setBatterySaver(Boolean(value))}
                    aria-label="Battery saver mode"
                  />
                }
              />
            </div>
          </section>

          <section
            className="rounded-2xl p-4"
            style={{ border: `1px solid ${BORDER}` }}
          >
            <GroupLabel>Advanced and Calibration</GroupLabel>
            <p
              className="mt-2"
              style={{ color: MUTED, fontSize: 12, lineHeight: 1.5 }}
            >
              Calibration changes every temperature record. Use a trusted
              reference thermometer before saving an offset.
            </p>
            <div className="mt-2">
              <SettingRow
                label="Temperature Calibration Offset"
                hint="Applied to every temperature reading, in °C."
                htmlFor="calibration"
                control={
                  <div className="flex items-center gap-2">
                    <Input
                      id="calibration"
                      type="number"
                      step={0.1}
                      min={-10}
                      max={10}
                      value={calibration}
                      onChange={(event) => {
                        setCalibration(event.target.value);
                        setCalibrationSaved(false);
                      }}
                      className={`${inputClass} w-[110px]`}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setCalibrationSaved(true)}
                      className="cursor-pointer rounded-lg px-2.5 py-1.5 transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
                      style={{
                        backgroundColor: calibrationSaved
                          ? "#DCFCE7"
                          : "#F2EEE5",
                        color: calibrationSaved ? "#166534" : RUST,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {calibrationSaved ? "Saved" : "Save"}
                    </button>
                  </div>
                }
              />
            </div>
          </section>

          <section
            className="rounded-2xl p-4"
            style={{ border: `1px solid ${BORDER}` }}
          >
            <GroupLabel>Hardware Display</GroupLabel>
            <div className="mt-1">
              <SettingRow
                label="Status LED indicators"
                hint="Physical light ring on the controller housing."
                control={
                  <Switch
                    checked={ledIndicators}
                    onCheckedChange={(value) =>
                      setLedIndicators(Boolean(value))
                    }
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
