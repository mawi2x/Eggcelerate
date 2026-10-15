import type { Mode } from "../../domain/types";

export const modeFixtures = [
  {
    id: "broiler",
    name: "Chicken",
    builtIn: true,
    targetTemp: { min: 37.5, max: 37.8 },
    targetHumidity: { min: 55, max: 60 },
    incubationDays: 21,
    defaultTurnInterval: 4,
  },
  {
    id: "duck",
    name: "Duck",
    builtIn: true,
    targetTemp: { min: 37.4, max: 37.6 },
    targetHumidity: { min: 62, max: 68 },
    incubationDays: 28,
    defaultTurnInterval: 6,
  },
  {
    id: "quail",
    name: "Quail",
    builtIn: true,
    targetTemp: { min: 37.5, max: 37.8 },
    targetHumidity: { min: 55, max: 60 },
    incubationDays: 18,
    defaultTurnInterval: 4,
  },
] as const satisfies readonly Mode[];

export function createModeFixtures(): Mode[] {
  return modeFixtures.map((mode) => ({
    ...mode,
    targetTemp: { ...mode.targetTemp },
    targetHumidity: { ...mode.targetHumidity },
  }));
}
