import { z } from "zod";
import type { Mode } from "../../domain/types";
import { ModeDTOSchema, modeToDTO } from "../dto";

const IdentifierSchema = z.string().trim().min(1);
const UtcTimestampSchema = z.string().datetime({ offset: true });
const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ApiErrorCodeSchema = z.enum([
  "validation_error",
  "not_found",
  "conflict",
  "rejected",
  "offline",
  "timeout",
  "unknown_error",
]);

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

export const UpdateIncubatorRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(30).optional(),
    mode_id: IdentifierSchema.optional(),
    auto_turn: z.boolean().optional(),
    turn_interval_min: z.number().int().min(1).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one mutable incubator field is required.",
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

export type IncubatorDTO = z.infer<typeof IncubatorDTOSchema>;
export type ReadingDTO = z.infer<typeof ReadingDTOSchema>;
export type AlertDTO = z.infer<typeof AlertDTOSchema>;
export type HatchHistoryDTO = z.infer<typeof HatchHistoryDTOSchema>;
export type AbortedCycleDTO = z.infer<typeof AbortedCycleDTOSchema>;
export type PreferencesDTO = z.infer<typeof PreferencesDTOSchema>;
