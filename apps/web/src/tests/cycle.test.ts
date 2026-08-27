import { describe, it, expect } from "vitest";
import {
  cyclePhaseFromDay,
  deriveConditionSeverity,
  unitStatusFromConditionSeverity,
  conditionSeverityFromLegacyStatus,
  connectionStateFromPairing,
} from "../app/domain/cycle";

describe("cyclePhaseFromDay", () => {
  it("returns ready for day 0", () => {
    expect(cyclePhaseFromDay({ dayOfIncubation: 0, incubationDays: 21, lockdownDay: 18 })).toBe("ready");
  });
  it("returns ready for negative day", () => {
    expect(cyclePhaseFromDay({ dayOfIncubation: -1, incubationDays: 21, lockdownDay: 18 })).toBe("ready");
  });
  it("returns incubating for day 5", () => {
    expect(cyclePhaseFromDay({ dayOfIncubation: 5, incubationDays: 21, lockdownDay: 18 })).toBe("incubating");
  });
  it("returns lockdown at day 18", () => {
    expect(cyclePhaseFromDay({ dayOfIncubation: 18, incubationDays: 21, lockdownDay: 18 })).toBe("lockdown");
  });
  it("returns lockdown for day 19", () => {
    expect(cyclePhaseFromDay({ dayOfIncubation: 19, incubationDays: 21, lockdownDay: 18 })).toBe("lockdown");
  });
  it("returns hatching at day 21", () => {
    expect(cyclePhaseFromDay({ dayOfIncubation: 21, incubationDays: 21, lockdownDay: 18 })).toBe("hatching");
  });
  it("returns awaiting_finish at day 22", () => {
    expect(cyclePhaseFromDay({ dayOfIncubation: 22, incubationDays: 21, lockdownDay: 18 })).toBe("awaiting_finish");
  });
});

describe("deriveConditionSeverity", () => {
  const targetTemp = { min: 37.5, max: 37.8 };
  const targetHumidity = { min: 55, max: 65 };
  const futureTurn = new Date(Date.now() + 3600000).toISOString();
  const pastTurn = new Date(Date.now() - 3600000).toISOString();

  const base = {
    paired: true,
    temp: 37.6,
    targetTemp,
    humidity: 60,
    targetHumidity,
    waterOk: true,
    batteryPct: 100,
    powerSource: "grid" as const,
    nextTurn: futureTurn,
  };

  it("critical when temp > max+0.5 (39 vs 37.8)", () => {
    const s = deriveConditionSeverity({ ...base, temp: 39, humidity: 60, targetTemp, targetHumidity });
    expect(s).toBe("critical");
  });
  it("critical when temp < min-0.5 (36.9 vs 37.5)", () => {
    const s = deriveConditionSeverity({ ...base, temp: 36.9, targetTemp, targetHumidity });
    expect(s).toBe("critical");
  });
  it("warning when temp 38.0 just over max", () => {
    const s = deriveConditionSeverity({ ...base, temp: 38.0, targetTemp, targetHumidity });
    expect(s).toBe("warning");
  });
  it("warning when temp 37.4 just under min", () => {
    const s = deriveConditionSeverity({ ...base, temp: 37.4, targetTemp, targetHumidity });
    expect(s).toBe("warning");
  });
  it("critical when waterOk false", () => {
    const s = deriveConditionSeverity({ ...base, waterOk: false });
    expect(s).toBe("critical");
  });
  it("critical when not paired", () => {
    const s = deriveConditionSeverity({ ...base, paired: false });
    expect(s).toBe("critical");
  });
  it("critical when humidity > max+5 (71 vs 65)", () => {
    const s = deriveConditionSeverity({ ...base, humidity: 71, targetHumidity });
    expect(s).toBe("critical");
  });
  it("critical when humidity < min-5 (49 vs 55)", () => {
    const s = deriveConditionSeverity({ ...base, humidity: 49, targetHumidity });
    expect(s).toBe("critical");
  });
  it("warning when humidity 66 just over max", () => {
    const s = deriveConditionSeverity({ ...base, humidity: 66, targetHumidity });
    expect(s).toBe("warning");
  });
  it("warning when humidity 54 just under min", () => {
    const s = deriveConditionSeverity({ ...base, humidity: 54, targetHumidity });
    expect(s).toBe("warning");
  });
  it("critical when batteryCritical <=15 on battery", () => {
    const s = deriveConditionSeverity({ ...base, powerSource: "battery", batteryPct: 15 });
    expect(s).toBe("critical");
  });
  it("critical when batteryPct 5 on battery", () => {
    const s = deriveConditionSeverity({ ...base, powerSource: "battery", batteryPct: 5 });
    expect(s).toBe("critical");
  });
  it("warning when batteryWarning <=25 on battery (20%)", () => {
    const s = deriveConditionSeverity({ ...base, powerSource: "battery", batteryPct: 20 });
    expect(s).toBe("warning");
  });
  it("warning when batteryPct 25 on battery (boundary)", () => {
    const s = deriveConditionSeverity({ ...base, powerSource: "battery", batteryPct: 25 });
    expect(s).toBe("warning");
  });
  it("info when battery low but on grid (should not trigger battery check)", () => {
    const s = deriveConditionSeverity({ ...base, powerSource: "grid", batteryPct: 5 });
    expect(s).toBe("info");
  });
  it("warning when turning overdue (nextTurn in past)", () => {
    const s = deriveConditionSeverity({ ...base, nextTurn: pastTurn });
    expect(s).toBe("warning");
  });
  it("info when all optimal", () => {
    const s = deriveConditionSeverity({ ...base });
    expect(s).toBe("info");
  });
  it("info when temp/humidity exactly at boundaries", () => {
    const s = deriveConditionSeverity({ ...base, temp: 37.8, humidity: 65 });
    expect(s).toBe("info");
  });
});

// Additional helpers to reach 80% function/line coverage for domain/cycle.ts
describe("unitStatusFromConditionSeverity", () => {
  it("maps critical to alert", () => expect(unitStatusFromConditionSeverity("critical")).toBe("alert"));
  it("maps warning to warning", () => expect(unitStatusFromConditionSeverity("warning")).toBe("warning"));
  it("maps info to optimal", () => expect(unitStatusFromConditionSeverity("info")).toBe("optimal"));
});

describe("conditionSeverityFromLegacyStatus", () => {
  it("maps alert to critical", () => expect(conditionSeverityFromLegacyStatus("alert")).toBe("critical"));
  it("maps warning to warning", () => expect(conditionSeverityFromLegacyStatus("warning")).toBe("warning"));
  it("maps optimal to info", () => expect(conditionSeverityFromLegacyStatus("optimal")).toBe("info"));
});

describe("connectionStateFromPairing", () => {
  it("returns connected when paired", () => expect(connectionStateFromPairing(true)).toBe("connected"));
  it("returns offline when not paired", () => expect(connectionStateFromPairing(false)).toBe("offline"));
});
