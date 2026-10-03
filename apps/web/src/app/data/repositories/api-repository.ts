import { z } from "zod";
import type { Result, ResultError, ResultErrorCode } from "../../domain/result";
import type {
  AbortedCycleRecord,
  AlertEntry,
  CandlingLogEntry,
  DevelopmentCheck,
  HatchRecord,
  Incubator,
  Mode,
  Reading,
  TurnCommand,
} from "../../domain/types";
import { ModeDTOSchema } from "../dto";
import type { SettingsPreferences } from "../settings";
import {
  AbortedCycleDTOSchema,
  AlertDTOSchema,
  abortedCycleFromDTO,
  alertFromDTO,
  CandlingEntryDTOSchema,
  ChartReadingDTOSchema,
  chartReadingFromDTO,
  ErrorEnvelopeSchema,
  HatchHistoryDTOSchema,
  hatchHistoryFromDTO,
  IncubatorDTOSchema,
  incubatorFromDTO,
  modeFromDTO,
  modeToTransportDTO,
  PreferencesDTOSchema,
  preferencesFromDTO,
  preferencesToDTO,
  RawReadingPreviewDTOSchema,
  ReadingDTOSchema,
  readingFromDTO,
  resultEnvelopeSchema,
} from "../transport/contracts";
import { createIdempotencyKey } from "../transport/idempotency";
import { getCsrfToken, notifySessionExpired } from "../transport/session";
import type {
  CompleteCycleInput,
  EggcelerateRepository,
  MutationOptions,
  RawReadingPreview,
  RawReadingScope,
  ReadingQuery,
  StopCycleInput,
} from "./repository";

const REQUEST_TIMEOUT_MS = 10_000;
const TurnCommandStatusSchema = z.enum([
  "pending",
  "dispatched",
  "acked",
  "rejected",
  "timed_out",
]);
const TurnCommandDTOSchema = z.object({
  command_id: z.string().min(1),
  status: TurnCommandStatusSchema,
  requested_at: z.string().datetime({ offset: true }),
  executed_at: z.string().datetime({ offset: true }).nullable(),
  error_code: z.string().nullable(),
});
export interface ApiRepositoryOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  newIdempotencyKey?: () => string;
}

function failure(code: ResultErrorCode, message: string): Result<never> {
  const error: ResultError = { code, message };
  return { ok: false, error };
}

function toWireChecks(
  checks: DevelopmentCheck[],
): ("veining" | "air_cell" | "movement")[] {
  return checks.map((check) => (check === "airCell" ? "air_cell" : check));
}

export function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized === "/api" || normalized === "/api/v1") return "";
  try {
    const parsed = new URL(normalized);
    if (parsed.pathname === "/api" || parsed.pathname === "/api/v1") {
      return parsed.origin;
    }
  } catch {
    // The environment resolver validates API URLs. Keep this fallback safe
    // for a relative test base or a caller-provided custom path.
  }
  return normalized;
}

export class ApiRepository implements EggcelerateRepository {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly newIdempotencyKey: () => string;

