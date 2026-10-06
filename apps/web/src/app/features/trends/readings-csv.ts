import type { Reading } from "../../domain/types";

export function buildReadingsCsv(
  rows: { chamber: string; reading: Reading }[],
): string {
  const csvCell = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = "Chamber,Timestamp,Temperature (C),Humidity (%)";
  const records = rows.map(({ chamber, reading }) =>
    [
      chamber,
      new Date(reading.ts).toISOString(),
      reading.temp,
      reading.humidity,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header, ...records].join("\n");
}
