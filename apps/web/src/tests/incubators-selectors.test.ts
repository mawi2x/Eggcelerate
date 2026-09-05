import { describe, expect, it } from "vitest";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { createModeFixtures } from "../app/data/fixtures/modes";
import {
  selectFilteredIncubators,
  selectSortedIncubators,
} from "../app/features/incubators/selectors";

const modes = createModeFixtures();
const units = createIncubatorFixtures(modes, Date.UTC(2026, 8, 3));

describe("selectFilteredIncubators", () => {
  it("returns all units when filters are open and query is blank", () => {
    expect(
      selectFilteredIncubators(units, modes, {
        search: "   ",
        status: "all",
        modeId: "all",
      }),
    ).toHaveLength(units.length);
  });

  it("filters by chamber status", () => {
    const expected = units.filter((u) => u.status === "alert").length;
    expect(expected).toBeGreaterThan(0);
    expect(
      selectFilteredIncubators(units, modes, {
        search: "",
        status: "alert",
        modeId: "all",
      }),
    ).toHaveLength(expected);
  });

  it("matches chamber name case-insensitively with trimming", () => {
    const result = selectFilteredIncubators(units, modes, {
      search: "  CHAMBER one ",
      status: "all",
      modeId: "all",
    });
    expect(result.map((u) => u.name)).toContain("Chamber One");
  });

  it("matches resolved mode name", () => {
    const result = selectFilteredIncubators(units, modes, {
      search: "duck",
      status: "all",
      modeId: "all",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every((u) => {
        const mode = modes.find((m) => m.id === u.modeId) ?? modes[0];
        return (
          u.name.toLowerCase().includes("duck") ||
          mode.name.toLowerCase().includes("duck")
        );
      }),
    ).toBe(true);
  });

  it("combines status, mode, and query", () => {
    const result = selectFilteredIncubators(units, modes, {
      search: "chamber",
      status: "optimal",
      modeId: "broiler",
    });
    expect(
      result.every((u) => u.status === "optimal" && u.modeId === "broiler"),
    ).toBe(true);
  });
});

describe("selectSortedIncubators", () => {
  it("sorts by name ascending without mutating input", () => {
    const input = [...units];
    const snapshot = input.map((u) => u.id);
    const result = selectSortedIncubators(input, modes, {
      sort: "name",
      sortAsc: true,
    });
    expect(result.map((u) => u.id).sort()).toEqual([...snapshot].sort());
    expect(input.map((u) => u.id)).toEqual(snapshot);
    // Chamber names use word numbers, so natural order is One..Twelve,
    // matching the screen behavior before extraction.
    expect(result.map((u) => u.name)).toEqual([
      "Chamber One",
      "Chamber Two",
      "Chamber Three",
      "Chamber Four",
      "Chamber Five",
      "Chamber Six",
      "Chamber Seven",
      "Chamber Eight",
      "Chamber Nine",
      "Chamber Ten",
      "Chamber Eleven",
      "Chamber Twelve",
    ]);
  });

  it("reverses direction when sortAsc is false", () => {
    const asc = selectSortedIncubators(units, modes, {
      sort: "name",
      sortAsc: true,
    });
    const desc = selectSortedIncubators(units, modes, {
      sort: "name",
      sortAsc: false,
    });
    const pinned = (u: (typeof units)[number]) =>
      u.cyclePhase === "completed" || u.cyclePhase === "ready";
    // Action-needed chambers pin to the top in both directions; the rest
    // reverses.
    expect(asc.filter((u) => !pinned(u)).map((u) => u.id)).toEqual(
      desc
        .filter((u) => !pinned(u))
        .map((u) => u.id)
        .reverse(),
    );
    expect(asc.slice(0, asc.filter(pinned).length).every(pinned)).toBe(true);
    expect(desc.slice(0, desc.filter(pinned).length).every(pinned)).toBe(true);
  });

  it("sorts by remaining hatch time for progress", () => {
    const result = selectSortedIncubators(units, modes, {
      sort: "progress",
      sortAsc: true,
    });
    expect(result).toHaveLength(units.length);
  });

  it("pins completed then ready chambers to the top in every sort", () => {
    const trial = [
      {
        ...units[1],
        id: "mid",
        name: "Chamber Mid",
        cyclePhase: "incubating" as const,
        dayOfIncubation: 10,
      },
      {
        ...units[2],
        id: "rdy",
        name: "Chamber Ready",
        cyclePhase: "ready" as const,
        dayOfIncubation: 0,
      },
      {
        ...units[3],
        id: "done",
        name: "Chamber Done",
        cyclePhase: "completed" as const,
        dayOfIncubation: 99,
      },
    ];
    for (const sort of ["progress", "name"] as const) {
      for (const sortAsc of [true, false]) {
        expect(
          selectSortedIncubators(trial, modes, { sort, sortAsc }).map(
            (u) => u.id,
          ),
        ).toEqual(["done", "rdy", "mid"]);
      }
    }
  });
});
