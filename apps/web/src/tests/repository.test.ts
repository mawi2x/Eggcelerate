import { describe, expect, it } from "vitest";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";

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
      error: {
        code: "not_found",
        message: "Incubator missing was not found.",
        details: undefined,
      },
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
    const result = await repository.updateIncubatorProfile("chamber-1", {
      name: "Renamed chamber",
    });

    expect(result.ok && result.data.id).toBe("chamber-1");
    expect(result.ok && result.data.name).toBe("Renamed chamber");
    const replacement = await repository.getIncubator("replacement-id");
    expect(replacement.ok).toBe(false);
  });

  it("persists a chamber reset through the command boundary", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const existing = await repository.getIncubator("chamber-1");
    if (!existing.ok) throw new Error("Fixture incubator was not found.");

    const reset = await repository.resetStoppedCycle(existing.data.id);
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

  it("does not expose standalone history writers or broad updates", () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    expect(repository).not.toHaveProperty("recordHarvest");
    expect(repository).not.toHaveProperty("recordAbortedCycle");
    expect(repository).not.toHaveProperty("updateIncubator");
  });

  it("rejects an invalid harvest without writing history", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const result = await repository.completeCycle({
      incubatorId: "chamber-1",
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
    const result = await repository.stopCycle({
      incubatorId: "chamber-1",
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
  it("validates profile and configuration commands", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    for (const name of ["", "   ", "x".repeat(31)]) {
      const bad = await repository.updateIncubatorProfile("chamber-1", {
        name,
      });
      expect(bad.ok).toBe(false);
      if (!bad.ok) expect(bad.error.code).toBe("validation_error");
    }
    const renamed = await repository.updateIncubatorProfile("chamber-1", {
      name: "Renamed chamber",
    });
    expect(renamed.ok && renamed.data.name).toBe("Renamed chamber");

    const empty = await repository.updateIncubatorConfiguration(
      "chamber-1",
      {},
    );
    expect(empty.ok).toBe(false);
    const badMode = await repository.updateIncubatorConfiguration("chamber-1", {
      modeId: "no-such-mode",
    });
    expect(badMode.ok).toBe(false);
    if (!badMode.ok) expect(badMode.error.code).toBe("validation_error");
    const configured = await repository.updateIncubatorConfiguration(
      "chamber-1",
      {
        modeId: "duck",
        autoTurn: false,
        turnIntervalHours: 6,
      },
    );
    expect(configured.ok && configured.data.modeId).toBe("duck");
    expect(configured.ok && configured.data.turnInterval).toBe(6);
    const missing = await repository.updateIncubatorProfile("nope", {
      name: "x",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("not_found");
  });

  it("starts cycles and turns with server-derived state", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const badEggs = await repository.startCycle("chamber-1", {
      modeId: "broiler",
      totalEggs: 0,
    });
    expect(badEggs.ok).toBe(false);
    const badMode = await repository.startCycle("chamber-1", {
      modeId: "no-such-mode",
      totalEggs: 12,
    });
    expect(badMode.ok).toBe(false);
    const started = await repository.startCycle("chamber-1", {
      modeId: "broiler",
      totalEggs: 24,
    });
    expect(started.ok && started.data.dayOfIncubation).toBe(1);
    expect(started.ok && started.data.cyclePhase).toBe("incubating");
    expect(started.ok && started.data.totalEggsLoaded).toBe(24);
    expect(started.ok && started.data.turnInterval).toBe(4);
    expect(started.ok && started.data.lastTurned).toBe(
      "2026-09-03T12:00:00.000Z",
    );

    const turned = await repository.requestManualTurn("chamber-1");
    expect(turned.ok && turned.data.lastTurned).toBe(
      "2026-09-03T12:00:00.000Z",
    );
    expect(turned.ok && turned.data.nextTurn).toBe("2026-09-03T16:00:00.000Z");
    const missing = await repository.requestManualTurn("nope");
    expect(missing.ok).toBe(false);
  });

  it("re-pairs without claiming reachability and reports unreachable devices", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const listed = await repository.listIncubators();
    if (!listed.ok) throw new Error("Fixture incubators failed to load.");
    const stranded = listed.data.find((unit) =>
      ["EGG-0000", "EGG-9999", "EGG-1005", "EGG-1010"].includes(unit.deviceId),
    );
    if (!stranded) throw new Error("Unreachable fixture is missing.");
    const offline = await repository.reconnectIncubator(stranded.id);
    expect(offline.ok).toBe(false);
    if (!offline.ok) expect(offline.error.code).toBe("offline");

    const reconnected = await repository.reconnectIncubator("chamber-1");
    expect(reconnected.ok && reconnected.data.paired).toBe(true);
    expect(reconnected.ok && reconnected.data.telemetryStatus).toBe("offline");
    expect(reconnected.ok && reconnected.data.connectionState).toBe("offline");
  });

  it("creates, updates, and deletes candling entries by day", async () => {
    const repository = new InMemoryEggcelerateRepository({ now: fixedNow });
    const input = {
      day: 99,
      label: "Late check",
      date: "2026-09-03",
      fertile: 20,
      clear: 1,
      uncertain: 0,
      note: "",
      photos: [],
      checks: [],
      checkpointType: "later" as const,
    };
    const created = await repository.createCandlingEntry("chamber-1", input);
    expect(created.ok && created.data.candled[99]).toBe(true);
    const duplicate = await repository.createCandlingEntry("chamber-1", input);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe("conflict");

    const updated = await repository.updateCandlingEntry("chamber-1", 99, {
      note: "Recheck tomorrow",
    });
    expect(
      updated.ok &&
        updated.data.candlingLog.find((entry) => entry.day === 99)?.note,
    ).toBe("Recheck tomorrow");
    const missingUpdate = await repository.updateCandlingEntry(
      "chamber-1",
      100,
      {
        note: "Ghost",
      },
    );
    expect(missingUpdate.ok).toBe(false);

    const deleted = await repository.deleteCandlingEntry("chamber-1", 99);
    expect(
      deleted.ok && deleted.data.candlingLog.some((entry) => entry.day === 99),
    ).toBe(false);
    expect(deleted.ok && deleted.data.candled[99]).toBe(false);
    const missingDelete = await repository.deleteCandlingEntry("chamber-1", 99);
    expect(missingDelete.ok).toBe(false);
  });
});
