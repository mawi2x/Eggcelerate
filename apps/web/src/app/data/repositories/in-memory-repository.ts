import {
  connectionStateFromPairing,
  deriveConditionState,
} from "../../domain/cycle";
import { localDateString } from "../../domain/date";
import { validateHarvestCounts } from "../../domain/fertility";
import { resetChamberToReady } from "../../domain/incubator";
import type { Result } from "../../domain/result";
import type {
  AbortedCycleRecord,
  AlertEntry,
  HatchRecord,
  Incubator,
  Mode,
} from "../../domain/types";
import { createAlertFixtures } from "../fixtures/alerts";
import { createHatchRecordFixtures } from "../fixtures/hatch-records";
import { createIncubatorFixtures } from "../fixtures/incubators";
import { createModeFixtures } from "../fixtures/modes";
import { createReadingFixtures } from "../fixtures/readings";
import { initialSettings, type SettingsPreferences } from "../settings";
import type {
  AbortedCycleInput,
  CompleteCycleInput,
  EggcelerateRepository,
  HarvestInput,
  ReadingQuery,
  RepositoryFailureMode,
  RepositoryOperation,
  StopCycleInput,
} from "./repository";

export interface InMemoryRepositoryOptions {
  now?: () => Date;
  latencyMs?: number;
  failOperations?: readonly RepositoryOperation[];
  failureModes?: Partial<Record<RepositoryOperation, RepositoryFailureMode>>;
}

const clone = <T>(value: T): T => structuredClone(value);
const ok = <T>(data: T): Result<T> => ({ ok: true, data: clone(data) });
const error = (
  code: string,
  message: string,
  details?: unknown,
): Result<never> => ({
  ok: false,
  error: { code, message, details },
});
const unreachableDeviceIds = new Set([
  "EGG-0000",
  "EGG-9999",
  "EGG-1005",
  "EGG-1010",
]);

