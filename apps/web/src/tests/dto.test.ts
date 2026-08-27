import { describe, it, expect } from "vitest";
import { ModeDTOSchema, type Result, resultMessage } from "../app/data/dto";

const validBroiler = {
  id: "broiler", name: "Broiler", builtIn: true,
  targetTemp: { min: 37.5, max: 37.8 }, targetHumidity: { min: 55, max: 65 },
  incubationDays: 21, defaultTurnInterval: 120, version: 1
};

describe("ModeDTO", () => {
  it("rejects invalid incubationDays 5", () => {
    expect(() => ModeDTOSchema.parse({ ...validBroiler, incubationDays: 5 })).toThrow();
  });
  it("accepts valid Broiler 21", () => {
    expect(ModeDTOSchema.parse(validBroiler)).toBeDefined();
  });
  it("defaults hysteresis 0.2 and 3", () => {
    const parsed = ModeDTOSchema.parse(validBroiler);
    expect(parsed.temp_hysteresis_c).toBe(0.2);
    expect(parsed.humidity_hysteresis_pct).toBe(3);
  });
  it("Result ok shape carries data", () => {
    const r: Result<typeof validBroiler> = { ok: true, data: validBroiler };
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe("broiler");
  });
  it("Result err structured has code/message + helper", () => {
    const r: Result<never> = { ok: false, error: { code: "validation_error", message: "incubationDays must be 17-36" } };
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("validation_error");
      expect(resultMessage(r)).toBe("incubationDays must be 17-36");
    }
  });
});
