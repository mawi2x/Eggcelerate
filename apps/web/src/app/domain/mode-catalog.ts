import type { Mode } from "./types";

// Keep the existing chicken ID so chamber/cycle references remain stable.
export const MODE_NAMES: Readonly<Record<string, string>> = {
  broiler: "Chicken",
  duck: "Duck",
  quail: "Quail",
};

export function isCurrentMode(mode: Mode): boolean {
  const retired = [
    "goose",
    "turkey",
    "pheasant",
    "peafowl",
    "swan",
    "broiler-hh",
    "rapid-quail",
  ];
  return (
    Object.prototype.hasOwnProperty.call(MODE_NAMES, mode.id) ||
    (!mode.builtIn && !retired.includes(mode.id))
  );
}

export function currentModes(modes: Mode[]): Mode[] {
  return modes
    .filter(isCurrentMode)
    .map((mode) =>
      Object.prototype.hasOwnProperty.call(MODE_NAMES, mode.id)
        ? { ...mode, name: MODE_NAMES[mode.id], builtIn: true }
        : mode,
    );
}
