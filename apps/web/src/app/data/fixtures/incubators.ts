import { computeCandling } from "../../domain/candling";
import { localDateString } from "../../domain/date";
import {
  connectionStateFromPairing,
  cyclePhaseFromDay,
  deriveConditionState,
} from "../../domain/cycle";
import type { CandlingLogEntry, Incubator, Mode } from "../../domain/types";

type IncubatorFixture = Omit<Incubator, "cyclePhase" | "conditionSeverity" | "connectionState">;

export function createIncubatorFixtures(modes: readonly Mode[], now = Date.now()): Incubator[] {
  const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  const isoAhead = (minutesAhead: number) => new Date(now + minutesAhead * 60_000).toISOString();
  const dayAgo = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return localDateString(date);
  };

  const chamberOneLog: CandlingLogEntry[] = [
    { day: 2, label: "Initial candling", date: dayAgo(7), fertile: 24, clear: 0, uncertain: 0, checkpointType: "first", note: "Fresh set. No development expected yet. Baseline air cells marked.", photos: [], checks: ["airCell"] },
    { day: 3, label: "Early veining check", date: dayAgo(6), fertile: 23, clear: 1, uncertain: 0, checkpointType: "first", note: "Faint spider veining appearing in most eggs. One appears clear.", photos: [], checks: ["veining", "airCell"] },
    { day: 5, label: "Air cell check", date: dayAgo(4), fertile: 23, clear: 1, uncertain: 0, checkpointType: "first", note: "Air cells developing evenly. Good progress across the tray.", photos: [], checks: ["veining", "airCell"] },
    { day: 6, label: "First candling", date: dayAgo(3), fertile: 22, clear: 2, uncertain: 0, checkpointType: "first", note: "Strong spider veining observed across 22 eggs. 2 clear infertile eggs removed from tray.", photos: [], checks: ["veining", "airCell"] },
    { day: 7, label: "Fertility recount", date: dayAgo(2), fertile: 22, clear: 2, uncertain: 0, checkpointType: "first", note: "Recounted after removals. Strong dark spots are forming in 22 eggs.", photos: [], checks: ["veining", "airCell"] },
    { day: 9, label: "Development check", date: dayAgo(0), fertile: 22, clear: 2, uncertain: 1, checkpointType: "later", developing: 21, stoppedDeveloping: 0, note: "Movement observed in several eggs. One is uncertain. Recheck at Day 13.", photos: [], checks: ["veining", "airCell", "movement"] },
  ];

  const chamberTwelveLog: CandlingLogEntry[] = [
    { day: 6, label: "First candling", date: dayAgo(15), fertile: 31, clear: 4, uncertain: 2, checkpointType: "first", note: "Strong veining across 31 eggs. 4 clears culled, 2 uncertain kept for recheck.", photos: [], checks: ["veining", "airCell"] },
    { day: 13, label: "Second candling", date: dayAgo(8), fertile: 31, developing: 29, clear: 4, uncertain: 2, stoppedDeveloping: 2, checkpointType: "later", note: "Healthy dark spots on 29 eggs. 2 stopped developing and were removed. Uncertains set aside.", photos: [], checks: ["veining", "airCell", "movement"] },
    { day: 18, label: "Lockdown check", date: dayAgo(3), fertile: 31, developing: 28, clear: 5, uncertain: 2, stoppedDeveloping: 2, checkpointType: "later", note: "Air cells tilted for hatch position. No internal pip yet at lockdown.", photos: [], checks: ["veining", "airCell", "movement"] },
  ];

  const fixtures: IncubatorFixture[] = [
    {
      id: "chamber-1", name: "Chamber One", deviceId: "EGG-1003", modeId: "broiler", dayOfIncubation: 9,
      totalEggsLoaded: 24, fertileEggs: 22, temp: 37.6, humidity: 57, waterOk: true,
      tempTrend: 0.1, humidityTrend: 0.3, powerSource: "grid", batteryPct: 100, status: "optimal",
      lastTurned: iso(95), nextTurn: isoAhead(145), turnInterval: 4, autoTurn: true, paired: true,
      candled: { 6: true }, candlingLog: chamberOneLog,
    },
    {
      id: "chamber-2", name: "Chamber Two", deviceId: "EGG-1004", modeId: "duck", dayOfIncubation: 14,
      totalEggsLoaded: 32, temp: 37.5, humidity: 51, waterOk: true,
      tempTrend: -0.1, humidityTrend: -1.4, powerSource: "grid", batteryPct: 82, status: "warning",
      lastTurned: iso(50), nextTurn: isoAhead(190), turnInterval: 6, autoTurn: true, paired: true,
      candled: {}, candlingLog: [],
    },
    {
      id: "chamber-3", name: "Chamber Three", deviceId: "EGG-1005", modeId: "quail", dayOfIncubation: 15,
      totalEggsLoaded: 38, temp: 39.2, humidity: 64, waterOk: false,
      tempTrend: 1.3, humidityTrend: 0.2, powerSource: "battery", batteryPct: 23, status: "alert",
      lastTurned: iso(220), nextTurn: isoAhead(-40), turnInterval: 4, autoTurn: false, paired: false,
      candled: {}, candlingLog: [],
    },
    {
      id: "chamber-4", name: "Chamber Four", deviceId: "EGG-1006", modeId: "goose", dayOfIncubation: 22,
      totalEggsLoaded: 24, temp: 37.4, humidity: 62, waterOk: true,
      tempTrend: -0.1, humidityTrend: 0.4, powerSource: "grid", batteryPct: 100, status: "optimal",
      lastTurned: iso(40), nextTurn: isoAhead(320), turnInterval: 6, autoTurn: true, paired: true,
      candled: {}, candlingLog: [],
    },
    {
      id: "chamber-5", name: "Chamber Five", deviceId: "EGG-1007", modeId: "turkey", dayOfIncubation: 5,
      totalEggsLoaded: 30, temp: 37.7, humidity: 58, waterOk: true,
      tempTrend: 0.2, humidityTrend: -0.2, powerSource: "grid", batteryPct: 91, status: "optimal",
      lastTurned: iso(70), nextTurn: isoAhead(170), turnInterval: 4, autoTurn: true, paired: true,
      candled: {}, candlingLog: [],
    },
    {
      id: "chamber-6", name: "Chamber Six", deviceId: "EGG-1008", modeId: "pheasant", dayOfIncubation: 11,
      totalEggsLoaded: 38, temp: 38.1, humidity: 49, waterOk: false,
      tempTrend: 0.5, humidityTrend: -1.1, powerSource: "grid", batteryPct: 100, status: "warning",
      lastTurned: iso(120), nextTurn: isoAhead(240), turnInterval: 6, autoTurn: true, paired: true,
      candled: {}, candlingLog: [],
    },
    {
      id: "chamber-7", name: "Chamber Seven", deviceId: "EGG-1009", modeId: "broiler", dayOfIncubation: 1,
      totalEggsLoaded: 38, temp: 37.6, humidity: 56, waterOk: true,
      tempTrend: 0, humidityTrend: 0, powerSource: "grid", batteryPct: 100, status: "optimal",
      lastTurned: iso(20), nextTurn: isoAhead(220), turnInterval: 4, autoTurn: true, paired: true,
      candled: {}, candlingLog: [],
    },
    {
      id: "chamber-8", name: "Chamber Eight", deviceId: "EGG-1010", modeId: "peafowl", dayOfIncubation: 18,
      totalEggsLoaded: 24, temp: 39.8, humidity: 42, waterOk: false,
      tempTrend: 1.8, humidityTrend: -2.2, powerSource: "battery", batteryPct: 15, status: "alert",
      lastTurned: iso(300), nextTurn: isoAhead(-90), turnInterval: 6, autoTurn: false, paired: false,
      candled: {}, candlingLog: [],
    },
    {
      id: "chamber-9", name: "Chamber Nine", deviceId: "EGG-1011", modeId: "quail", dayOfIncubation: 17,
      totalEggsLoaded: 38, temp: 37.5, humidity: 68, waterOk: true,
      tempTrend: 0, humidityTrend: 0.6, powerSource: "battery", batteryPct: 82, status: "optimal",
      lastTurned: iso(35), nextTurn: isoAhead(205), turnInterval: 4, autoTurn: true, paired: true,
      candled: {}, candlingLog: [],
    },
    {
      id: "chamber-10", name: "Chamber Ten", deviceId: "EGG-1012", modeId: "duck", dayOfIncubation: 3,
      totalEggsLoaded: 32, temp: 37.6, humidity: 55, waterOk: true,
      tempTrend: 0.1, humidityTrend: -0.1, powerSource: "grid", batteryPct: 100, status: "optimal",
      lastTurned: iso(60), nextTurn: isoAhead(300), turnInterval: 6, autoTurn: true, paired: true,
      candled: {}, candlingLog: [],
    },
    {
      id: "chamber-11", name: "Chamber Eleven", deviceId: "EGG-1013", modeId: "swan", dayOfIncubation: 29,
      totalEggsLoaded: 16, temp: 36.9, humidity: 71, waterOk: false,
      tempTrend: -0.4, humidityTrend: 0.3, powerSource: "battery", batteryPct: 64, status: "warning",
      lastTurned: iso(90), nextTurn: isoAhead(390), turnInterval: 8, autoTurn: true, paired: true,
      candled: {}, candlingLog: [],
    },
    {
      id: "chamber-12", name: "Chamber Twelve", deviceId: "EGG-1014", modeId: "broiler-hh", dayOfIncubation: 22,
      totalEggsLoaded: 37, fertileEggs: 31, temp: 37.5, humidity: 65, waterOk: true,
      tempTrend: 0, humidityTrend: 0.2, powerSource: "grid", batteryPct: 100, status: "optimal",
      lastTurned: iso(25), nextTurn: isoAhead(215), turnInterval: 4, autoTurn: true, paired: true,
      candled: { 6: true, 13: true, 18: true }, candlingLog: chamberTwelveLog,
    },
  ];

  return fixtures.map((unit) => {
    const mode = modes.find((candidate) => candidate.id === unit.modeId);
    const lockdownDay = mode ? computeCandling(mode.incubationDays)[2]?.day ?? mode.incubationDays : 18;
    const cyclePhase = cyclePhaseFromDay({
      dayOfIncubation: unit.dayOfIncubation,
      incubationDays: mode?.incubationDays ?? 21,
      lockdownDay,
    });
    const condition = mode
      ? deriveConditionState({
          paired: unit.paired,
          temp: unit.temp,
          targetTemp: mode.targetTemp,
          humidity: unit.humidity,
          targetHumidity: mode.targetHumidity,
          waterOk: unit.waterOk,
          batteryPct: unit.batteryPct,
          powerSource: unit.powerSource,
          nextTurn: unit.nextTurn,
        })
      : { conditionSeverity: "info" as const, status: unit.status };
    return {
      ...unit,
      cyclePhase,
      autoTurn: cyclePhase === "lockdown" || cyclePhase === "hatching" || cyclePhase === "awaiting_finish"
        ? false
        : unit.autoTurn,
      ...condition,
      connectionState: connectionStateFromPairing(unit.paired),
    };
  });
}
