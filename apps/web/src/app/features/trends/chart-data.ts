import type { Reading } from "../../domain/types";

export const CHART_POINT_LIMIT = 600;
export function aggregateReadings(
  points: Reading[],
  start: number,
  end: number,
): Reading[] {
  const seconds = Math.max(
    1,
    Math.ceil((end - start) / 1000 / (CHART_POINT_LIMIT - 1)),
  );
  const buckets = new Map<number, Reading[]>();
  for (const point of points) {
    if (point.ts < start || point.ts >= end) continue;
    const at = Math.floor(point.ts / (seconds * 1000)) * seconds * 1000;
    const group = buckets.get(at);
    if (group) group.push(point);
    else buckets.set(at, [point]);
  }
  return Array.from(buckets)
    .sort(([a], [b]) => a - b)
    .map(([ts, group]) => ({
      ts,
      time: new Date(ts).toLocaleString(),
      temp: group.reduce((sum, p) => sum + p.temp, 0) / group.length,
      humidity: group.reduce((sum, p) => sum + p.humidity, 0) / group.length,
      tempMin: group.reduce((best, p) => Math.min(best, p.temp), Infinity),
      tempMax: group.reduce((best, p) => Math.max(best, p.temp), -Infinity),
      humidityMin: group.reduce(
        (best, p) => Math.min(best, p.humidity),
        Infinity,
      ),
      humidityMax: group.reduce(
        (best, p) => Math.max(best, p.humidity),
        -Infinity,
      ),
      bucketSeconds: seconds,
      sampleCount: group.length,
    }));
}

/** Null sentinels break lines across empty buckets; absent compare samples stay null. */
export function mergeChartReadings(
  ids: readonly string[],
  readings: Record<string, Reading[]>,
  metric: "temp" | "humidity",
) {
  const rows = new Map<
    number,
    {
      ts: number;
      time: string;
      [key: string]: number | string | number[] | null;
    }
  >();
  const rowAt = (ts: number, time: string) => {
    let row = rows.get(ts);
    if (!row) {
      row = { ts, time };
      rows.set(ts, row);
    }
    return row;
  };
  for (const id of ids) {
    const points = readings[id] ?? [];
    for (let index = 0; index < points.length; index++) {
      const p = points[index];
      const next = points[index + 1];
      const row = rowAt(p.ts, p.time);
      row[id] = metric === "temp" ? p.temp : p.humidity;
      row[`${id}_range`] =
        metric === "temp"
          ? [p.tempMin ?? p.temp, p.tempMax ?? p.temp]
          : [p.humidityMin ?? p.humidity, p.humidityMax ?? p.humidity];
      if (next && p.bucketSeconds && next.ts - p.ts > p.bucketSeconds * 1000) {
        const gap = rowAt(p.ts + p.bucketSeconds * 1000, "No readings");
        gap[id] = null;
        gap[`${id}_range`] = null;
      }
    }
  }
  return Array.from(rows.values()).sort((a, b) => a.ts - b.ts);
}
