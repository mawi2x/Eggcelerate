import { describe, expect, it } from "vitest";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { createModeFixtures } from "../app/data/fixtures/modes";
import {
  selectFilteredIncubators,
  selectIncubatorStatusFilterCounts,
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

  it("filters the Issues bucket to warning and alert chambers", () => {
    const expected = units.filter((u) => u.status !== "optimal").length;
    expect(expected).toBeGreaterThan(0);
    const result = selectFilteredIncubators(units, modes, {
      search: "",
      status: "issues",
      modeId: "all",
    });
    expect(result).toHaveLength(expected);
    expect(
      result.every((u) => u.status === "warning" || u.status === "alert"),
    ).toBe(true);
  });

  it("keeps the Optimal bucket limited to optimal chambers", () => {
    const testUnits = [
      { ...units[0], id: "optimal", status: "optimal" as const },
      ...units,
    ];
    const result = selectFilteredIncubators(testUnits, modes, {
      search: "",
      status: "optimal",
      modeId: "all",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((u) => u.status === "optimal")).toBe(true);
  });

  it("counts the three status filter buckets without changing domain statuses", () => {
    const counts = selectIncubatorStatusFilterCounts(units);
    expect(counts).toEqual({
      all: units.length,
      optimal: units.filter((u) => u.status === "optimal").length,
      issues: units.filter((u) => u.status !== "optimal").length,
    });
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

  it("prioritizes alert over warning when the Issues view is active", () => {
    const warningSource = units.find((u) => u.status === "warning");
    const alertSource = units.find((u) => u.status === "alert");
    if (!warningSource || !alertSource) {
      throw new Error("Expected warning and alert fixture units");
    }
    const warning = {
      ...warningSource,
      id: "warning",
      name: "Chamber Warning",
      cyclePhase: "completed" as const,
    };
    const alert = {
      ...alertSource,
      id: "alert",
      name: "Chamber Alert",
      cyclePhase: "incubating" as const,
    };

    expect(
      selectSortedIncubators([warning, alert], modes, {
        sort: "name",
        sortAsc: true,
        prioritizeIssues: true,
      }).map((u) => u.id),
    ).toEqual(["alert", "warning"]);
  });
});
