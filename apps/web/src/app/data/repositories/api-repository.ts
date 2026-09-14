import { z } from "zod";
import type { Result, ResultError } from "../../domain/result";
import type {
  AbortedCycleRecord,
  AlertEntry,
  CandlingLogEntry,
  DevelopmentCheck,
  HatchRecord,
  Incubator,
  Mode,
  Reading,
} from "../../domain/types";
import { ModeDTOSchema } from "../dto";
import type { SettingsPreferences } from "../settings";
import {
  AbortedCycleDTOSchema,
  AlertDTOSchema,
  abortedCycleFromDTO,
  alertFromDTO,
  CandlingEntryDTOSchema,
  HatchHistoryDTOSchema,
  hatchHistoryFromDTO,
  IncubatorDTOSchema,
  incubatorFromDTO,
  modeFromDTO,
  modeToTransportDTO,
  PreferencesDTOSchema,
  preferencesFromDTO,
  preferencesToDTO,
  ReadingDTOSchema,
  readingFromDTO,
  resultEnvelopeSchema,
} from "../transport/contracts";
import type {
  CompleteCycleInput,
  CompletedCycle,
  EggcelerateRepository,
  MutationOptions,
  ReadingQuery,
  StopCycleInput,
  StoppedCycle,
} from "./repository";

const REQUEST_TIMEOUT_MS = 10_000;
const KNOWN_CODES = [
  "validation_error",
  "not_found",
  "conflict",
  "rejected",
  "offline",
  "timeout",
  "unknown_error",
];

export interface ApiRepositoryOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  newIdempotencyKey?: () => string;
}

function failure(code: string, message: string): Result<never> {
  const known = KNOWN_CODES.includes(code) ? code : "unknown_error";
  const error: ResultError = { code: known, message };
  return { ok: false, error };
}

function toWireChecks(
  checks: DevelopmentCheck[],
): ("veining" | "air_cell" | "movement")[] {
  return checks.map((check) => (check === "airCell" ? "air_cell" : check));
}

export class ApiRepository implements EggcelerateRepository {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly newIdempotencyKey: () => string;

  constructor(options: ApiRepositoryOptions) {
    // Paths below already start with /api/v1, but documented examples hand
    // us a base URL that sometimes includes the suffix too. Normalize both
    // shapes to origin-only so neither double-prefixes.
    this.baseUrl = options.baseUrl
      .replace(/\/+$/, "")
      .replace(/\/api\/v1$/, "");
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.newIdempotencyKey =
      options.newIdempotencyKey ?? (() => crypto.randomUUID());
  }

