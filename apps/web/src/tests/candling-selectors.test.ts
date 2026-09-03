import { describe, expect, it } from "vitest";
import {
  formatCheckpointTiming,
  selectPendingCheckpoint,
} from "../app/features/candling/selectors";
import type { CandlingCheckpoint } from "../app/domain/types";

const candling: CandlingCheckpoint[] = [
  { label: "First candling", dayRange: "Day 5 to 7", day: 6 },
  { label: "Second candling", dayRange: "Day 12 to 14", day: 13 },
  { label: "Lockdown check", dayRange: "Day 18", day: 18 },
];

describe("selectPendingCheckpoint", () => {
  it("prefers overdue unlogged checkpoints", () => {
    expect(selectPendingCheckpoint(candling, {}, 9)?.day).toBe(6);
  });

  it("falls through to upcoming when overdue are done", () => {
    expect(selectPendingCheckpoint(candling, { 6: true }, 9)?.day).toBe(13);
  });

  it("returns null when all are logged", () => {
    expect(
      selectPendingCheckpoint(candling, { 6: true, 13: true, 18: true }, 20),
    ).toBeNull();
  });
});

describe("formatCheckpointTiming", () => {
  it("formats overdue, due-today, upcoming, and complete", () => {
    expect(formatCheckpointTiming({ ...candling[0], day: 6 }, 9)).toBe("3 days overdue");
    expect(formatCheckpointTiming({ ...candling[0], day: 6 }, 6)).toBe("Due today");
    expect(formatCheckpointTiming({ ...candling[1], day: 13 }, 9)).toBe("In 4 days");
    expect(formatCheckpointTiming(null, 20)).toBe("All scheduled checks completed");
  });
});
