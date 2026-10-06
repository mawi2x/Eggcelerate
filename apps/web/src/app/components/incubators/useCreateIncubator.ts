import { useState } from "react";
import { toast } from "sonner";
import type { Incubator, Mode } from "../../domain/types";

export function useCreateIncubator(
  units: Incubator[],
  modes: Mode[],
  onAddIncubator: (unit: Incubator) => Promise<boolean>,
) {
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<
    null | "invalid" | "offline"
  >(null);
  const modeOf = (id: string) => modes.find((m) => m.id === id) ?? modes[0];
  const resetForm = () => {
    setDeviceId("");
    setName("");
  };

  const handleAdd = async () => {
    const trimmedDeviceId = deviceId.trim();
    const trimmedName = name.trim();
    if (!trimmedDeviceId || !trimmedName) {
      toast.error("Please enter a Device ID and Chamber Name.");
      return;
    }
    if (!/^[A-Za-z0-9-]{3,20}$/.test(trimmedDeviceId)) {
      toast.error(
        "Device ID must be 3 to 20 characters using letters, numbers, or dashes. Example: EGG-1015.",
      );
      return;
    }
    if (
      units.some(
        (u) => u.deviceId.toLowerCase() === trimmedDeviceId.toLowerCase(),
      )
    ) {
      toast.error(
        `Device ${trimmedDeviceId} is already paired to another chamber.`,
      );
      return;
    }
    setConnectError(null);
    setConnecting(true);
    const id = trimmedDeviceId.trim().toUpperCase();
    if (!/^EGG-\d{4}$/.test(id)) {
      setConnectError("invalid");
      setConnecting(false);
      return;
    }
    const mode = modes[0] ?? modeOf("broiler");
    const nowIso = new Date().toISOString();
    const connected = await onAddIncubator({
      id: `chamber-${Date.now()}`,
      name: trimmedName,
      deviceId: id,
      modeId: mode.id,
      dayOfIncubation: 0,
      temp: (mode.targetTemp.min + mode.targetTemp.max) / 2,
      humidity: Math.round(
        (mode.targetHumidity.min + mode.targetHumidity.max) / 2,
      ),
      waterOk: true,
      tempTrend: 0,
      humidityTrend: 0,
      powerSource: "grid",
      batteryPct: 100,
      status: "alert",
      cyclePhase: "ready",
      conditionSeverity: "critical",
      connectionState: "offline",
      telemetryStatus: "offline",
      lastTurned: nowIso,
      nextTurn: new Date(
        Date.now() + mode.defaultTurnInterval * 3_600_000,
      ).toISOString(),
      turnInterval: mode.defaultTurnInterval,
      autoTurn: true,
      paired: true,
      candled: {},
      candlingLog: [],
    });
    if (!connected) {
      setConnecting(false);
      return;
    }
    toast.success(
      `Chamber ${trimmedName} paired. Waiting for its first telemetry report.`,
    );
    resetForm();
    setConnecting(false);
    setOpen(false);
  };

  return {
    open,
    setOpen,
    deviceId,
    setDeviceId,
    name,
    setName,
    connecting,
    connectError,
    setConnectError,
    handleAdd,
    openDialog: () => {
      setConnectError(null);
      setOpen(true);
    },
  };
}
