import { z } from "zod";
import type { Result } from "../domain/result";

export type { Result, ResultError } from "../domain/result";
export { resultMessage } from "../domain/result";

export function toResult<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, data: fn() };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return {
        ok: false,
        error: {
          code: "validation_error",
          message: e.issues[0]?.message ?? "Validation failed",
          details: e.issues,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: "unknown",
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
}

export const RangeSchema = z
  .object({ min: z.number(), max: z.number() })
  .refine((r) => r.min < r.max, { message: "min must be < max" });

export const ModeDTOSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).trim(),
  built_in: z.boolean().optional().default(false),
  target_temp_c: RangeSchema,
  target_humidity_pct: RangeSchema,
  incubation_days: z.number().int().min(7).max(45),
  default_turn_interval_min: z.number().int().min(60).max(1440),
  version: z.number().int().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  temp_hysteresis_c: z.number().min(0.1).max(1).default(0.2),
  humidity_hysteresis_pct: z.number().min(1).max(10).default(3),
});

export type ModeDTO = z.infer<typeof ModeDTOSchema>;

export type DomainModeInput = {
  id: string;
  name: string;
  builtIn: boolean;
  targetTemp: { min: number; max: number };
  targetHumidity: { min: number; max: number };
  incubationDays: number;
  defaultTurnInterval: number;
};

export function modeToDTO(mode: DomainModeInput): ModeDTO {
  return ModeDTOSchema.parse({
    id: mode.id,
    name: mode.name,
    built_in: mode.builtIn,
    target_temp_c: mode.targetTemp,
    target_humidity_pct: mode.targetHumidity,
    incubation_days: mode.incubationDays,
    default_turn_interval_min: mode.defaultTurnInterval * 60,
  });
}

export function parseModeDTO(input: unknown): Result<ModeDTO> {
  return toResult(() => ModeDTOSchema.parse(input));
}
