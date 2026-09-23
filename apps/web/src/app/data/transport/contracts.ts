import { z } from "zod";
import { RESULT_ERROR_CODES } from "../../domain/result";
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
import { ModeDTOSchema, modeToDTO } from "../dto";
import type { SettingsPreferences } from "../settings";

const IdentifierSchema = z.string().trim().min(1);
const UtcTimestampSchema = z.string().datetime({ offset: true });
const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ApiErrorCodeSchema = z.enum(RESULT_ERROR_CODES);

export const ApiErrorSchema = z
  .object({
    code: ApiErrorCodeSchema,
    message: z.string().min(1),
    details: z.unknown().optional(),
  })
  .strict();

export const ErrorEnvelopeSchema = z
  .object({ ok: z.literal(false), error: ApiErrorSchema })
  .strict();

export function resultEnvelopeSchema<T extends z.ZodTypeAny>(data: T) {
  return z.union([
    z.object({ ok: z.literal(true), data }).strict(),
    ErrorEnvelopeSchema,
  ]);
}

export const CandlingEntryDTOSchema = z
  .object({
    id: IdentifierSchema,
    day: z.number().int().positive(),
    label: z.string().trim().min(1),
    observed_on: DateOnlySchema,
    fertile_eggs: z.number().int().nonnegative(),
    clear_eggs: z.number().int().nonnegative(),
    uncertain_eggs: z.number().int().nonnegative(),
    developing_eggs: z.number().int().nonnegative().optional(),
    stopped_developing_eggs: z.number().int().nonnegative().optional(),
    note: z.string(),
    photo_keys: z.array(z.string().min(1)),
    checks: z.array(z.enum(["veining", "air_cell", "movement"])),
    checkpoint_type: z.enum(["first", "later"]),
  })
  .strict();

export const IncubatorDTOSchema = z
  .object({
    id: IdentifierSchema,
    name: z.string().trim().min(1),
    device_id: IdentifierSchema,
    mode_id: IdentifierSchema,
    day_of_incubation: z.number().int().nonnegative(),
    total_eggs_loaded: z.number().int().nonnegative().nullable(),
    fertile_eggs: z.number().int().nonnegative().nullable(),
    temperature_c: z.number().finite(),
    humidity_pct: z.number().min(0).max(100),
    water_ok: z.boolean(),
    temperature_trend_c: z.number().finite(),
    humidity_trend_pct: z.number().finite(),
    power_source: z.enum(["grid", "battery"]),
    battery_pct: z.number().min(0).max(100),
    status: z.enum(["optimal", "warning", "alert"]),
    turn_command_status: z
      .enum(["pending", "dispatched", "acked", "rejected", "timed_out"])
      .nullable()
      .optional(),
    last_turned_at: UtcTimestampSchema,
    next_turn_at: UtcTimestampSchema,
    turn_interval_min: z.number().int().min(1),
    auto_turn: z.boolean(),
    paired: z.boolean(),
    cycle_phase: z.enum([
      "ready",
      "incubating",
      "lockdown",
      "hatching",
      "awaiting_finish",
      "completed",
      "stopped_early",
    ]),
    condition_severity: z.enum(["critical", "warning", "info"]),
    connection_state: z.enum([
      "offline",
      "connecting",
      "connected",
      "connection_failed",
    ]),
    telemetry_status: z.enum(["fresh", "stale", "offline"]).default("offline"),
    telemetry_observed_at: UtcTimestampSchema.nullable().optional(),
    telemetry_received_at: UtcTimestampSchema.nullable().optional(),
    telemetry_last_seen_at: UtcTimestampSchema.nullable().optional(),
    candled_days: z.array(z.number().int().positive()),
    candling_entries: z.array(CandlingEntryDTOSchema),
  })
  .strict();

export const ReadingDTOSchema = z
  .object({
    observed_at: UtcTimestampSchema,
    received_at: UtcTimestampSchema,
    temperature_c: z.number().finite(),
    humidity_pct: z.number().min(0).max(100),
    water_ok: z.boolean(),
  })
  .strict();

export const AlertDTOSchema = z
  .object({
    id: IdentifierSchema,
    incubator_id: IdentifierSchema.nullable(),
    unit_name: z.string().trim().min(1).nullable(),
    severity: z.enum(["critical", "warning", "info"]),
    code: IdentifierSchema,
    title: z.string().trim().min(1),
    message: z.string().min(1),
    occurred_at: UtcTimestampSchema,
    acknowledged_at: UtcTimestampSchema.nullable(),
  })
  .strict();

export const HatchHistoryDTOSchema = z
  .object({
    id: IdentifierSchema,
    cycle_id: IdentifierSchema,
    incubator_id: IdentifierSchema,
    chamber_name: z.string().trim().min(1),
    mode_id: IdentifierSchema,
    mode_name: z.string().trim().min(1),
    started_on: DateOnlySchema,
    ended_on: DateOnlySchema,
    total_eggs: z.number().int().nonnegative(),
    fertile_eggs: z.number().int().nonnegative().nullable(),
    hatched_eggs: z.number().int().nonnegative(),
  })
  .strict();

