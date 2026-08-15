export type CyclePhase =
  | "ready"
  | "incubating"
  | "lockdown"
  | "hatching"
  | "awaiting_finish"
  | "completed"
  | "stopped_early";

export type ConditionSeverity = "critical" | "warning" | "info";

export type ConnectionState =
  | "offline"
  | "connecting"
  | "connected"
  | "connection_failed";

export const cyclePhaseDisplayLabels: Record<CyclePhase, string> = {
  ready: "Ready",
  incubating: "Incubating",
  lockdown: "Lockdown",
  hatching: "Hatching",
  awaiting_finish: "Awaiting Finish",
  completed: "Completed",
  stopped_early: "Stopped Early",
};

export const conditionDisplayLabels: Record<ConditionSeverity, string> = {
  critical: "Urgent",
  warning: "Needs Attention",
  info: "Reminder",
};

export function unitStatusFromConditionSeverity(severity: ConditionSeverity): "optimal" | "warning" | "alert" {
  if (severity === "critical") return "alert";
  if (severity === "warning") return "warning";
  return "optimal";
}

export function deriveConditionSeverity(params: {
  paired: boolean;
  temp: number;
  targetTemp: { min: number; max: number };
  humidity: number;
  targetHumidity: { min: number; max: number };
  waterOk: boolean;
  batteryPct: number;
  powerSource: "grid" | "solar" | "battery";
  nextTurn: string;
}): ConditionSeverity {
  const temperatureCritical = params.temp < params.targetTemp.min - 0.5 || params.temp > params.targetTemp.max + 0.5;
  const humidityCritical = params.humidity < params.targetHumidity.min - 5 || params.humidity > params.targetHumidity.max + 5;
  const batteryCritical = params.powerSource === "battery" && params.batteryPct <= 15;
  const turningOverdue = new Date(params.nextTurn).getTime() < Date.now();

  if (!params.paired || !params.waterOk || temperatureCritical || humidityCritical || batteryCritical) {
    return "critical";
  }

  const temperatureWarning = params.temp < params.targetTemp.min || params.temp > params.targetTemp.max;
  const humidityWarning = params.humidity < params.targetHumidity.min || params.humidity > params.targetHumidity.max;
  const batteryWarning = params.powerSource === "battery" && params.batteryPct <= 25;

  if (temperatureWarning || humidityWarning || batteryWarning || turningOverdue) return "warning";
  return "info";
}

export function conditionSeverityFromLegacyStatus(
  status: "optimal" | "warning" | "alert",
): ConditionSeverity {
  if (status === "alert") return "critical";
  if (status === "warning") return "warning";
  return "info";
}

export function connectionStateFromPairing(paired: boolean): ConnectionState {
  return paired ? "connected" : "offline";
}

export function cyclePhaseFromDay(params: {
  dayOfIncubation: number;
  incubationDays: number;
  lockdownDay: number;
}): CyclePhase {
  if (params.dayOfIncubation <= 0) return "ready";
  if (params.dayOfIncubation > params.incubationDays) return "awaiting_finish";
  if (params.dayOfIncubation === params.incubationDays) return "hatching";
  if (params.dayOfIncubation >= params.lockdownDay) return "lockdown";
  return "incubating";
}
