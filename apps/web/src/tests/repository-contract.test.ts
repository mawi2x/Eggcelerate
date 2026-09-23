import { describe, expect, it } from "vitest";
import { ApiRepository } from "../app/data/repositories/api-repository";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import type { EggcelerateRepository } from "../app/data/repositories/repository";

// Normal web tests run the memory adapter. The explicit test:contract script
// requires a local API URL and adds the HTTP transport target; these cases mutate
// their farm and must never target shared or production data.
const liveUrl = process.env.EGG_API_URL;
const targets: [string, () => EggcelerateRepository][] = [
  ["memory", () => new InMemoryEggcelerateRepository({})],
];
if (liveUrl) {
  targets.push(["http", () => new ApiRepository({ baseUrl: liveUrl })]);
}

describe.each(targets)("repository contract (%s)", (_name, factory) => {
  it("lists the seeded farm and reads one chamber", async () => {
    const repository = factory();
    const listed = await repository.listIncubators();
    expect(listed.ok && listed.data).toHaveLength(12);
    const one = await repository.getIncubator("chamber-1");
    expect(one.ok && one.data.name).toBe("Chamber One");
    expect(one.ok && one.data.telemetryStatus).toBe("offline");
    expect(one.ok && one.data.connectionState).toBe("offline");
    const missing = await repository.getIncubator("chamber-99");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("not_found");
  });

  it("rejects a second chamber assignment for the same device", async () => {
    const repository = factory();
    const original = await repository.getIncubator("chamber-1");
    if (!original.ok) throw new Error("Seeded chamber missing");
    const duplicate = await repository.addIncubator({
      ...original.data,
      id: "duplicate-device-assignment",
      name: "Duplicate device",
      deviceId: original.data.deviceId.toLowerCase(),
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe("conflict");
  });

  it("renames through the profile command", async () => {
    const repository = factory();
    const renamed = await repository.updateIncubatorProfile("chamber-5", {
      name: "Renamed Five",
    });
    expect(renamed.ok && renamed.data.name).toBe("Renamed Five");
    expect(renamed.ok && renamed.data.id).toBe("chamber-5");
  });

  it("reconfigures mode and interval with derived state", async () => {
    const repository = factory();
    const changed = await repository.updateIncubatorConfiguration("chamber-6", {
      modeId: "duck",
      turnIntervalHours: 6,
    });
    expect(changed.ok && changed.data.modeId).toBe("duck");
    expect(changed.ok && changed.data.turnInterval).toBe(6);
  });

  it("accepts a manual turn without claiming device execution", async () => {
    const repository = factory();
    const before = await repository.getIncubator("chamber-7");
    if (!before.ok) throw new Error("chamber-7 missing");
    const turned = await repository.requestManualTurn("chamber-7");
    expect(turned.ok).toBe(true);
    if (!turned.ok) return;
    expect(turned.data.status).toBe("pending");
    const command = await repository.getTurnCommand(
      "chamber-7",
      turned.data.id,
    );
    expect(command.ok).toBe(true);
    if (command.ok)
      expect([
        "pending",
        "dispatched",
        "acked",
        "rejected",
        "timed_out",
      ]).toContain(command.data.status);
    const after = await repository.getIncubator("chamber-7");
    expect(after.ok && after.data.lastTurned).toBe(before.data.lastTurned);
    expect(after.ok && after.data.nextTurn).toBe(before.data.nextTurn);
  });

  it("reconnects a chamber without claiming it has reported telemetry", async () => {
    const repository = factory();
    const reconnected = await repository.reconnectIncubator("chamber-2");
    expect(reconnected.ok && reconnected.data.paired).toBe(true);
    expect(reconnected.ok && reconnected.data.connectionState).toBe("offline");
    expect(reconnected.ok && reconnected.data.telemetryStatus).toBe("offline");
  });

  it("creates and deletes a candling entry by day", async () => {
    const repository = factory();
    const created = await repository.createCandlingEntry("chamber-10", {
      day: 50,
      label: "Contract check",
      date: "2026-09-03",
      fertile: 10,
      clear: 1,
      uncertain: 0,
      note: "",
      photos: [],
      checks: [],
    });
    expect(created.ok && created.data.candled[50]).toBe(true);
    const deleted = await repository.deleteCandlingEntry("chamber-10", 50);
    expect(deleted.ok).toBe(true);
    expect(
      deleted.ok && deleted.data.candlingLog.some((entry) => entry.day === 50),
    ).toBe(false);
  });

  it("starts and resets a cycle", async () => {
    const repository = factory();
    const started = await repository.startCycle("chamber-9", {
      modeId: "quail",
      totalEggs: 20,
    });
    expect(started.ok && started.data.dayOfIncubation).toBe(1);
    expect(started.ok && started.data.cyclePhase).toBe("incubating");
    const reset = await repository.resetStoppedCycle("chamber-9");
    expect(reset.ok && reset.data.dayOfIncubation).toBe(0);
    expect(reset.ok && reset.data.cyclePhase).toBe("ready");
  });

  it("stops a cycle as stopped_early with a record", async () => {
    const repository = factory();
    const stopped = await repository.stopCycle({
      incubatorId: "chamber-11",
      incubator: "Chamber Eleven",
      modeName: "Swan",
      dayStopped: 29,
      totalEggs: 16,
      fertileEggs: null,
    });
    expect(stopped.ok && stopped.data.dayStopped).toBe(29);
    const unit = await repository.getIncubator("chamber-11");
    expect(unit.ok && unit.data.cyclePhase).toBe("stopped_early");
  });

  it("completes a cycle atomically with a record", async () => {
    const repository = factory();
    const completed = await repository.completeCycle({
      incubatorId: "chamber-10",
      chamber: "Chamber Ten",
      modeName: "Duck",
      cycleDays: 3,
      totalEggs: 32,
      fertileEggs: null,
      hatchedEggs: 20,
    });
    expect(completed.ok && completed.data.hatchedEggs).toBe(20);
    const unit = await repository.getIncubator("chamber-10");
    expect(unit.ok && unit.data.dayOfIncubation).toBe(0);
  });

  it.each(["stop", "complete"] as const)(
    "rejects a second terminal outcome after %s",
    async (first) => {
      const repository = factory();
      const id = first === "stop" ? "chamber-8" : "chamber-7";
      expect(
        (await repository.startCycle(id, { modeId: "broiler", totalEggs: 20 }))
          .ok,
      ).toBe(true);
      const completion = {
        incubatorId: id,
        chamber: "Cycle test",
        modeName: "Broiler",
        cycleDays: 1,
        totalEggs: 20,
        fertileEggs: null,
        hatchedEggs: 10,
      };
      const stopping = {
        incubatorId: id,
        incubator: "Cycle test",
        modeName: "Broiler",
        dayStopped: 1,
        totalEggs: 20,
        fertileEggs: null,
      };
      expect(
        (
          await (first === "stop"
            ? repository.stopCycle(stopping)
            : repository.completeCycle(completion))
        ).ok,
      ).toBe(true);
      // A profile edit must not reopen a stopped cycle.
      await repository.updateIncubatorProfile(id, { name: "Terminal cycle" });
      if (first === "stop") {
        const unit = await repository.getIncubator(id);
        expect(unit.ok && unit.data.cyclePhase).toBe("stopped_early");
        expect(unit.ok && unit.data.status).toBe("warning");
      }
      for (const result of [
        await repository.completeCycle(completion),
        await repository.stopCycle(stopping),
      ]) {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe("conflict");
      }
    },
  );

  it("reads ordered bounded windows", async () => {
    const repository = factory();
    for (const [window, count] of [
      ["24h", 13],
      ["7d", 85],
      ["full", 109],
    ] as const) {
      const readings = await repository.listReadings({
        incubatorId: "chamber-1",
        window,
      });
      expect(readings.ok).toBe(true);
      if (_name === "memory")
        expect(readings.ok && readings.data).toHaveLength(count);
      if (!readings.ok) continue;
      const stamps = readings.data.map((point) => point.ts);
      expect([...stamps].sort((a, b) => a - b)).toEqual(stamps);
    }
  });

  it("rejects invalid commands the same way", async () => {
    const repository = factory();
    const badStart = await repository.startCycle("chamber-1", {
      modeId: "broiler",
      totalEggs: 0,
    });
    expect(badStart.ok).toBe(false);
    if (!badStart.ok) expect(badStart.error.code).toBe("validation_error");
  });
});