export const AbortedCycleDTOSchema = z
  .object({
    id: IdentifierSchema,
    cycle_id: IdentifierSchema,
    incubator_id: IdentifierSchema,
    chamber_name: z.string().trim().min(1),
    mode_id: IdentifierSchema,
    mode_name: z.string().trim().min(1),
    stopped_at: UtcTimestampSchema,
    day_stopped: z.number().int().nonnegative(),
    total_eggs: z.number().int().nonnegative(),
    fertile_eggs: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const PreferencesDTOSchema = z
  .object({
    farm_name: z.string().trim().min(1),
    account_holder: z.string().trim().min(1),
    display_name: z.string(),
    notifications: z
      .object({
        enabled: z.record(z.boolean()),
        sms: z.boolean(),
        email: z.boolean(),
        phone: z.string(),
        email_address: z.string(),
      })
      .strict(),
    temperature_unit: z.enum(["c", "f"]),
    time_zone: z.enum(["gmt8", "gmt0", "est", "pst"]),
  })
  .strict();

export const CreateIncubatorRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(30),
    device_id: IdentifierSchema,
    mode_id: IdentifierSchema,
  })
  .strict();

export const UpdateIncubatorProfileRequestSchema = z
  .object({ name: z.string().trim().min(1).max(30) })
  .strict();

export const UpdateIncubatorConfigurationRequestSchema = z
  .object({
    mode_id: IdentifierSchema.optional(),
    auto_turn: z.boolean().optional(),
    turn_interval_min: z.number().int().min(1).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one configuration field is required.",
  });

export const ResetStoppedCycleRequestSchema = z.object({}).strict();

export const ReconnectIncubatorRequestSchema = z.object({}).strict();

export const ManualTurnRequestSchema = z.object({}).strict();

export const CreateCandlingEntryRequestSchema = CandlingEntryDTOSchema.omit({
  id: true,
});

