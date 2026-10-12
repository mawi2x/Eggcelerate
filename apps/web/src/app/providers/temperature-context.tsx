import { createContext, useContext, useMemo } from "react";
import type { Range } from "../domain/types";

export type TemperatureUnit = "c" | "f";
export const TemperatureUnitContext = createContext<TemperatureUnit>("c");

/** Convert for presentation only; telemetry and control targets stay in Celsius. */
export function useTemperatureDisplay() {
  const selectedUnit = useContext(TemperatureUnitContext);
  return useMemo(() => {
    const value = (celsius: number) =>
      selectedUnit === "f" ? celsius * 9 / 5 + 32 : celsius;
    const delta = (celsius: number) =>
      selectedUnit === "f" ? celsius * 9 / 5 : celsius;
    const unit = selectedUnit === "f" ? "°F" : "°C";
    const number = (celsius: number) => value(celsius).toFixed(1);
    return {
      unit, value, delta, number,
      toCelsius: (displayed: number) => selectedUnit === "f" ? (displayed - 32) * 5 / 9 : displayed,
      format: (celsius: number) => `${number(celsius)}${unit}`,
      range: (range: Range) => ({ min: value(range.min), max: value(range.max) }),
      formatRange: (range: Range) => `${number(range.min)} to ${number(range.max)}${unit}`,
    };
  }, [selectedUnit]);
}
