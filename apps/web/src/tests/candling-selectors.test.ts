import { describe, expect, it } from "vitest";
import type { CandlingCheckpoint, CandlingLogEntry } from "../app/domain/types";
import {
  formatCheckpointTiming,
  selectCandlingFeedNodes,
  selectCandlingTallyValidation,
  selectPendingCheckpoint,
} from "../app/features/candling/selectors";

const candling: CandlingCheckpoint[] = [
  { label: "First candling", dayRange: "Day 5 to 7", day: 6 },
  { label: "Second candling", dayRange: "Day 12 to 14", day: 13 },
  { label: "Lockdown check", dayRange: "Day 18", day: 18 },
];

function entry(day: number, label = `Day ${day}`): CandlingLogEntry {
  return {
    day,
    label,
    date: "2026-09-04",
    fertile: 20,
    clear: 1,
    uncertain: 0,
    note: "",
    photos: [],
    checks: [],
  };
}

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
    expect(formatCheckpointTiming({ ...candling[0], day: 6 }, 9)).toBe(
      "3 days overdue",
    );
    expect(formatCheckpointTiming({ ...candling[0], day: 6 }, 6)).toBe(
      "Due today",
    );
    expect(formatCheckpointTiming({ ...candling[1], day: 13 }, 9)).toBe(
      "In 4 days",
    );
    expect(formatCheckpointTiming(null, 20)).toBe(
      "All scheduled checks completed",
    );
  });
});

describe("selectCandlingFeedNodes", () => {
  it("replaces a scheduled milestone with its logged entry", () => {
    const nodes = selectCandlingFeedNodes(candling, [entry(6)]);

    expect(nodes.map((node) => [node.kind, node.day])).toEqual([
      ["logged", 6],
      ["milestone", 13],
      ["milestone", 18],
    ]);
  });

  it("merges custom-day entries and returns ascending day order", () => {
    const nodes = selectCandlingFeedNodes(candling, [
      entry(15),
      entry(4),
      entry(13),
    ]);

    expect(nodes.map((node) => [node.kind, node.day])).toEqual([
      ["logged", 4],
      ["milestone", 6],
      ["logged", 13],
      ["logged", 15],
      ["milestone", 18],
    ]);
  });

  it("keeps the first entry when duplicate logs target a checkpoint day", () => {
    const first = entry(6, "First");
    const duplicate = entry(6, "Duplicate");
    const nodes = selectCandlingFeedNodes(candling, [first, duplicate]);
    const logged = nodes.find((node) => node.kind === "logged");

    expect(logged?.kind === "logged" ? logged.entry : null).toBe(first);
    expect(nodes.filter((node) => node.day === 6)).toHaveLength(1);
  });
});

describe("selectCandlingTallyValidation", () => {
  const emptyCounts = {
    fertile: 0,
    clear: 0,
    uncertain: 0,
    developing: 0,
    stoppedDeveloping: 0,
  };

  it("uses fertility categories for a first checkpoint", () => {
    expect(
      selectCandlingTallyValidation(
        { ...emptyCounts, fertile: 20, clear: 10, uncertain: 3 },
        {
          isLaterCheckpoint: false,
          isLockdownCheckpoint: false,
          totalEggsSet: 38,
          customDayError: false,
        },
      ),
    ).toEqual({
      inspected: 33,
      unaccountedEggs: 5,
      isTallyOverCapacity: false,
      isZeroTally: false,
      hasUnresolvedUncertain: false,
      hasIncompleteLockdown: false,
      isSaveDisabled: false,
    });
  });

  it("uses development categories for a later checkpoint", () => {
    const result = selectCandlingTallyValidation(
      {
        ...emptyCounts,
        fertile: 38,
        developing: 20,
        clear: 5,
        uncertain: 2,
        stoppedDeveloping: 3,
      },
      {
        isLaterCheckpoint: true,
        isLockdownCheckpoint: false,
        totalEggsSet: 38,
        customDayError: false,
      },
    );

    expect(result.inspected).toBe(30);
    expect(result.unaccountedEggs).toBe(8);
  });

  it("blocks unresolved or incomplete lockdown tallies", () => {
    const result = selectCandlingTallyValidation(
      { ...emptyCounts, developing: 30, clear: 7, uncertain: 1 },
      {
        isLaterCheckpoint: true,
        isLockdownCheckpoint: true,
        totalEggsSet: 40,
        customDayError: false,
      },
    );

    expect(result.hasUnresolvedUncertain).toBe(true);
    expect(result.hasIncompleteLockdown).toBe(true);
    expect(result.isSaveDisabled).toBe(true);
  });

  it("blocks zero, over-capacity, and invalid custom-day states", () => {
    const context = {
      isLaterCheckpoint: false,
      isLockdownCheckpoint: false,
      totalEggsSet: 38,
      customDayError: false,
    };

    expect(
      selectCandlingTallyValidation(emptyCounts, context).isSaveDisabled,
    ).toBe(true);
    expect(
      selectCandlingTallyValidation({ ...emptyCounts, fertile: 39 }, context)
        .isSaveDisabled,
    ).toBe(true);
    expect(
      selectCandlingTallyValidation(
        { ...emptyCounts, fertile: 38 },
        { ...context, customDayError: true },
      ).isSaveDisabled,
    ).toBe(true);
  });
});