  private async request<T>(
    path: string,
    schema: z.ZodTypeAny,
    init?: {
      method?: string;
      body?: unknown;
      idempotent?: boolean;
      idempotencyKey?: string;
    },
  ): Promise<Result<T>> {
    // Timeout via race, not AbortController signal: jsdom's AbortSignal is
    // not accepted by undici fetch, which throws TypeError on contact.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new DOMException("The request timed out.", "AbortError")),
        this.timeoutMs,
      );
    });
    let response: Response;
    try {
      response = (await Promise.race([
        this.fetchImpl(`${this.baseUrl}${path}`, {
          method: init?.method ?? "GET",
          headers: {
            "Content-Type": "application/json",
            ...(init?.idempotent === true
              ? {
                  "Idempotency-Key":
                    init.idempotencyKey ?? this.newIdempotencyKey(),
                }
              : {}),
          },
          body:
            init?.body === undefined ? undefined : JSON.stringify(init.body),
        }),
        timeout,
      ])) as Response;
    } catch (error) {
      const timedOut =
        typeof DOMException !== "undefined" &&
        error instanceof DOMException &&
        error.name === "AbortError";
      return failure(
        timedOut ? "timeout" : "offline",
        timedOut ? "The request timed out." : "The API is unreachable.",
      );
    } finally {
      clearTimeout(timer);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return failure(
        "unknown_error",
        "The API returned an unreadable response.",
      );
    }
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("ok" in payload) ||
      payload.ok !== false
    ) {
      const parsed = resultEnvelopeSchema(schema).safeParse(payload);
      if (!parsed.success || !parsed.data.ok) {
        // eslint-disable-next-line no-console
        console.error("API contract breach", path, parsed);
        return failure(
          "unknown_error",
          "The API returned an unexpected shape.",
        );
      }
      return { ok: true, data: parsed.data.data };
    }
    const error: unknown = "error" in payload ? payload.error : undefined;
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "unknown_error";
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.length > 0
        ? error.message
        : "The API request failed.";
    return failure(code, message);
  }

  private async getIncubatorDTO(id: string): Promise<Result<Incubator>> {
    const result = await this.request<unknown>(
      `/api/v1/incubators/${encodeURIComponent(id)}`,
      IncubatorDTOSchema,
    );
    if (!result.ok) return result;
    return { ok: true, data: incubatorFromDTO(result.data) };
  }

  async listIncubators(): Promise<Result<Incubator[]>> {
    const result = await this.request<unknown[]>(
      "/api/v1/incubators",
      z.array(IncubatorDTOSchema),
    );
    if (!result.ok) return result;
    return {
      ok: true,
      data: result.data.map((item) => incubatorFromDTO(item)),
    };
  }

  async getIncubator(id: string): Promise<Result<Incubator>> {
    return this.getIncubatorDTO(id);
  }

  async addIncubator(
    unit: Incubator,
    options?: MutationOptions,
  ): Promise<Result<Incubator>> {
    const result = await this.request<unknown>(
      "/api/v1/incubators",
      IncubatorDTOSchema,
      {
        method: "POST",
        body: {
          name: unit.name,
          device_id: unit.deviceId,
          mode_id: unit.modeId,
        },
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: incubatorFromDTO(result.data) };
  }

  async updateIncubatorProfile(
    id: string,
    input: { name: string },
    options?: MutationOptions,
  ): Promise<Result<Incubator>> {
    const result = await this.request<unknown>(
      `/api/v1/incubators/${encodeURIComponent(id)}`,
      IncubatorDTOSchema,
      {
        method: "PATCH",
        body: { name: input.name },
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: incubatorFromDTO(result.data) };
  }

  async updateIncubatorConfiguration(
    id: string,
    input: { modeId?: string; autoTurn?: boolean; turnIntervalHours?: number },
    options?: MutationOptions,
  ): Promise<Result<Incubator>> {
    const result = await this.request<unknown>(
      `/api/v1/incubators/${encodeURIComponent(id)}`,
      IncubatorDTOSchema,
      {
        method: "PATCH",
        body: {
          ...(input.modeId === undefined ? {} : { mode_id: input.modeId }),
          ...(input.autoTurn === undefined
            ? {}
            : { auto_turn: input.autoTurn }),
          ...(input.turnIntervalHours === undefined
            ? {}
            : { turn_interval_min: Math.round(input.turnIntervalHours * 60) }),
        },
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: incubatorFromDTO(result.data) };
  }

  async startCycle(
    id: string,
    input: { modeId: string; totalEggs: number },
    options?: MutationOptions,
  ): Promise<Result<Incubator>> {
    const result = await this.request<unknown>(
      `/api/v1/incubators/${encodeURIComponent(id)}/cycles`,
      IncubatorDTOSchema,
      {
        method: "POST",
        body: { mode_id: input.modeId, total_eggs: input.totalEggs },
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: incubatorFromDTO(result.data) };
  }

  async resetStoppedCycle(
    id: string,
    options?: MutationOptions,
  ): Promise<Result<Incubator>> {
    const result = await this.request<unknown>(
      `/api/v1/incubators/${encodeURIComponent(id)}/cycles/current/reset`,
      IncubatorDTOSchema,
      {
        method: "POST",
        body: {},
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: incubatorFromDTO(result.data) };
  }

  async requestManualTurn(id: string): Promise<Result<Incubator>> {
    const turned = await this.request<unknown>(
      `/api/v1/incubators/${encodeURIComponent(id)}/commands/turn`,
      z.object({ command_id: z.string(), status: z.string() }),
      { method: "POST", body: {}, idempotent: true },
    );
    if (!turned.ok) return turned;
    return this.getIncubatorDTO(id);
  }

  async reconnectIncubator(
    id: string,
    options?: MutationOptions,
  ): Promise<Result<Incubator>> {
    const result = await this.request<unknown>(
      `/api/v1/incubators/${encodeURIComponent(id)}/reconnect`,
      IncubatorDTOSchema,
      {
        method: "POST",
        body: {},
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: incubatorFromDTO(result.data) };
  }

  private readonly candlingTargets = new Map<string, string>();

  private async resolveEntryId(
    id: string,
    day: number,
    operationKey?: string,
  ): Promise<Result<string>> {
    const cached = operationKey
      ? this.candlingTargets.get(operationKey)
      : undefined;
    if (cached) return { ok: true, data: cached };
    const listed = await this.request<unknown[]>(
      `/api/v1/incubators/${encodeURIComponent(id)}/cycles/current/candling-entries`,
      z.array(CandlingEntryDTOSchema),
    );
    if (!listed.ok) return listed;
    const match = listed.data.find(
      (entry) => (entry as { day?: unknown }).day === day,
    ) as { id?: unknown } | undefined;
    if (!match || typeof match.id !== "string") {
      return failure(
        "not_found",
        `Candling entry for day ${day} was not found.`,
      );
    }
    if (operationKey) this.candlingTargets.set(operationKey, match.id);
    return { ok: true, data: match.id };
  }

  async createCandlingEntry(
    id: string,
    input: {
      day: number;
      label: string;
      date: string;
      fertile: number;
      clear: number;
      uncertain: number;
      note: string;
      photos: string[];
      checks: DevelopmentCheck[];
      checkpointType?: "first" | "later";
      developing?: number;
      stoppedDeveloping?: number;
    },
    options: MutationOptions = { idempotencyKey: this.newIdempotencyKey() },
  ): Promise<Result<Incubator>> {
    const created = await this.request<unknown>(
      `/api/v1/incubators/${encodeURIComponent(id)}/cycles/current/candling-entries`,
      CandlingEntryDTOSchema,
      {
        method: "POST",
        body: {
          day: input.day,
          label: input.label,
          observed_on: input.date,
          fertile_eggs: input.fertile,
          clear_eggs: input.clear,
          uncertain_eggs: input.uncertain,
          ...(input.developing === undefined
            ? {}
            : { developing_eggs: input.developing }),
          ...(input.stoppedDeveloping === undefined
            ? {}
            : { stopped_developing_eggs: input.stoppedDeveloping }),
          note: input.note,
          photo_keys: input.photos,
          checks: toWireChecks(input.checks),
          checkpoint_type: input.checkpointType ?? "later",
        },
        idempotent: true,
        idempotencyKey: options.idempotencyKey,
      },
    );
    if (!created.ok) return created;
    return this.getIncubatorDTO(id);
  }

  async updateCandlingEntry(
    id: string,
    day: number,
    input: Partial<
      Omit<
        CandlingLogEntry,
        | "id"
        | "day"
        | "checks"
        | "checkpointType"
        | "developing"
        | "stoppedDeveloping"
      > & {
        checks?: DevelopmentCheck[];
        checkpointType?: "first" | "later";
        developing?: number;
        stoppedDeveloping?: number;
      }
    >,
    options: MutationOptions = { idempotencyKey: this.newIdempotencyKey() },
  ): Promise<Result<Incubator>> {
    const resolved = await this.resolveEntryId(
      id,
      day,
      `${id}:${day}:updateCandlingEntry:${options.idempotencyKey}`,
    );
    if (!resolved.ok) return resolved;
    const updated = await this.request<unknown>(
      `/api/v1/incubators/${encodeURIComponent(id)}/cycles/current/candling-entries/${encodeURIComponent(resolved.data)}`,
      CandlingEntryDTOSchema,
      {
        method: "PATCH",
        body: {
          ...(input.label === undefined ? {} : { label: input.label }),
          ...(input.date === undefined ? {} : { observed_on: input.date }),
          ...(input.fertile === undefined
            ? {}
            : { fertile_eggs: input.fertile }),
          ...(input.clear === undefined ? {} : { clear_eggs: input.clear }),
          ...(input.uncertain === undefined
            ? {}
            : { uncertain_eggs: input.uncertain }),
          ...(input.developing === undefined
            ? {}
            : { developing_eggs: input.developing }),
          ...(input.stoppedDeveloping === undefined
            ? {}
            : { stopped_developing_eggs: input.stoppedDeveloping }),
          ...(input.note === undefined ? {} : { note: input.note }),
          ...(input.photos === undefined ? {} : { photo_keys: input.photos }),
          ...(input.checks === undefined
            ? {}
            : { checks: toWireChecks(input.checks) }),
          ...(input.checkpointType === undefined
            ? {}
            : { checkpoint_type: input.checkpointType }),
        },
        idempotent: true,
        idempotencyKey: options.idempotencyKey,
      },
    );
    if (!updated.ok) return updated;
    return this.getIncubatorDTO(id);
  }

  async deleteCandlingEntry(
    id: string,
    day: number,
    options: MutationOptions = { idempotencyKey: this.newIdempotencyKey() },
  ): Promise<Result<Incubator>> {
    const resolved = await this.resolveEntryId(
      id,
      day,
      `${id}:${day}:deleteCandlingEntry:${options.idempotencyKey}`,
    );
    if (!resolved.ok) return resolved;
    const deleted = await this.request<unknown>(
      `/api/v1/incubators/${encodeURIComponent(id)}/cycles/current/candling-entries/${encodeURIComponent(resolved.data)}`,
      z.object({ id: z.string() }),
      {
        method: "DELETE",
        idempotent: true,
        idempotencyKey: options.idempotencyKey,
      },
    );
    if (!deleted.ok) return deleted;
    return this.getIncubatorDTO(id);
  }

  async listReadings(query: ReadingQuery): Promise<Result<Reading[]>> {
    const result = await this.request<unknown[]>(
      `/api/v1/incubators/${encodeURIComponent(query.incubatorId)}/readings?window=${query.window}`,
      z.array(ReadingDTOSchema),
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data.map((item) => readingFromDTO(item)) };
  }

  async listModes(): Promise<Result<Mode[]>> {
    const result = await this.request<unknown[]>(
      "/api/v1/modes",
      z.array(ModeDTOSchema),
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data.map((item) => modeFromDTO(item)) };
  }

  async addMode(mode: Mode): Promise<Result<Mode>> {
    const result = await this.request<unknown>("/api/v1/modes", ModeDTOSchema, {
      method: "POST",
      body: modeToTransportDTO(mode),
      idempotent: true,
    });
    if (!result.ok) return result;
    return { ok: true, data: modeFromDTO(result.data) };
  }

  async updateMode(id: string, patch: Partial<Mode>): Promise<Result<Mode>> {
    const result = await this.request<unknown>(
      `/api/v1/modes/${encodeURIComponent(id)}`,
      ModeDTOSchema,
      {
        method: "PATCH",
        body: {
          ...(patch.name === undefined ? {} : { name: patch.name }),
          ...(patch.targetTemp === undefined
            ? {}
            : { target_temp_c: patch.targetTemp }),
          ...(patch.targetHumidity === undefined
            ? {}
            : { target_humidity_pct: patch.targetHumidity }),
          ...(patch.incubationDays === undefined
            ? {}
            : { incubation_days: patch.incubationDays }),
          ...(patch.defaultTurnInterval === undefined
            ? {}
            : {
                default_turn_interval_min: Math.round(
                  patch.defaultTurnInterval * 60,
                ),
              }),
        },
        idempotent: true,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: modeFromDTO(result.data) };
  }

  async deleteMode(id: string): Promise<Result<{ id: string }>> {
    const result = await this.request<{ id: string }>(
      `/api/v1/modes/${encodeURIComponent(id)}`,
      z.object({ id: z.string() }),
      { method: "DELETE" },
    );
    return result;
  }

  async listAlerts(): Promise<Result<AlertEntry[]>> {
    const result = await this.request<unknown[]>(
      "/api/v1/alerts",
      z.array(AlertDTOSchema),
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data.map((item) => alertFromDTO(item)) };
  }

  async acknowledgeAlert(
    id: string,
    options?: MutationOptions,
  ): Promise<Result<AlertEntry>> {
    const result = await this.request<unknown>(
      `/api/v1/alerts/${encodeURIComponent(id)}/acknowledge`,
      AlertDTOSchema,
      {
        method: "POST",
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: alertFromDTO(result.data) };
  }

  async dismissAlert(
    id: string,
    options?: MutationOptions,
  ): Promise<Result<{ id: string }>> {
    return this.request<{ id: string }>(
      `/api/v1/alerts/${encodeURIComponent(id)}`,
      z.object({ id: z.string() }),
      {
        method: "DELETE",
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
  }

  async markAllAlertsRead(
    options?: MutationOptions,
  ): Promise<Result<AlertEntry[]>> {
    const result = await this.request<unknown[]>(
      "/api/v1/alerts/actions/acknowledge-all",
      z.array(AlertDTOSchema),
      {
        method: "POST",
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data.map((item) => alertFromDTO(item)) };
  }

  async clearReadAlerts(
    options?: MutationOptions,
  ): Promise<Result<AlertEntry[]>> {
    const result = await this.request<unknown[]>(
      "/api/v1/alerts/actions/clear-acknowledged",
      z.array(AlertDTOSchema),
      {
        method: "POST",
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data.map((item) => alertFromDTO(item)) };
  }

  async listHatchRecords(): Promise<Result<HatchRecord[]>> {
    const result = await this.request<unknown[]>(
      "/api/v1/cycles?status=completed",
      z.array(HatchHistoryDTOSchema),
    );
    if (!result.ok) return result;
    return {
      ok: true,
      data: result.data.map((item) => hatchHistoryFromDTO(item)),
    };
  }

  async completeCycle(
    input: CompleteCycleInput,
    options?: MutationOptions,
  ): Promise<Result<CompletedCycle>> {
    const recorded = await this.request<unknown>(
      `/api/v1/incubators/${encodeURIComponent(input.incubatorId)}/cycles/current/complete`,
      HatchHistoryDTOSchema,
      {
        method: "POST",
        body: { hatched_eggs: input.hatchedEggs },
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!recorded.ok) return recorded;
    const unit = await this.getIncubatorDTO(input.incubatorId);
    if (!unit.ok) return unit;
    return {
      ok: true,
      data: {
        incubator: unit.data,
        record: hatchHistoryFromDTO(recorded.data),
      },
    };
  }

  async listAbortedCycles(): Promise<Result<AbortedCycleRecord[]>> {
    const result = await this.request<unknown[]>(
      "/api/v1/cycles?status=stopped_early",
      z.array(AbortedCycleDTOSchema),
    );
    if (!result.ok) return result;
    return {
      ok: true,
      data: result.data.map((item) => abortedCycleFromDTO(item)),
    };
  }

  async stopCycle(
    input: StopCycleInput,
    options?: MutationOptions,
  ): Promise<Result<StoppedCycle>> {
    const recorded = await this.request<unknown>(
      `/api/v1/incubators/${encodeURIComponent(input.incubatorId)}/cycles/current/stop`,
      AbortedCycleDTOSchema,
      {
        method: "POST",
        body: {},
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!recorded.ok) return recorded;
    const unit = await this.getIncubatorDTO(input.incubatorId);
    if (!unit.ok) return unit;
    return {
      ok: true,
      data: {
        incubator: unit.data,
        record: abortedCycleFromDTO(recorded.data),
      },
    };
  }

  async listSettings(): Promise<Result<SettingsPreferences>> {
    const result = await this.request<unknown>(
      "/api/v1/preferences",
      PreferencesDTOSchema,
    );
    if (!result.ok) return result;
    return { ok: true, data: preferencesFromDTO(result.data) };
  }

  async saveSettings(
    settings: SettingsPreferences,
    options?: MutationOptions,
  ): Promise<Result<SettingsPreferences>> {
    const result = await this.request<unknown>(
      "/api/v1/preferences",
      PreferencesDTOSchema,
      {
        method: "PUT",
        body: preferencesToDTO(settings),
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: preferencesFromDTO(result.data) };
  }
}
