import { describe, expect, it } from "vitest";
import {
  ModeDTOSchema,
  modeToDTO,
  type Result,
  resultMessage,
} from "../app/data/dto";
import { createModeFixtures } from "../app/data/fixtures/modes";

const initialModes = createModeFixtures();

const validBroiler = {
  id: "broiler",
  name: "Broiler",
  built_in: true,
  target_temp_c: { min: 37.5, max: 37.8 },
  target_humidity_pct: { min: 55, max: 65 },
  incubation_days: 21,
  default_turn_interval_min: 240,
  version: 1,
};

describe("ModeDTO", () => {
  it("rejects incubationDays outside 7-45", () => {
    for (const days of [5, 6, 46]) {
      expect(() =>
        ModeDTOSchema.parse({ ...validBroiler, incubation_days: days }),
      ).toThrow();
    }
    for (const days of [7, 21, 45]) {
      expect(
        ModeDTOSchema.parse({ ...validBroiler, incubation_days: days })
          .incubation_days,
      ).toBe(days);
    }
  });
  it("accepts valid Broiler 21", () => {
    expect(ModeDTOSchema.parse(validBroiler)).toBeDefined();
  });
  it("defaults hysteresis 0.2 and 3", () => {
    const parsed = ModeDTOSchema.parse(validBroiler);
    expect(parsed.temp_hysteresis_c).toBe(0.2);
    expect(parsed.humidity_hysteresis_pct).toBe(3);
  });
  it("converts domain hours to explicit wire minutes", () => {
    expect(modeToDTO(initialModes[0]).default_turn_interval_min).toBe(240);
  });
  it("parses every current mode fixture through the wire mapper", () => {
    for (const mode of initialModes) {
      expect(ModeDTOSchema.safeParse(modeToDTO(mode)).success).toBe(true);
    }
  });
  it("Result ok shape carries data", () => {
    const r: Result<typeof validBroiler> = { ok: true, data: validBroiler };
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe("broiler");
  });
  it("Result err structured has code/message + helper", () => {
    const r: Result<never> = {
      ok: false,
      error: {
        code: "validation_error",
        message: "incubationDays must be 7-45",
      },
    };
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("validation_error");
      expect(resultMessage(r)).toBe("incubationDays must be 7-45");
    }
  });
});
