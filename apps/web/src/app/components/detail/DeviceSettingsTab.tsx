import { Egg, WifiSlash } from "@phosphor-icons/react";
import { ChevronRight, RotateCw, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type {
  CandlingCheckpoint,
  Incubator,
  Mode,
  TurnCommandStatus,
} from "../../domain/types";
import type { IncubatorUpdateIntent } from "../../features/farm/use-farm-data";
import { IncubatingIcon } from "../icons";
import { getConnectionPresentation } from "../statusPresentation";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
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
import { KeyValue, StatusCallout } from "./primitives";
import { StopCycleModal } from "./StopCycleModal";
import { relTime } from "./types";

interface DeviceSettingsTabProps {
  unit: Incubator;
  modes: Mode[];
  candling: CandlingCheckpoint[];
  isReady: boolean;
  cycleEnded: boolean;
  turningStopped: boolean;
  isUpdating: boolean;
  isRequestingTurn: boolean;
  turnCommandStatus?: TurnCommandStatus;
  onUpdate: (intent: IncubatorUpdateIntent) => Promise<boolean>;
  onStopCycle: () => Promise<boolean>;
  onTurnClick: () => Promise<boolean>;
}

export function DeviceSettingsTab({
  unit,
  modes,
  candling,
  isReady,
  cycleEnded,
  turningStopped,
  isUpdating,
  isRequestingTurn,
  turnCommandStatus,
  onUpdate,
  onStopCycle,
  onTurnClick,
}: DeviceSettingsTabProps) {
  const [settingTab, setSettingTab] = useState<"mode" | "turning" | "device">(
    "mode",
  );
  const [stopCycleOpen, setStopCycleOpen] = useState(false);

  const mode = modes.find((m) => m.id === unit.modeId) ?? modes[0];
  const connection = getConnectionPresentation(unit);

  const changeMode = async (modeId: string) => {
    const m = modes.find((x) => x.id === modeId);
    if (!m) return;
    if (
      !(await onUpdate({
        type: "configuration",
        input: {
          modeId,
          turnIntervalHours: m.defaultTurnInterval,
        },
      }))
    )
      return;
    toast(`Mode changed to ${m.name}`, {
      description: "Turning interval reset to mode default.",
    });
  };

  const reconnectDevice = async () => {
    toast("Reconnecting to incubator...", {
      description: `Attempting handshake with ${unit.deviceId}`,
    });
    if (!(await onUpdate({ type: "reconnect" }))) return;
    toast.success("Connected", {
      description: `${unit.name} paired successfully.`,
    });
  };

  const nextTurnLabel = () => {
    const diffMin = Math.round(
      (new Date(unit.nextTurn).getTime() - Date.now()) / 60000,
    );
    if (diffMin < 0)
      return { text: `Overdue by ${Math.abs(diffMin)} min`, overdue: true };
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return { text: `in ${h > 0 ? `${h}h ` : ""}${m}m`, overdue: false };
  };
  const next = nextTurnLabel();
  const turnInProgress =
    turnCommandStatus === "pending" || turnCommandStatus === "dispatched";

  const outlineBtn = {
    borderColor: "var(--border-default)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-card)",
  };

  return (
    <>
      {/* Settings sub-tabs live inside the card as a segmented control. */}
      <section
        aria-labelledby={
          settingTab === "mode"
            ? "device-settings-mode-title"
            : settingTab === "turning"
              ? "device-settings-turning-title"
              : "device-settings-device-title"
        }
        className="min-w-0 rounded-2xl p-4 md:p-6"
        style={{
          backgroundColor: "var(--surface-card)",
          borderRadius: "var(--radius-card)",
          border: "var(--border-width-hairline) solid var(--border-default)",
        }}
      >
        <fieldset
          className="mb-4 w-full min-w-0 border-0 p-0"
          aria-label="Device settings"
        >
          <SegmentedControl flush className="w-full">
            {[
              {
                id: "mode" as const,
                label: "Incubation mode",
                mobileLabel: "Mode",
                Icon: IncubatingIcon,
              },
              {
                id: "turning" as const,
                label: "Turning schedule",
                mobileLabel: "Turning",
                Icon: RotateCw,
              },
              {
                id: "device" as const,
                label: "Device & connection",
                mobileLabel: "Device",
                Icon: Zap,
              },
            ].map(({ id, label, mobileLabel, Icon }) => {
              const isActive = settingTab === id;
              return (
                <SegmentedControlItem
                  key={id}
                  flush
                  active={isActive}
                  aria-pressed={isActive}
                  aria-controls={`device-settings-${id}-panel`}
                  onClick={() => setSettingTab(id)}
                  className="min-w-0 flex-1"
                >
                  <Icon
                    size={16}
                    strokeWidth={isActive ? 2.5 : 2}
                    className="shrink-0"
                  />
                  <span className="min-w-0 truncate lg:hidden">
                    {mobileLabel}
                  </span>
                  <span className="hidden min-w-0 truncate lg:inline">
                    {label}
                  </span>
                </SegmentedControlItem>
              );
            })}
          </SegmentedControl>
        </fieldset>
        {settingTab === "mode" && (
          <div id="device-settings-mode-panel">
            <div
              className="pb-5"
              style={{
                borderBottom:
                  "var(--border-width-hairline) solid var(--border-default)",
              }}
            >
              <h2
                id="device-settings-mode-title"
                className="text-[14px] md:text-(length:--type-heading-sm)"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-snug)",
                  color: "var(--text-primary)",
                }}
              >
                Incubation Mode
              </h2>
              <p
                className="mt-1 text-[10px] md:text-(length:--type-body-sm)"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--weight-regular)",
                  color: "var(--text-farm)",
                }}
              >
                View target temperature, humidity, and candling schedule for the
                active species preset.
              </p>
            </div>
            <div className="pt-5 space-y-4">
              <div
                className="flex flex-col gap-4 rounded-[var(--radius-dialog)] p-4"
                style={{
                  backgroundColor: "var(--surface-porcelain)",
                  border: `var(--border-width-hairline) solid var(--border-default)`,
                }}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: "var(--surface-oat)",
                        color: "var(--brand-primary-hover)",
                      }}
                    >
                      <Egg
                        size={20}
                        color="var(--brand-primary-hover)"
                        weight="fill"
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0">
                      <p
                        style={{
                          color: "var(--text-secondary)",
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--type-label)",
                          fontWeight: "var(--weight-bold)",
                        }}
                      >
                        Active preset
                      </p>
                      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
                        <p
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "var(--type-heading-sm)",
                            fontWeight: "var(--weight-extrabold)",
                            lineHeight: "var(--leading-snug)",
                            color: "var(--text-primary)",
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                          }}
                        >
                          {mode.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isReady && (
                    <Select
                      value={unit.modeId}
                      disabled={isUpdating}
                      onValueChange={(val) => {
                        if (val !== unit.modeId) void changeMode(val);
                      }}
                    >
                      <SelectTrigger
                        aria-label="Choose incubation mode"
                        className="w-full rounded-xl md:w-[180px]"
                        style={{
                          borderColor: "var(--input-border)",
                          backgroundColor: "var(--surface-card)",
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--type-control-value)",
                          fontWeight: "var(--weight-bold)",
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modes.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {!isReady && (
                  <StatusCallout
                    tone="info"
                    size="sm"
                    title="Locked during cycle"
                    description="The active preset cannot change until this cycle is stopped or finished."
                  />
                )}
              </div>

              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--type-label)",
                  fontWeight: "var(--weight-extrabold)",
                  letterSpacing: "var(--tracking-label)",
                  lineHeight: "var(--leading-snug)",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                }}
              >
                Mode Information
              </p>
              <dl
                className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-dialog)]"
                style={{
                  border: `var(--border-width-hairline) solid var(--border-default)`,
                  backgroundColor: "var(--surface-card)",
                }}
              >
                {[
                  {
                    label: "Target temperature",
                    value: `${mode.targetTemp.min} to ${mode.targetTemp.max}°C`,
                  },
                  {
                    label: "Target humidity",
                    value: `${mode.targetHumidity.min} to ${mode.targetHumidity.max}% RH`,
                  },
                  {
                    label: "Turning schedule",
                    value: `Every ${mode.defaultTurnInterval} hours`,
                  },
                  {
                    label: "Scheduled candling",
                    value: candling.map((c) => `Day ${c.day}`).join(", "),
                  },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className={`p-4 ${index < 2 ? "border-b" : ""} ${index % 2 === 0 ? "border-r" : ""}`}
                    style={{
                      backgroundColor: "var(--surface-porcelain)",
                      borderColor: "var(--border-default)",
                    }}
                  >
                    <dt
                      style={{
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-caption)",
                        fontWeight: "var(--weight-bold)",
                      }}
                    >
                      {item.label}
                    </dt>
                    <dd
                      className="mt-1 tabular-nums"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--type-body)",
                        fontWeight: "var(--weight-extrabold)",
                        lineHeight: "var(--leading-normal)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                onClick={() =>
                  toast("Mode Library", {
                    description:
                      "Edit this preset under Settings → Mode Library.",
                  })
                }
                className="inline-flex min-h-[var(--control-height-default)] cursor-pointer items-center gap-1.5 rounded-lg px-1 text-[var(--brand-primary)] transition-colors hover:text-[var(--brand-primary-hover)] focus-visible:outline-none focus-visible:ring-2 md:min-h-10"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-body-sm)",
                  fontWeight: "var(--weight-semibold)",
                }}
              >
                <span>Edit preset for future cycles </span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {settingTab === "turning" && (
          <div id="device-settings-turning-panel">
            <div
              className="pb-5"
              style={{
                borderBottom:
                  "var(--border-width-hairline) solid var(--border-oat)",
              }}
            >
              <h2
                id="device-settings-turning-title"
                className="text-[14px] md:text-(length:--type-heading-sm)"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-snug)",
                  color: "var(--text-primary)",
                }}
              >
                Turning Schedule
              </h2>
              <p
                className="mt-1 text-[10px] md:text-(length:--type-body-sm)"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--weight-regular)",
                  color: "var(--text-farm)",
                }}
              >
                Configure automatic egg rotation intervals and manual turning
                controls.
              </p>
            </div>
            <div className="pt-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p
                    style={{
                      fontWeight: "var(--weight-semibold)",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-body-sm)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Automatic turning
                  </p>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-caption)",
                    }}
                  >
                    Turn eggs on schedule automatically.
                  </p>
                </div>
                <Switch
                  checked={unit.autoTurn}
                  disabled={turningStopped || isUpdating}
                  onCheckedChange={(autoTurn) =>
                    void onUpdate({
                      type: "configuration",
                      input: { autoTurn },
                    })
                  }
                />
              </div>
              {turningStopped && (
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-caption)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Turning is stopped during Lockdown and hatch phases.
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-body-sm)",
                    fontWeight: "var(--weight-semibold)",
                    color: "var(--text-primary)",
                  }}
                >
                  Turn every
                </span>
                <Select
                  disabled={turningStopped || isUpdating}
                  value={String(unit.turnInterval)}
                  onValueChange={(v) =>
                    void onUpdate({
                      type: "configuration",
                      input: { turnIntervalHours: Number(v) },
                    })
                  }
                >
                  <SelectTrigger
                    className="h-[var(--control-height-default)] w-[110px] rounded-xl md:h-9"
                    style={{
                      borderColor: "var(--border-clay)",
                      backgroundColor: "var(--surface-card)",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-control-value)",
                    }}
                  >
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
                <span
                  className="min-w-0 flex-1 break-words"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-caption)",
                    color: next.overdue
                      ? "var(--status-danger-fg)"
                      : "var(--text-secondary)",
                    overflowWrap: "anywhere",
                  }}
                >
                  Next: {next.text}
                  <br />
                  Last confirmed: {relTime(unit.lastTurned)}
                  {turnCommandStatus && (
                    <span className="block" role="status">
                      {
                        {
                          pending: "Turn requested",
                          dispatched: "Waiting for device confirmation",
                          acked: "Turn confirmed by device",
                          rejected: "Turn rejected by device",
                          timed_out: "Turn confirmation timed out",
                        }[turnCommandStatus]
                      }
                    </span>
                  )}
                </span>
                <Button
                  disabled={
                    turningStopped || isRequestingTurn || turnInProgress
                  }
                  onClick={() => void onTurnClick()}
                  aria-busy={isRequestingTurn || turnInProgress}
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full"
                  style={outlineBtn}
                >
                  <RotateCw size={14} />{" "}
                  <span>
                    {isRequestingTurn
                      ? "Requesting…"
                      : turnInProgress
                        ? "Waiting…"
                        : "Turn Now"}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {settingTab === "device" && (
          <div id="device-settings-device-panel">
            <div
              className="pb-5"
              style={{
                borderBottom:
                  "var(--border-width-hairline) solid var(--border-oat)",
              }}
            >
              <h2
                id="device-settings-device-title"
                className="text-[14px] md:text-(length:--type-heading-sm)"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-snug)",
                  color: "var(--text-primary)",
                }}
              >
                Device & Connection
              </h2>
              <p
                className="mt-1 text-[10px] md:text-(length:--type-body-sm)"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--weight-regular)",
                  color: "var(--text-farm)",
                }}
              >
                Manage chamber hardware pairing, connectivity status, and power
                telemetry.
              </p>
            </div>
            <div className="pt-5 space-y-4">
              <KeyValue label="Device ID" value={unit.deviceId} />
              <KeyValue
                label="Connection Status"
                accent={connection.color}
                value={
                  <span className="flex flex-wrap items-center gap-1.5">
                    <connection.Icon
                      size={15}
                      aria-hidden="true"
                      className="shrink-0"
                    />
                    <span>{connection.label}</span>
                    {(!unit.paired || unit.connectionState !== "connected") && (
                      <Button
                        onClick={() => void reconnectDevice()}
                        disabled={isUpdating}
                        aria-busy={isUpdating}
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-9 max-w-full whitespace-normal rounded-full py-2"
                        style={outlineBtn}
                      >
                        <WifiSlash
                          size={13}
                          weight="fill"
                          className="shrink-0"
                        />
                        <span className="min-w-0 break-words">
                          {isUpdating ? "Connecting…" : "Reconnect"}
                        </span>
                      </Button>
                    )}
                  </span>
                }
              />
              <div
                className="rounded-xl p-3.5"
                style={{
                  backgroundColor: "var(--surface-card)",
                  border: `var(--border-width-hairline) solid var(--border-default)`,
                }}
              >
                <div className="flex items-center justify-between">
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-caption)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Battery
                  </p>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-body-sm)",
                      fontWeight: "var(--weight-bold)",
                      color:
                        unit.batteryPct <= 25
                          ? "var(--status-danger-fg)"
                          : "var(--text-primary)",
                    }}
                  >
                    {unit.batteryPct}%
                  </span>
                </div>
                <Progress value={unit.batteryPct} className="mt-1.5 h-2" />
              </div>
              <div
                className="rounded-xl px-4 py-3"
                style={{
                  backgroundColor: "var(--surface-amber-pale)",
                  border:
                    "var(--border-width-hairline) solid var(--accent-gold)",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-extrabold)",
                    color: "var(--text-primary)",
                    textTransform: "uppercase",
                  }}
                >
                  Advanced
                </p>
                <p
                  className="mt-1"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-caption)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Stop the current cycle early if the batch must be removed
                  before the expected hatch period.
                </p>
                <Button
                  className="mt-2 rounded-lg"
                  variant="outline"
                  disabled={
                    isReady ||
                    cycleEnded ||
                    unit.cyclePhase === "stopped_early" ||
                    isUpdating
                  }
                  onClick={() => setStopCycleOpen(true)}
                  style={{
                    borderColor: "var(--button-danger-border)",
                    height: "var(--control-height-mobile)",
                    color: "var(--button-danger-fg)",
                    backgroundColor: "var(--surface-card)",
                  }}
                >
                  <span>Stop Cycle</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      <StopCycleModal
        open={stopCycleOpen}
        onOpenChange={setStopCycleOpen}
        unitName={unit.name}
        onConfirm={onStopCycle}
      />
    </>
  );
}
