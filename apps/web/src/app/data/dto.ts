import { z } from "zod";

export type ResultError = { code: string; message: string; details?: unknown };
export type Result<T> = { ok: true; data: T } | { ok: false; error: ResultError };
export function resultMessage(r: Extract<Result<unknown>, { ok: false }>): string {
  return r.error.message;
}
export function toResult<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, data: fn() };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: { code: "validation_error", message: e.issues[0]?.message ?? "Validation failed", details: e.issues } };
    }
    return { ok: false, error: { code: "unknown", message: e instanceof Error ? e.message : String(e) } };
  }
}

export const RangeSchema = z.object({ min: z.number(), max: z.number() }).refine((r) => r.min < r.max, { message: "min must be < max" });

export const ModeDTOSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).trim(),
  builtIn: z.boolean().optional().default(false),
  targetTemp: RangeSchema,
  targetHumidity: RangeSchema,
  incubationDays: z.number().int().min(17).max(36),
  defaultTurnInterval: z.number().int().min(30).max(360),
  version: z.number().int().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  temp_hysteresis_c: z.number().min(0.1).max(1).default(0.2),
  humidity_hysteresis_pct: z.number().min(1).max(10).default(3),
});

export type ModeDTO = z.infer<typeof ModeDTOSchema>;

export function parseModeDTO(input: unknown): Result<ModeDTO> {
  return toResult(() => ModeDTOSchema.parse(input));
}
