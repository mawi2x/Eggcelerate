import { describe, expect, it } from "vitest";
import { buildReadingsCsv } from "../app/components/screens/TrendsScreen";

describe("trends CSV export", () => {
  it("includes chamber identity and safely quotes chamber names", () => {
    const csv = buildReadingsCsv([
      {
        chamber: 'North, "A"',
        reading: {
          ts: Date.parse("2026-09-23T10:00:00.000Z"),
          time: "10:00",
          temp: 37.5,
          humidity: 58,
        },
      },
      {
        chamber: "South",
        reading: {
          ts: Date.parse("2026-09-23T10:00:00.000Z"),
          time: "10:00",
          temp: 37.2,
          humidity: 60,
        },
      },
    ]);

    expect(csv.split("\n")).toEqual([
      "Chamber,Timestamp,Temperature (C),Humidity (%)",
      '"North, ""A""",2026-09-23T10:00:00.000Z,37.5,58',
      "South,2026-09-23T10:00:00.000Z,37.2,60",
    ]);
  });
});