  constructor(options: ApiRepositoryOptions) {
    // Paths below already start with /api/v1. Accept an origin, an origin
    // with /api or /api/v1, or the same-origin /api path used by Nginx. Strip
    // the optional API prefix so none of those forms double-prefix requests.
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.newIdempotencyKey = options.newIdempotencyKey ?? createIdempotencyKey;
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
      const method = init?.method ?? "GET";
      const csrfToken = getCsrfToken();
      response = (await Promise.race([
        this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(method === "GET" || !csrfToken
              ? {}
              : { "X-CSRF-Token": csrfToken }),
            ...(init?.idempotent === true
              ? {
                  "Idempotency-Key":
                    init.idempotencyKey ?? this.newIdempotencyKey(),
                }
              : {}),
          },
          body:
            init?.body === undefined ? undefined : JSON.stringify(init.body),
          credentials: "include",
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
    if (response.status === 401) notifySessionExpired();
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
      typeof payload === "object" &&
      payload !== null &&
      "ok" in payload &&
      payload.ok === false
    ) {
      const parsedError = ErrorEnvelopeSchema.safeParse(payload);
      if (!parsedError.success) {
        console.error("API error contract breach", path, parsedError.error);
        return failure(
          "unknown_error",
          "The API returned an unexpected error shape.",
        );
      }
      return { ok: false, error: parsedError.data.error };
    }

    const parsed = resultEnvelopeSchema(schema).safeParse(payload);
    if (!parsed.success || !parsed.data.ok) {
      console.error("API contract breach", path, parsed);
      return failure("unknown_error", "The API returned an unexpected shape.");
    }
    return { ok: true, data: parsed.data.data };
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

  async requestManualTurn(
    id: string,
    options?: MutationOptions,
  ): Promise<Result<TurnCommand>> {
    const turned = await this.request<{
      command_id: string;
      status: "accepted";
    }>(
      `/api/v1/incubators/${encodeURIComponent(id)}/commands/turn`,
      z.object({
        command_id: z.string().min(1),
        status: z.literal("accepted"),
      }),
      {
        method: "POST",
        body: {},
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!turned.ok) return turned;
    return {
      ok: true,
      data: { id: turned.data.command_id, status: "pending" },
    };
  }

  async getTurnCommand(
    incubatorId: string,
    commandId: string,
  ): Promise<Result<TurnCommand>> {
    const result = await this.request<z.infer<typeof TurnCommandDTOSchema>>(
      `/api/v1/incubators/${encodeURIComponent(incubatorId)}/commands/${encodeURIComponent(commandId)}`,
      TurnCommandDTOSchema,
    );
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        id: result.data.command_id,
        status: result.data.status,
        requestedAt: result.data.requested_at,
        executedAt: result.data.executed_at,
        errorCode: result.data.error_code,
      },
    };
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

  private clearCandlingTarget(incubatorId: string, day: number): void {
    const prefix = `${incubatorId}:${day}:`;
    for (const key of this.candlingTargets.keys()) {
      if (key.startsWith(prefix)) this.candlingTargets.delete(key);
    }
  }

  private async resolveEntryId(
    id: string,
    day: number,
    operationKey?: string,
  ): Promise<Result<string>> {
    const targetKey = operationKey ? `${id}:${day}:${operationKey}` : undefined;
    const cached = targetKey ? this.candlingTargets.get(targetKey) : undefined;
    const listed = await this.request<unknown[]>(
      `/api/v1/incubators/${encodeURIComponent(id)}/cycles/current/candling-entries`,
      z.array(CandlingEntryDTOSchema),
    );
    if (!listed.ok) return listed;
    const match = listed.data.find(
      (entry) => (entry as { day?: unknown }).day === day,
    ) as { id?: unknown } | undefined;
    if (!match || typeof match.id !== "string") {
      // This key is scoped to a single idempotent mutation attempt. If a
      // delete committed but its response was lost, the live list proves the
      // target is gone while the cached ID lets the same request replay.
      if (cached) return { ok: true, data: cached };
      if (targetKey) this.candlingTargets.delete(targetKey);
      return failure(
        "not_found",
        `Candling entry for day ${day} was not found.`,
      );
    }
    // A retry may use a cached ID, but the live list remains authoritative in
    // case the entry was removed or recreated for this incubator and day.
    const resolvedId = cached === match.id ? cached : match.id;
    if (targetKey) this.candlingTargets.set(targetKey, resolvedId);
    return { ok: true, data: resolvedId };
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
    const latest = await this.getIncubatorDTO(id);
    if (latest.ok) this.clearCandlingTarget(id, input.day);
    return latest;
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
    const latest = await this.getIncubatorDTO(id);
    if (latest.ok) this.clearCandlingTarget(id, day);
    return latest;
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
    const latest = await this.getIncubatorDTO(id);
    if (latest.ok) this.clearCandlingTarget(id, day);
    return latest;
  }

  async listReadings(query: ReadingQuery): Promise<Result<Reading[]>> {
    const result = await this.request<unknown[]>(
      `/api/v1/incubators/${encodeURIComponent(query.incubatorId)}/readings${query.resolution === "chart" ? "/chart" : ""}?window=${query.window}`,
      query.resolution === "chart"
        ? z.array(ChartReadingDTOSchema).max(600)
        : z.array(ReadingDTOSchema),
    );
    if (!result.ok) return result;
    return {
      ok: true,
      data: result.data.map((item) =>
        query.resolution === "chart"
          ? chartReadingFromDTO(item)
          : readingFromDTO(item),
      ),
    };
  }

  async previewRawReadings(
    query: RawReadingScope,
  ): Promise<Result<RawReadingPreview>> {
    const params = new URLSearchParams({
      window: query.window,
      end: query.end,
    });
    for (const id of query.incubatorIds) params.append("ids", id);
    const result = await this.request<
      z.infer<typeof RawReadingPreviewDTOSchema>
    >(
      `/api/v1/incubators/readings/raw-preview?${params}`,
      RawReadingPreviewDTOSchema,
    );
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        rows: result.data.rows.map((p) => ({
          incubatorId: p.incubator_id,
          chamber: p.chamber,
          reading: readingFromDTO({
            observed_at: p.observed_at,
            received_at: p.received_at,
            temperature_c: p.temperature_c,
            humidity_pct: p.humidity_pct,
            water_ok: p.water_ok,
          }),
          receivedAt: p.received_at,
          waterOk: p.water_ok,
        })),
        total: result.data.total,
        end: result.data.end,
        scopeToken: result.data.scope_token,
      },
    };
  }

