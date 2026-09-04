import { describe, expect, it } from "vitest";
import { createModeFixtures } from "../app/data/fixtures/modes";
import {
  CompleteCycleRequestSchema,
  CreateIncubatorRequestSchema,
  ErrorEnvelopeSchema,
  IncubatorDTOSchema,
  modeFromDTO,
  modeToTransportDTO,
  ReadingDTOSchema,
  resultEnvelopeSchema,
  StartCycleRequestSchema,
  UpdateIncubatorRequestSchema,
} from "../app/data/transport/contracts";

describe("dashboard transport contracts", () => {
  it("round-trips every mode fixture with explicit wire units", () => {
    for (const mode of createModeFixtures()) {
      const dto = modeToTransportDTO(mode);
      expect(dto.default_turn_interval_min).toBe(mode.defaultTurnInterval * 60);
      expect(modeFromDTO(dto)).toEqual(mode);
    }
  });

  it("rejects derived incubator fields in update requests", () => {
    expect(
      UpdateIncubatorRequestSchema.safeParse({
        name: "Renamed chamber",
        status: "optimal",
      }).success,
    ).toBe(false);
    expect(
      UpdateIncubatorRequestSchema.parse({
        mode_id: "broiler",
        auto_turn: true,
        turn_interval_min: 240,
      }),
    ).toEqual({
      mode_id: "broiler",
      auto_turn: true,
      turn_interval_min: 240,
    });
  });

  it("keeps create and cycle commands minimal and server-owned", () => {
    expect(
      CreateIncubatorRequestSchema.parse({
        name: "Chamber Thirteen",
        device_id: "EGG-1015",
        mode_id: "broiler",
      }),
    ).not.toHaveProperty("id");
    expect(
      StartCycleRequestSchema.parse({ mode_id: "broiler", total_eggs: 38 }),
    ).toEqual({ mode_id: "broiler", total_eggs: 38 });
    expect(CompleteCycleRequestSchema.parse({ hatched_eggs: 30 })).toEqual({
      hatched_eggs: 30,
    });
  });

  it("validates explicit API reading and incubator fields", () => {
    expect(
      ReadingDTOSchema.parse({
        observed_at: "2026-09-04T12:00:00.000Z",
        received_at: "2026-09-04T12:00:01.000Z",
        temperature_c: 37.5,
        humidity_pct: 55,
        water_ok: true,
      }),
    ).toMatchObject({ water_ok: true, temperature_c: 37.5 });

    const parsed = IncubatorDTOSchema.safeParse({
      id: "chamber-1",
      name: "Chamber One",
      device_id: "EGG-1001",
      mode_id: "broiler",
      day_of_incubation: 9,
      total_eggs_loaded: 38,
      fertile_eggs: 34,
      temperature_c: 37.5,
      humidity_pct: 55,
      water_ok: true,
      temperature_trend_c: 0.1,
      humidity_trend_pct: 0.3,
      power_source: "grid",
      battery_pct: 100,
      status: "optimal",
      last_turned_at: "2026-09-04T08:00:00.000Z",
      next_turn_at: "2026-09-04T12:00:00.000Z",
      turn_interval_min: 240,
      auto_turn: true,
      paired: true,
      cycle_phase: "incubating",
      condition_severity: "info",
      connection_state: "connected",
      candled_days: [6],
      candling_entries: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("uses one success/error envelope", () => {
    const successSchema = resultEnvelopeSchema(ReadingDTOSchema.array());
    expect(successSchema.parse({ ok: true, data: [] })).toEqual({
      ok: true,
      data: [],
    });
    expect(
      ErrorEnvelopeSchema.parse({
        ok: false,
        error: { code: "not_found", message: "Missing" },
      }),
    ).toEqual({
      ok: false,
      error: { code: "not_found", message: "Missing" },
    });
  });
});
