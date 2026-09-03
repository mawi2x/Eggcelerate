import { describe, expect, it } from "vitest";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import { resetChamberToReady } from "../app/domain/incubator";

const fixedNow = () => new Date("2026-09-03T12:00:00.000Z");

describe("InMemoryEggcelerateRepository", () => {
  it("starts from fresh fixture copies and does not leak returned mutations", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const first = await repository.listIncubators();
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data).toHaveLength(12);
    first.data[0].name = "Changed outside repository";

    const second = await repository.getIncubator("chamber-1");
    expect(second.ok && second.data.name).toBe("Chamber One");
  });

  it("returns a structured not-found result", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const result = await repository.getIncubator("missing");
    expect(result).toEqual({
      ok: false,
      error: { code: "not_found", message: "Incubator missing was not found.", details: undefined },
    });
  });

  it("rejects incubators that reference an unknown mode", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const existing = await repository.getIncubator("chamber-1");
    if (!existing.ok) throw new Error("Fixture incubator was not found.");

    const result = await repository.addIncubator({
      ...existing.data,
      id: "new-chamber",
      modeId: "missing-mode",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("keeps entity IDs immutable during updates", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const result = await repository.updateIncubator("chamber-1", {
      id: "replacement-id",
      name: "Renamed chamber",
    });

    expect(result.ok && result.data.id).toBe("chamber-1");
    expect(result.ok && result.data.name).toBe("Renamed chamber");
    const replacement = await repository.getIncubator("replacement-id");
    expect(replacement.ok).toBe(false);
  });

  it("persists a chamber reset through the update boundary", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const existing = await repository.getIncubator("chamber-1");
    if (!existing.ok) throw new Error("Fixture incubator was not found.");

    const reset = await repository.updateIncubator(
      existing.data.id,
      resetChamberToReady(existing.data),
    );
    const reloaded = await repository.getIncubator(existing.data.id);

    expect(reset.ok && reset.data.dayOfIncubation).toBe(0);
    expect(reloaded.ok && reloaded.data.cyclePhase).toBe("ready");
    expect(reloaded.ok && reloaded.data.totalEggsLoaded).toBe(0);
  });

  it("recalculates affected chamber condition when a mode changes", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const update = await repository.updateMode("broiler", {
      targetTemp: { min: 35, max: 35.5 },
    });
    expect(update.ok).toBe(true);

    const chamber = await repository.getIncubator("chamber-1");
    expect(chamber.ok && chamber.data.conditionSeverity).toBe("critical");
    expect(chamber.ok && chamber.data.status).toBe("alert");
  });

  it("records then lists a harvest without exposing mutable state", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const before = await repository.listHatchRecords();
    const created = await repository.recordHarvest({
      chamber: "Test Chamber",
      modeName: "Broiler",
      cycleDays: 21,
      totalEggs: 12,
      fertileEggs: 10,
      hatchedEggs: 9,
    });
    const after = await repository.listHatchRecords();

    expect(before.ok && before.data).toHaveLength(12);
    expect(created.ok && created.data.endDate).toBe("2026-09-03");
    expect(after.ok && after.data).toHaveLength(13);
  });

  it("rejects an invalid harvest without writing history", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const result = await repository.recordHarvest({
      chamber: "Test Chamber",
      modeName: "Broiler",
      cycleDays: 21,
      totalEggs: 12,
      fertileEggs: 8,
      hatchedEggs: 9,
    });
    const records = await repository.listHatchRecords();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
    expect(records.ok && records.data).toHaveLength(12);
  });

  it("completes a cycle and resets its incubator atomically", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const result = await repository.completeCycle({
      incubatorId: "chamber-1",
      chamber: "Chamber One",
      modeName: "Broiler",
      cycleDays: 21,
      totalEggs: 12,
      fertileEggs: 10,
      hatchedEggs: 9,
    });
    const records = await repository.listHatchRecords();
    const chamber = await repository.getIncubator("chamber-1");

    expect(result.ok && result.data.incubator.cyclePhase).toBe("ready");
    expect(records.ok && records.data).toHaveLength(13);
    expect(chamber.ok && chamber.data.totalEggsLoaded).toBe(0);
  });

  it("does not partially write a cycle completion that times out", async () => {
    const repository = new InMemoryEggcelerateRepository({
      now: fixedNow,
      failureModes: { completeCycle: "timeout" },
    });
    const result = await repository.completeCycle({
      incubatorId: "chamber-1",
      chamber: "Chamber One",
      modeName: "Broiler",
      cycleDays: 21,
      totalEggs: 12,
      fertileEggs: 10,
      hatchedEggs: 9,
    });
    const records = await repository.listHatchRecords();
    const chamber = await repository.getIncubator("chamber-1");

    expect(result.ok).toBe(false);
    expect(records.ok && records.data).toHaveLength(12);
    expect(chamber.ok && chamber.data.cyclePhase).not.toBe("ready");
  });

  it("prevents deleting an assigned mode", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const result = await repository.deleteMode("broiler");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("conflict");
  });

  it("records aborted cycles through the same mutable owner", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const result = await repository.recordAbortedCycle({
      incubator: "Chamber One",
      modeName: "Broiler",
      dayStopped: 8,
      totalEggs: 24,
      fertileEggs: 22,
    });
    const records = await repository.listAbortedCycles();
    expect(result.ok).toBe(true);
    expect(records.ok && records.data).toHaveLength(1);
  });

  it("archives and stops a cycle as one repository command", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const result = await repository.stopCycle({
      incubatorId: "chamber-1",
      incubator: "Chamber One",
      modeName: "Broiler",
      dayStopped: 8,
      totalEggs: 24,
      fertileEggs: 22,
    });
    const records = await repository.listAbortedCycles();
    const chamber = await repository.getIncubator("chamber-1");

    expect(result.ok && result.data.incubator.cyclePhase).toBe("stopped_early");
    expect(records.ok && records.data).toHaveLength(1);
    expect(chamber.ok && chamber.data.status).toBe("warning");
  });

  it("rejects inconsistent aborted-cycle counts", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const result = await repository.recordAbortedCycle({
      incubator: "Chamber One",
      modeName: "Broiler",
      dayStopped: 8,
      totalEggs: 12,
      fertileEggs: 13,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("can simulate operation failures without screen-specific flags", async () => {
    const repository = new InMemoryEggcelerateRepository({
      now: fixedNow,
      failOperations: ["listAlerts"],
    });
    const result = await repository.listAlerts();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("simulated_failure");
  });
});