export class InMemoryEggcelerateRepository implements EggcelerateRepository {
  private incubators: Incubator[];
  private modes: Mode[];
  private alerts: AlertEntry[];
  private hatchRecords: HatchRecord[];
  private abortedCycles: AbortedCycleRecord[] = [];
  private settings: SettingsPreferences;
  private sequence = 0;
  private readonly now: () => Date;
  private readonly latencyMs: number;
  private readonly failOperations: Set<RepositoryOperation>;
  private readonly failureModes: Partial<
    Record<RepositoryOperation, RepositoryFailureMode>
  >;
  private readonly historyAnchorMs: number;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.latencyMs = Math.max(0, options.latencyMs ?? 0);
    this.failOperations = new Set(options.failOperations ?? []);
    this.failureModes = { ...options.failureModes };
    const seededAt = this.now().getTime();
    this.historyAnchorMs = seededAt;
    this.modes = createModeFixtures();
    this.incubators = createIncubatorFixtures(this.modes, seededAt);
    this.alerts = createAlertFixtures(seededAt);
    this.hatchRecords = createHatchRecordFixtures();
    this.settings = clone(initialSettings);
  }

  private async execute<T>(
    operation: RepositoryOperation,
    action: () => Result<T>,
  ): Promise<Result<T>> {
    if (this.latencyMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs));
    }
    if (this.failOperations.has(operation)) {
      return error(
        "simulated_failure",
        `${operation} failed in the in-memory repository.`,
      );
    }
    const failureMode = this.failureModes[operation];
    if (failureMode === "offline") {
      return error(
        "offline",
        "The service is offline. Your last loaded data is still available.",
      );
    }
    if (failureMode === "rejected") {
      return error(
        "rejected",
        `${operation} was rejected. Review the change and try again.`,
      );
    }
    if (failureMode === "timeout") {
      return error(
        "timeout",
        `${operation} timed out before it was confirmed.`,
      );
    }
    try {
      return action();
    } catch (cause) {
      return error(
        "unknown_error",
        `${operation} failed unexpectedly.`,
        cause instanceof Error ? cause.message : String(cause),
      );
    }
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.now().getTime()}-${this.sequence}`;
  }

  listIncubators() {
    return this.execute("listIncubators", () => ok(this.incubators));
  }

  getIncubator(id: string) {
    return this.execute("getIncubator", () => {
      const unit = this.incubators.find((candidate) => candidate.id === id);
      return unit
        ? ok(unit)
        : error("not_found", `Incubator ${id} was not found.`);
    });
  }

  addIncubator(unit: Incubator) {
    return this.execute("addIncubator", () => {
      if (this.incubators.some((candidate) => candidate.id === unit.id)) {
        return error("conflict", `Incubator ${unit.id} already exists.`);
      }
      const mode = this.modes.find((candidate) => candidate.id === unit.modeId);
      if (!mode) {
        return error(
          "validation_error",
          `Mode ${unit.modeId} is not available for this incubator.`,
        );
      }
      if (unreachableDeviceIds.has(unit.deviceId.toUpperCase())) {
        return error(
          "offline",
          `Device ${unit.deviceId} is offline. Check its power and network connection.`,
        );
      }
      const created: Incubator = {
        ...clone(unit),
        ...deriveConditionState({
          paired: unit.paired,
          temp: unit.temp,
          targetTemp: mode.targetTemp,
          humidity: unit.humidity,
          targetHumidity: mode.targetHumidity,
          waterOk: unit.waterOk,
          batteryPct: unit.batteryPct,
          powerSource: unit.powerSource,
          nextTurn: unit.nextTurn,
        }),
        connectionState: connectionStateFromPairing(unit.paired),
      };
      this.incubators.push(created);
      return ok(created);
    });
  }

  updateIncubator(id: string, patch: Partial<Incubator>) {
    return this.execute("updateIncubator", () => {
      const index = this.incubators.findIndex(
        (candidate) => candidate.id === id,
      );
      if (index < 0)
        return error("not_found", `Incubator ${id} was not found.`);
      if (
        patch.paired === true &&
        unreachableDeviceIds.has(this.incubators[index].deviceId.toUpperCase())
      ) {
        return error(
          "offline",
          `Device ${this.incubators[index].deviceId} is offline. Check its power and network connection.`,
        );
      }
      const next = { ...this.incubators[index], ...clone(patch), id };
      const mode = this.modes.find((candidate) => candidate.id === next.modeId);
      if (!mode) {
        return error(
          "validation_error",
          `Mode ${next.modeId} is not available for this incubator.`,
        );
      }
      const condition = deriveConditionState({
        paired: next.paired,
        temp: next.temp,
        targetTemp: mode.targetTemp,
        humidity: next.humidity,
        targetHumidity: mode.targetHumidity,
        waterOk: next.waterOk,
        batteryPct: next.batteryPct,
        powerSource: next.powerSource,
        nextTurn: next.nextTurn,
      });
      const connectionState =
        patch.connectionState ??
        (patch.paired !== undefined
          ? next.paired
            ? "connected"
            : "offline"
          : next.connectionState);
      const updated: Incubator = { ...next, ...condition, connectionState };
      this.incubators[index] = updated;
      return ok(updated);
    });
  }

  listReadings(query: ReadingQuery) {
    return this.execute("listReadings", () => {
      const unit = this.incubators.find(
        (candidate) => candidate.id === query.incubatorId,
      );
      if (!unit)
        return error(
          "not_found",
          `Incubator ${query.incubatorId} was not found.`,
        );
      const mode = this.modes.find((candidate) => candidate.id === unit.modeId);
      if (!mode)
        return error("not_found", `Mode ${unit.modeId} was not found.`);
      const hours =
        query.window === "24h" ? 24 : query.window === "7d" ? 24 * 7 : null;
      const cutoff =
        hours === null ? 0 : this.historyAnchorMs - hours * 3_600_000;
      return ok(
        createReadingFixtures(unit, mode, this.historyAnchorMs).filter(
          (reading) => reading.ts >= cutoff,
        ),
      );
    });
  }

  listModes() {
    return this.execute("listModes", () => ok(this.modes));
  }

  addMode(mode: Mode) {
    return this.execute("addMode", () => {
      if (this.modes.some((candidate) => candidate.id === mode.id)) {
        return error("conflict", `Mode ${mode.id} already exists.`);
      }
      this.modes.push(clone(mode));
      return ok(mode);
    });
  }

  updateMode(id: string, patch: Partial<Mode>) {
    return this.execute("updateMode", () => {
      const index = this.modes.findIndex((candidate) => candidate.id === id);
      if (index < 0) return error("not_found", `Mode ${id} was not found.`);
      const updated = { ...this.modes[index], ...clone(patch), id };
      this.modes[index] = updated;
      this.incubators = this.incubators.map((unit) =>
        unit.modeId !== id
          ? unit
          : {
              ...unit,
              ...deriveConditionState({
                paired: unit.paired,
                temp: unit.temp,
                targetTemp: updated.targetTemp,
                humidity: unit.humidity,
                targetHumidity: updated.targetHumidity,
                waterOk: unit.waterOk,
                batteryPct: unit.batteryPct,
                powerSource: unit.powerSource,
                nextTurn: unit.nextTurn,
              }),
            },
      );
      return ok(updated);
    });
  }

  deleteMode(id: string) {
    return this.execute("deleteMode", () => {
      if (!this.modes.some((candidate) => candidate.id === id)) {
        return error("not_found", `Mode ${id} was not found.`);
      }
      if (this.incubators.some((unit) => unit.modeId === id)) {
        return error(
          "conflict",
          "This mode is still assigned to an incubator.",
        );
      }
      this.modes = this.modes.filter((mode) => mode.id !== id);
      return ok({ id });
    });
  }

  listAlerts() {
    return this.execute("listAlerts", () => ok(this.alerts));
  }

  acknowledgeAlert(id: string) {
    return this.execute("acknowledgeAlert", () => {
      const index = this.alerts.findIndex((candidate) => candidate.id === id);
      if (index < 0) return error("not_found", `Alert ${id} was not found.`);
      const updated = { ...this.alerts[index], acknowledged: true };
      this.alerts[index] = updated;
      return ok(updated);
    });
  }

  dismissAlert(id: string) {
    return this.execute("dismissAlert", () => {
      if (!this.alerts.some((candidate) => candidate.id === id)) {
        return error("not_found", `Alert ${id} was not found.`);
      }
      this.alerts = this.alerts.filter((alert) => alert.id !== id);
      return ok({ id });
    });
  }

  markAllAlertsRead() {
    return this.execute("markAllAlertsRead", () => {
      this.alerts = this.alerts.map((alert) => ({
        ...alert,
        acknowledged: true,
      }));
      return ok(this.alerts);
    });
  }

  clearReadAlerts() {
    return this.execute("clearReadAlerts", () => {
      this.alerts = this.alerts.filter((alert) => !alert.acknowledged);
      return ok(this.alerts);
    });
  }

  listHatchRecords() {
    return this.execute("listHatchRecords", () => ok(this.hatchRecords));
  }

  private createHarvestRecord(input: HarvestInput): Result<HatchRecord> {
    if (!Number.isInteger(input.cycleDays) || input.cycleDays < 1) {
      return error(
        "validation_error",
        "Cycle days must be a positive whole number.",
      );
    }
    const validationError = validateHarvestCounts(input);
    if (validationError) return error("validation_error", validationError);
    const end = this.now();
    const start = new Date(end);
    start.setDate(start.getDate() - Math.max(0, input.cycleDays - 1));
    return {
      ok: true,
      data: {
        id: this.nextId("h"),
        chamber: input.chamber,
        modeName: input.modeName,
        startDate: localDateString(start),
        endDate: localDateString(end),
        totalEggs: input.totalEggs,
        fertileEggs: input.fertileEggs,
        hatchedEggs: input.hatchedEggs,
      },
    };
  }

  completeCycle(input: CompleteCycleInput) {
    return this.execute("completeCycle", () => {
      const index = this.incubators.findIndex(
        (candidate) => candidate.id === input.incubatorId,
      );
      if (index < 0)
        return error(
          "not_found",
          `Incubator ${input.incubatorId} was not found.`,
        );
      const result = this.createHarvestRecord(input);
      if (!result.ok) return result;
      const incubator = {
        ...this.incubators[index],
        ...resetChamberToReady(this.incubators[index], this.now()),
      };
      this.hatchRecords.push(result.data);
      this.incubators[index] = incubator;
      return ok({ incubator, record: result.data });
    });
  }

  listAbortedCycles() {
    return this.execute("listAbortedCycles", () => ok(this.abortedCycles));
  }

  private createAbortedCycleRecord(
    input: AbortedCycleInput,
  ): Result<AbortedCycleRecord> {
    if (!Number.isInteger(input.dayStopped) || input.dayStopped < 0) {
      return error(
        "validation_error",
        "Stopped day must be a non-negative whole number.",
      );
    }
    if (!Number.isInteger(input.totalEggs) || input.totalEggs < 0) {
      return error(
        "validation_error",
        "Total eggs must be a non-negative whole number.",
      );
    }
    if (
      input.fertileEggs !== null &&
      (!Number.isInteger(input.fertileEggs) ||
        input.fertileEggs < 0 ||
        input.fertileEggs > input.totalEggs)
    ) {
      return error(
        "validation_error",
        "Fertile eggs must be between zero and total eggs.",
      );
    }
    return {
      ok: true,
      data: {
        id: this.nextId("aborted"),
        incubator: input.incubator,
        modeName: input.modeName,
        stoppedOn: this.now().toISOString(),
        dayStopped: input.dayStopped,
        totalEggs: input.totalEggs,
        fertileEggs: input.fertileEggs,
      },
    };
  }

  stopCycle(input: StopCycleInput) {
    return this.execute("stopCycle", () => {
      const index = this.incubators.findIndex(
        (candidate) => candidate.id === input.incubatorId,
      );
      if (index < 0)
        return error(
          "not_found",
          `Incubator ${input.incubatorId} was not found.`,
        );
      const result = this.createAbortedCycleRecord(input);
      if (!result.ok) return result;
      const incubator: Incubator = {
        ...this.incubators[index],
        cyclePhase: "stopped_early",
        status: "warning",
      };
      this.abortedCycles.push(result.data);
      this.incubators[index] = incubator;
      return ok({ incubator, record: result.data });
    });
  }

  listSettings() {
    return this.execute("listSettings", () => ok(this.settings));
  }

  saveSettings(settings: SettingsPreferences) {
    return this.execute("saveSettings", () => {
      if (
        !settings.account.farmName.trim() ||
        !settings.account.accountHolder.trim()
      ) {
        return error(
          "validation_error",
          "Farm name and account holder are required.",
        );
      }
      this.settings = clone(settings);
      return ok(this.settings);
    });
  }
}
