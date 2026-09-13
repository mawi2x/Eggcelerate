import type { Incubator, Mode, Reading } from "../../domain/types";

// Deterministic telemetry fixtures share one repository-owned anchor so
// comparison charts can merge different incubators onto the same timestamps.
export function createReadingFixtures(
  unit: Incubator,
  mode: Mode,
  anchorMs: number,
): Reading[] {
  const points: Reading[] = [];
  const stepHours = 2;
  const elapsedDays = Math.max(1, unit.dayOfIncubation);
  const totalPoints = Math.round((elapsedDays * 24) / stepHours);
  const baseTemp = (mode.targetTemp.min + mode.targetTemp.max) / 2;
  const baseHumidity = (mode.targetHumidity.min + mode.targetHumidity.max) / 2;

  for (let index = totalPoints; index >= 0; index -= 1) {
    const timestamp = anchorMs - index * stepHours * 3_600_000;
    const date = new Date(timestamp);
    const seed = `${unit.id}:${index}`;
    let hash = 0;
    for (const character of seed)
      hash = (hash * 31 + character.charCodeAt(0)) | 0;
    const noise = ((hash >>> 0) % 1000) / 1000 - 0.5;
    const temperatureWobble = Math.sin(index / 5) * 0.14 + noise * 0.1;
    const humidityWobble = Math.cos(index / 4) * 1.2 + noise * 0.8;
    let temperature = baseTemp + temperatureWobble;
    let humidity = baseHumidity + humidityWobble;

    if (unit.status === "alert" && index < 8) temperature += (8 - index) * 0.2;
    if (unit.status === "warning" && index < 12) humidity -= (12 - index) * 0.4;

    points.push({
      ts: timestamp,
      time:
        index < 24
          ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : date.toLocaleDateString([], { month: "short", day: "numeric" }),
      temp: Number(temperature.toFixed(2)),
      humidity: Number(humidity.toFixed(1)),
    });
  }

  return points;
}
