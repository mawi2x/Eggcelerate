import type { CandlingCheckpoint, DevelopmentCheck } from "./types";

// The evaluated prototype has one installed tray with room for 38 eggs.
// Future devices may expose this value from device configuration.
export const CURRENT_TRAY_CAPACITY = 38;

const CANDLE_PROPORTIONS = [6 / 21, 13 / 21, 18 / 21];
const CANDLE_LABELS = ["First candling", "Second candling", "Lockdown check"];

export function computeCandling(durationDays: number): CandlingCheckpoint[] {
  return CANDLE_PROPORTIONS.map((proportion, index) => {
    const day = Math.max(1, Math.round(proportion * durationDays));
    const isLast = index === CANDLE_PROPORTIONS.length - 1;
    const dayRange = isLast ? `Day ${day}` : `Day ${Math.max(1, day - 1)} to ${day + 1}`;
    return { label: CANDLE_LABELS[index], dayRange, day };
  });
}

export const developmentCheckLabels: Record<DevelopmentCheck, string> = {
  veining: "Veining Visible",
  airCell: "Air Cell Normal",
  movement: "Embryo Movement",
};