  async exportRawReadings(scopeToken: string): Promise<Result<Blob>> {
    // Match the JSON adapter's cross-runtime timeout strategy; Node fetch rejects
    // jsdom AbortSignals. Bound the complete transfer, not just response headers.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new Error("Export timeout"));
      }, 120_000);
    });
    const download = async (): Promise<Result<Blob>> => {
      const csrf = getCsrfToken();
      const response = await this.fetchImpl(
        `${this.baseUrl}/api/v1/incubators/readings/export`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(csrf ? { "X-CSRF-Token": csrf } : {}),
          },
          body: JSON.stringify({ scope_token: scopeToken }),
        },
      );
      if (response.status === 401) notifySessionExpired();
      if (!response.ok) {
        const error = ErrorEnvelopeSchema.safeParse(await response.json());
        return error.success
          ? { ok: false, error: error.data.error }
          : failure("unknown_error", "Raw export failed.");
      }
      if (!response.headers.get("Content-Type")?.startsWith("text/csv"))
        return failure("unknown_error", "The API returned an invalid export.");
      return { ok: true, data: await response.blob() };
    };
    try {
      return await Promise.race([download(), timeout]);
    } catch {
      return failure(
        timedOut ? "timeout" : "offline",
        "Could not complete the raw export. Try again.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async listModes(): Promise<Result<Mode[]>> {
    const result = await this.request<unknown[]>(
      "/api/v1/modes",
      z.array(ModeDTOSchema),
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data.map((item) => modeFromDTO(item)) };
  }

  async addMode(mode: Mode, options?: MutationOptions): Promise<Result<Mode>> {
    const result = await this.request<unknown>("/api/v1/modes", ModeDTOSchema, {
      method: "POST",
      body: modeToTransportDTO(mode),
      idempotent: true,
      idempotencyKey: options?.idempotencyKey,
    });
    if (!result.ok) return result;
    return { ok: true, data: modeFromDTO(result.data) };
  }

  async updateMode(
    id: string,
    patch: Partial<Mode>,
    options?: MutationOptions,
  ): Promise<Result<Mode>> {
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
        idempotencyKey: options?.idempotencyKey,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: modeFromDTO(result.data) };
  }

  async deleteMode(
    id: string,
    options?: MutationOptions,
  ): Promise<Result<{ id: string }>> {
    const result = await this.request<{ id: string }>(
      `/api/v1/modes/${encodeURIComponent(id)}`,
      z.object({ id: z.string() }),
      {
        method: "DELETE",
        idempotent: true,
        idempotencyKey: options?.idempotencyKey,
      },
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
  ): Promise<Result<HatchRecord>> {
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
    return { ok: true, data: hatchHistoryFromDTO(recorded.data) };
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
  ): Promise<Result<AbortedCycleRecord>> {
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
    return { ok: true, data: abortedCycleFromDTO(recorded.data) };
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
