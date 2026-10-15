import { WifiSlash } from "@phosphor-icons/react";
import { Wifi } from "lucide-react";
import type { SettingsPreferences } from "../../data/settings";
import type { Incubator } from "../../domain/types";
import { EmptyState } from "../EmptyState";
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
import {
  BORDER,
  GroupLabel,
  inputClass,
  inputStyle,
  MUTED,
  PanelHeader,
  RUST,
  SETTINGS_SEGMENT_LABEL_STYLE,
  SettingRow,
  TEXT,
} from "./tokens";

interface Props {
  units: Incubator[];
  samplingIntervalSeconds?: SettingsPreferences["samplingIntervalSeconds"];
  onSamplingIntervalChange?: (
    value: NonNullable<SettingsPreferences["samplingIntervalSeconds"]>,
  ) => void;
  view: HardwarePanelView;
  onViewChange: (view: HardwarePanelView) => void;
  onOpenUnit: (id: string) => void;
}

export type HardwarePanelView = "devices" | "preferences";

export function HardwarePanel({
  units,
  samplingIntervalSeconds = 15,
  onSamplingIntervalChange,
  view,
  onViewChange,
  onOpenUnit,
}: Props) {
  return (
    <div>
      <PanelHeader
        id="settings-panel-hardware"
        title="Hardware & Devices"
        description="Pairing and sensor reporting for all incubators."
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
          style={SETTINGS_SEGMENT_LABEL_STYLE}
          onClick={() => onViewChange("devices")}
        >
          Paired devices
        </SegmentedControlItem>
        <SegmentedControlItem
          id="hardware-preferences-tab"
          role="tab"
          aria-selected={view === "preferences"}
          aria-controls="hardware-preferences-panel"
          active={view === "preferences"}
          flush
          className="flex-1 md:flex-none"
          style={SETTINGS_SEGMENT_LABEL_STYLE}
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
                <button
                  type="button"
                  key={unit.id}
                  aria-label={`Open ${unit.name} incubator`}
                  onClick={() => onOpenUnit(unit.id)}
                  className="flex min-w-0 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-compact)] p-2 text-left transition-colors hover:bg-[var(--surface-app)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
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
                </button>
              );
            })}
            {units.length === 0 && (
              <div className="md:col-span-2">
                <EmptyState
                  size="compact"
                  title="No devices paired yet"
                  description="Paired incubators will appear here with their connection status."
                />
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
            aria-labelledby="hardware-group-sampling"
            className="rounded-[var(--radius-dialog)] p-4"
            style={{ border: `var(--border-width-hairline) solid ${BORDER}` }}
          >
            <GroupLabel id="hardware-group-sampling">
              Sensor & Sampling
            </GroupLabel>
            <div className="mt-1">
              <SettingRow
                label="Sensor Reporting Interval"
                hint="Choose how often controllers upload readings. Applies after their next upload with updated firmware."
                layout="stacked"
                control={
                  <Select
                    value={String(samplingIntervalSeconds)}
                    onValueChange={(value) =>
                      onSamplingIntervalChange?.(
                        Number(value) as NonNullable<
                          SettingsPreferences["samplingIntervalSeconds"]
                        >,
                      )
                    }
                    disabled={!onSamplingIntervalChange}
                  >
                    <SelectTrigger
                      aria-label="Sensor Reporting Interval"
                      className={`${inputClass} w-full sm:w-[180px]`}
                      style={inputStyle}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Every 5 seconds</SelectItem>
                      <SelectItem value="10">Every 10 seconds</SelectItem>
                      <SelectItem value="15">Every 15 seconds</SelectItem>
                      <SelectItem value="30">Every 30 seconds</SelectItem>
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
                    Fixed at 5 minutes
                  </span>
                }
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
