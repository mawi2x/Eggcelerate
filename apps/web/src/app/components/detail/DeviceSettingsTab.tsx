import { Egg, Lock, WifiSlash } from "@phosphor-icons/react";
import { ChevronRight, LockKeyhole, RotateCw, Wifi, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { CandlingCheckpoint, Incubator, Mode } from "../../domain/types";
import { IncubatingIcon } from "../icons";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { KeyValue } from "./primitives";
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
  onUpdate: (patch: Partial<Incubator>) => Promise<boolean>;
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
  onUpdate,
  onStopCycle,
  onTurnClick,
}: DeviceSettingsTabProps) {
  const [settingTab, setSettingTab] = useState<"mode" | "turning" | "device">(
    "mode",
  );
  const [stopCycleOpen, setStopCycleOpen] = useState(false);

  const mode = modes.find((m) => m.id === unit.modeId) ?? modes[0];

  const changeMode = async (modeId: string) => {
    const m = modes.find((x) => x.id === modeId);
    if (!m) return;
    if (!(await onUpdate({ modeId, turnInterval: m.defaultTurnInterval })))
      return;
    toast(`Mode changed to ${m.name}`, {
      description: "Turning interval reset to mode default.",
    });
  };

  const reconnectDevice = async () => {
    toast("Reconnecting to incubator...", {
      description: `Attempting handshake with ${unit.deviceId}`,
    });
    if (!(await onUpdate({ paired: true, connectionState: "connected" })))
      return;
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

  const outlineBtn = {
    borderColor: "var(--border-default)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-card)",
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Left Sub-Nav Card */}
      <nav
        className="w-full max-w-none shrink-0 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-1.5 sm:p-2 lg:sticky lg:top-6 lg:max-w-[240px] lg:p-4"
        style={{
          borderRadius: "var(--radius-card)",
        }}
        aria-label="Device settings"
      >
        <ul className="grid grid-cols-3 gap-1 lg:flex lg:flex-col lg:gap-1">
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
              <li key={id} className="min-w-0 w-full">
                <button
                  type="button"
                  onClick={() => setSettingTab(id)}
                  className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 lg:justify-start sm:gap-2.5 sm:px-3 ${
                    isActive
                      ? "border-[var(--brand-primary-soft)] bg-[var(--local-nav-selected-bg)] text-[var(--local-nav-selected-fg)]"
                      : "border-transparent bg-transparent text-[var(--text-primary)] hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--brand-primary)]"
                  }`}
                  style={{
                    height: "var(--control-height-toolbar)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-body-sm)",
                    fontWeight: "var(--weight-bold)",
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    size={16}
                    strokeWidth={isActive ? 2.5 : 2}
                    className="shrink-0"
                    style={{
                      color: isActive
                        ? "var(--local-nav-selected-fg)"
                        : "var(--text-primary)",
                    }}
                  />
                  <span className="min-w-0 break-words whitespace-normal lg:hidden">
                    {mobileLabel}
                  </span>
                  <span className="hidden min-w-0 break-words whitespace-normal lg:inline">
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
        aria-labelledby={
          settingTab === "mode"
            ? "device-settings-mode-title"
            : settingTab === "turning"
              ? "device-settings-turning-title"
              : "device-settings-device-title"
        }
        className="min-w-0 flex-1 rounded-2xl p-4 md:p-6"
        style={{
          backgroundColor: "var(--surface-card)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--border-default)",
        }}
      >
        {settingTab === "mode" && (
          <>
            <div
              className="pb-5"
              style={{ borderBottom: "1px solid var(--border-default)" }}
            >
              <h2
                id="device-settings-mode-title"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--type-heading-lg)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-snug)",
                  color: "var(--text-primary)",
                }}
              >
                Incubation Mode
              </h2>
              <p
                className="mt-1"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-body-sm)",
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
                className="flex flex-col gap-4 rounded-2xl p-4 md:flex-row md:items-center md:justify-between"
                style={{
                  backgroundColor: "var(--surface-porcelain)",
                  border: `1px solid var(--border-default)`,
                }}
              >
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
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--type-label)",
                          fontWeight: "var(--weight-bold)",
                          backgroundColor: "var(--surface-track)",
                          color: "var(--brand-primary-hover)",
                        }}
                      >
                        {mode.builtIn ? "Built-in" : "Custom"}
                      </span>
                    </div>
                  </div>
                </div>

                {isReady ? (
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
                ) : (
                  <span
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 self-start rounded-full px-3 md:self-auto"
                    style={{
                      backgroundColor: "var(--border-sand)",
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-caption)",
                      fontWeight: "var(--weight-bold)",
                    }}
                  >
                    <Lock size={14} weight="fill" aria-hidden="true" /> Locked
                    during cycle
                  </span>
                )}
              </div>

              {!isReady && (
                <p
                  className="flex items-start gap-2"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-caption)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <LockKeyhole
                    size={14}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  The active preset cannot change until this cycle is stopped or
                  finished.
                </p>
              )}

              <dl
                className="grid grid-cols-1 overflow-hidden rounded-2xl md:grid-cols-2"
                style={{
                  border: `1px solid var(--border-default)`,
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
                    className={`p-4 ${index < 3 ? "border-b" : ""} ${index % 2 === 0 ? "md:border-r" : ""} ${index >= 2 ? "md:border-b-0" : ""}`}
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
                Edit preset for future cycles{" "}
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </>
        )}

        {settingTab === "turning" && (
          <>
            <div
              className="pb-5"
              style={{ borderBottom: "1px solid var(--border-oat)" }}
            >
              <h2
                id="device-settings-turning-title"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--type-heading-lg)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-snug)",
                  color: "var(--text-primary)",
                }}
              >
                Turning Schedule
              </h2>
              <p
                className="mt-1"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-body-sm)",
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
                  onCheckedChange={(v) => void onUpdate({ autoTurn: v })}
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
                    void onUpdate({ turnInterval: Number(v) })
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
                  Next: {next.text} • Last: {relTime(unit.lastTurned)}
                </span>
                <Button
                  disabled={turningStopped || isUpdating}
                  onClick={() => void onTurnClick()}
                  aria-busy={isUpdating}
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full"
                  style={outlineBtn}
                >
                  <RotateCw size={14} />{" "}
                  {isUpdating ? "Confirming…" : "Turn Now"}
                </Button>
              </div>
            </div>
          </>
        )}

        {settingTab === "device" && (
          <>
            <div
              className="pb-5"
              style={{ borderBottom: "1px solid var(--border-oat)" }}
            >
              <h2
                id="device-settings-device-title"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--type-heading-lg)",
                  fontWeight: "var(--weight-bold)",
                  lineHeight: "var(--leading-snug)",
                  color: "var(--text-primary)",
                }}
              >
                Device & Connection
              </h2>
              <p
                className="mt-1"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-body-sm)",
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
                accent={
                  unit.paired
                    ? "var(--status-success-fg)"
                    : "var(--status-danger-fg)"
                }
                value={
                  <span className="flex items-center gap-1.5">
                    {unit.paired ? (
                      <Wifi size={15} />
                    ) : (
                      <WifiSlash size={15} weight="fill" />
                    )}
                    {unit.connectionState === "connecting"
                      ? "Connecting"
                      : unit.paired && unit.connectionState === "connected"
                        ? "Connected and Paired"
                        : "Connection Lost"}
                    {(!unit.paired || unit.connectionState !== "connected") && (
                      <Button
                        onClick={() => void reconnectDevice()}
                        disabled={isUpdating}
                        aria-busy={isUpdating}
                        variant="outline"
                        size="sm"
                        className="ml-1 rounded-full"
                        style={outlineBtn}
                      >
                        <WifiSlash size={13} weight="fill" />{" "}
                        {isUpdating ? "Connecting…" : "Reconnect"}
                      </Button>
                    )}
                  </span>
                }
              />
              <div
                className="rounded-xl p-3.5"
                style={{
                  backgroundColor: "var(--surface-card)",
                  border: `1px solid var(--border-default)`,
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
                className="rounded-xl p-4"
                style={{
                  backgroundColor: "var(--surface-amber-pale)",
                  border: "1px solid var(--accent-gold)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-body)",
                    fontWeight: "var(--weight-bold)",
                    color: "var(--text-primary)",
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
                  className="mt-3 rounded-xl"
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
                    color: "var(--button-danger-fg)",
                    backgroundColor: "var(--surface-card)",
                  }}
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
        onConfirm={onStopCycle}
      />
    </div>
  );
}