export const UpdateCandlingEntryRequestSchema = z
  .object({
    label: z.string().trim().min(1).optional(),
    observed_on: DateOnlySchema.optional(),
    fertile_eggs: z.number().int().nonnegative().optional(),
    clear_eggs: z.number().int().nonnegative().optional(),
    uncertain_eggs: z.number().int().nonnegative().optional(),
    developing_eggs: z.number().int().nonnegative().optional(),
    stopped_developing_eggs: z.number().int().nonnegative().optional(),
    note: z.string().optional(),
    photo_keys: z.array(z.string().min(1)).optional(),
    checks: z.array(z.enum(["veining", "air_cell", "movement"])).optional(),
    checkpoint_type: z.enum(["first", "later"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one candling field is required.",
  });

export const StartCycleRequestSchema = z
  .object({
    mode_id: IdentifierSchema,
    total_eggs: z.number().int().min(1).max(38),
  })
  .strict();

export const CompleteCycleRequestSchema = z
  .object({ hatched_eggs: z.number().int().nonnegative() })
  .strict();

export const StopCycleRequestSchema = z.object({}).strict();

export const ModeTransportDTOSchema = ModeDTOSchema;

export function modeToTransportDTO(mode: Mode) {
  return modeToDTO(mode);
}

export function modeFromDTO(input: unknown): Mode {
  const dto = ModeDTOSchema.parse(input);
  return {
    id: dto.id,
    name: dto.name,
    builtIn: dto.built_in,
    targetTemp: dto.target_temp_c,
    targetHumidity: dto.target_humidity_pct,
    incubationDays: dto.incubation_days,
    defaultTurnInterval: dto.default_turn_interval_min / 60,
  };
}
export function readingTimeLabel(observedAt: string): string {
  const date = new Date(observedAt);
  if (Number.isNaN(date.getTime())) return observedAt;
  const ageMs = Date.now() - date.getTime();
  if (ageMs >= 0 && ageMs < 24 * 3_600_000) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function readingFromDTO(input: unknown): Reading {
  const dto = ReadingDTOSchema.parse(input);
  return {
    ts: Date.parse(dto.observed_at),
    time: readingTimeLabel(dto.observed_at),
    temp: dto.temperature_c,
    humidity: dto.humidity_pct,
  };
}

function developmentCheckFromDTO(
  value: "veining" | "air_cell" | "movement",
): DevelopmentCheck {
  return value === "air_cell" ? "airCell" : value;
}

export function candlingEntryFromDTO(input: unknown): CandlingLogEntry {
  const dto = CandlingEntryDTOSchema.parse(input);
  return {
    id: dto.id,
    day: dto.day,
    label: dto.label,
    date: dto.observed_on,
    fertile: dto.fertile_eggs,
    clear: dto.clear_eggs,
    uncertain: dto.uncertain_eggs,
    developing: dto.developing_eggs,
    stoppedDeveloping: dto.stopped_developing_eggs,
    note: dto.note,
    photos: [...dto.photo_keys],
    checks: dto.checks.map(developmentCheckFromDTO),
    checkpointType: dto.checkpoint_type,
  };
}

export function incubatorFromDTO(input: unknown): Incubator {
  const dto = IncubatorDTOSchema.parse(input);
  return {
    id: dto.id,
    name: dto.name,
    deviceId: dto.device_id,
    modeId: dto.mode_id,
    dayOfIncubation: dto.day_of_incubation,
    totalEggsLoaded: dto.total_eggs_loaded ?? undefined,
    fertileEggs: dto.fertile_eggs ?? undefined,
    temp: dto.temperature_c,
    humidity: dto.humidity_pct,
    waterOk: dto.water_ok,
    tempTrend: dto.temperature_trend_c,
    humidityTrend: dto.humidity_trend_pct,
    powerSource: dto.power_source,
    batteryPct: dto.battery_pct,
    status: dto.status,
    turnCommandStatus: dto.turn_command_status ?? undefined,
    lastTurned: dto.last_turned_at,
    nextTurn: dto.next_turn_at,
    turnInterval: dto.turn_interval_min / 60,
    autoTurn: dto.auto_turn,
    paired: dto.paired,
    cyclePhase: dto.cycle_phase,
    conditionSeverity: dto.condition_severity,
    connectionState: dto.connection_state,
    telemetryStatus: dto.telemetry_status,
    telemetryObservedAt: dto.telemetry_observed_at ?? null,
    telemetryReceivedAt: dto.telemetry_received_at ?? null,
    telemetryLastSeenAt: dto.telemetry_last_seen_at ?? null,
    candled: Object.fromEntries(dto.candled_days.map((day) => [day, true])),
    candlingLog: dto.candling_entries.map((entry) =>
      candlingEntryFromDTO(entry),
    ),
  };
}

export function alertFromDTO(input: unknown): AlertEntry {
  const dto = AlertDTOSchema.parse(input);
  return {
    id: dto.id,
    severity: dto.severity,
    title: dto.title,
    unit: dto.unit_name ?? dto.incubator_id ?? "",
    message: dto.message,
    timestamp: dto.occurred_at,
    acknowledged: dto.acknowledged_at !== null,
  };
}

export function hatchHistoryFromDTO(input: unknown): HatchRecord {
  const dto = HatchHistoryDTOSchema.parse(input);
  return {
    id: dto.id,
    chamber: dto.chamber_name,
    modeName: dto.mode_name,
    startDate: dto.started_on,
    endDate: dto.ended_on,
    totalEggs: dto.total_eggs,
    fertileEggs: dto.fertile_eggs,
    hatchedEggs: dto.hatched_eggs,
  };
}

export function abortedCycleFromDTO(input: unknown): AbortedCycleRecord {
  const dto = AbortedCycleDTOSchema.parse(input);
  return {
    id: dto.id,
    incubator: dto.chamber_name,
    modeName: dto.mode_name,
    stoppedOn: dto.stopped_at,
    dayStopped: dto.day_stopped,
    totalEggs: dto.total_eggs,
    fertileEggs: dto.fertile_eggs,
  };
}

export function preferencesFromDTO(input: unknown): SettingsPreferences {
  const dto = PreferencesDTOSchema.parse(input);
  return {
    account: {
      farmName: dto.farm_name,
      accountHolder: dto.account_holder,
      displayName: dto.display_name,
    },
    notifications: {
      enabled: { ...dto.notifications.enabled },
      sms: dto.notifications.sms,
      email: dto.notifications.email,
      phone: dto.notifications.phone,
      emailAddress: dto.notifications.email_address,
    },
    temperatureUnit: dto.temperature_unit,
    timeZone: dto.time_zone,
  };
}

export function preferencesToDTO(input: SettingsPreferences): PreferencesDTO {
  return PreferencesDTOSchema.parse({
    farm_name: input.account.farmName,
    account_holder: input.account.accountHolder,
    display_name: input.account.displayName,
    notifications: {
      enabled: { ...input.notifications.enabled },
      sms: input.notifications.sms,
      email: input.notifications.email,
      phone: input.notifications.phone,
      email_address: input.notifications.emailAddress,
    },
    temperature_unit: input.temperatureUnit,
    time_zone: input.timeZone,
  });
}

export type IncubatorDTO = z.infer<typeof IncubatorDTOSchema>;
export type ReadingDTO = z.infer<typeof ReadingDTOSchema>;
export type AlertDTO = z.infer<typeof AlertDTOSchema>;
export type HatchHistoryDTO = z.infer<typeof HatchHistoryDTOSchema>;
export type AbortedCycleDTO = z.infer<typeof AbortedCycleDTOSchema>;
export type PreferencesDTO = z.infer<typeof PreferencesDTOSchema>;
