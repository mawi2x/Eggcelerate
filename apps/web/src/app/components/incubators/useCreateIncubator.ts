import { useState } from "react";
import { toast } from "sonner";
import type { Incubator, Mode } from "../../domain/types";

export function useCreateIncubator(
  _units: Incubator[],
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
      toast.error("Please enter a pairing code and chamber name.");
      return;
    }
    const id = trimmedDeviceId.toUpperCase().replace(/-/g, "");
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(id)) {
      setConnectError("invalid");
      return;
    }
    setConnectError(null);
    setConnecting(true);
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
