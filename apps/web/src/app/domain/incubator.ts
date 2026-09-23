import { connectionStateFromPairing } from "./cycle";
import type { Incubator, Mode, Range, ReadingState } from "./types";

export function waterState(ok: boolean): ReadingState {
  return ok ? "ok" : "critical";
}

export function rangeState(value: number, safe: Range): ReadingState {
  return value >= safe.min && value <= safe.max ? "ok" : "critical";
}

export function getUnitIssues(unit: Incubator, mode: Mode): string[] {
  const issues: string[] = [];
  if (unit.temp > mode.targetTemp.max) issues.push("temperature high");
  else if (unit.temp < mode.targetTemp.min) issues.push("temperature low");
  if (unit.humidity > mode.targetHumidity.max) issues.push("humidity high");
  else if (unit.humidity < mode.targetHumidity.min) issues.push("humidity low");
  if (waterState(unit.waterOk) !== "ok") issues.push("water reservoir low");
  if (unit.powerSource === "battery" && unit.batteryPct <= 25)
    issues.push("battery low");
  if (new Date(unit.nextTurn).getTime() < Date.now())
    issues.push("turning overdue");
  if (!unit.paired) issues.push("device disconnected");
  return issues;
}

export function daysUntilHatch(
  dayOfIncubation: number,
  incubationDays: number,
): number {
  return Math.max(0, incubationDays - dayOfIncubation);
}

export function isHatchingSoon(
  dayOfIncubation: number,
  incubationDays: number,
): boolean {
  return daysUntilHatch(dayOfIncubation, incubationDays) <= 2;
}

export function resetChamberToReady(
  unit: Incubator,
  now = new Date(),
): Partial<Incubator> {
  const nowIso = now.toISOString();
  return {
    dayOfIncubation: 0,
    totalEggsLoaded: 0,
    fertileEggs: undefined,
    candled: {},
    candlingLog: [],
    autoTurn: false,
    status: "optimal",
    cyclePhase: "ready",
    conditionSeverity: "info",
    connectionState: connectionStateFromPairing(
      unit.paired,
      unit.telemetryStatus ?? "offline",
    ),
    lastTurned: nowIso,
    nextTurn: new Date(now.getTime() + 24 * 3_600_000).toISOString(),
  };
}
