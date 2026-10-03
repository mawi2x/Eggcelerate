import type { ScopedRawReading } from "../../data/repositories/repository";
export function rawReadingsCsv(rows: ScopedRawReading[]): string {
  const cell = (input: string | number | boolean) => {
    let text = String(input);
    if (typeof input === "string" && /^[\s]*[=+\-@]/.test(text))
      text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `${[
    "Chamber ID,Chamber,Timestamp (UTC),Received (UTC),Temperature (C),Humidity (%),Water OK",
    ...rows.map((p) =>
      [
        p.incubatorId,
        p.chamber,
        new Date(p.reading.ts).toISOString(),
        p.receivedAt,
        p.reading.temp,
        p.reading.humidity,
        p.waterOk,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\n")}\n`;
}
