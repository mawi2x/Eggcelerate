import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AbortedCycleDTOSchema,
  AlertDTOSchema,
  abortedCycleFromDTO,
  alertFromDTO,
  ErrorEnvelopeSchema,
  HatchHistoryDTOSchema,
  hatchHistoryFromDTO,
  IncubatorDTOSchema,
  incubatorFromDTO,
  PreferencesDTOSchema,
  preferencesFromDTO,
  preferencesToDTO,
  ReadingDTOSchema,
  readingFromDTO,
  resultEnvelopeSchema,
} from "../app/data/transport/contracts";
import {
  failureExamples,
  type WireExample,
  wireExamples,
} from "../app/data/transport/examples";

function requireExample(path: string): WireExample {
  const found = wireExamples.find((item) => item.path === path);
  if (!found) throw new Error(`Missing wire example for ${path}`);
  return found;
}

function successData(path: string, itemSchema: z.ZodTypeAny): unknown {
  const envelope = resultEnvelopeSchema(itemSchema).parse(
    requireExample(path).response,
  );
  if (!envelope.ok) throw new Error(`Expected a success envelope for ${path}`);
  return envelope.data;
}

function successItems(path: string, itemSchema: z.ZodTypeAny): unknown[] {
  return z.array(itemSchema).parse(successData(path, z.array(itemSchema)));
}

describe("wire examples", () => {
  it("validates every example request and response against its schema", () => {
    expect(wireExamples.length).toBeGreaterThan(25);
    for (const example of wireExamples) {
      expect(example.method, `${example.path} needs a method`).toMatch(
        /^[A-Z]+$/,
      );
      expect(example.path.startsWith("/")).toBe(true);
      if (example.requestSchema) {
        expect(
          example.requestSchema.safeParse(example.request).success,
          `${example.method} ${example.path} request`,
        ).toBe(true);
      }
      expect(
        example.responseSchema.safeParse(example.response).success,
        `${example.method} ${example.path} response`,
      ).toBe(true);
    }
  });

  it("maps example responses back to domain models", () => {
    const unit = incubatorFromDTO(
      successItems("/api/v1/incubators", IncubatorDTOSchema)[0],
    );
    expect(unit.turnInterval).toBe(4);
    expect(unit.candled).toEqual({ 6: true });
    expect(unit.candlingLog.map((entry) => entry.checks)).toContainEqual([
      "veining",
      "airCell",
    ]);
    expect(unit.waterOk).toBe(true);

    const readings = successItems(
      "/api/v1/incubators/chamber-1/readings?window=24h",
      ReadingDTOSchema,
    );
    const reading = readingFromDTO(readings[0]);
    expect(reading.temp).toBe(37.62);
    expect(reading.ts).toBe(Date.parse("2026-09-03T10:00:00.000Z"));

    const alerts = successItems("/api/v1/alerts", AlertDTOSchema);
    const alert = alertFromDTO(alerts[0]);
    expect(alert.acknowledged).toBe(false);
    expect(alert.unit).toBe("Chamber One");

    const acked = alertFromDTO(
      successData("/api/v1/alerts/alert-1/acknowledge", AlertDTOSchema),
    );
    expect(acked.acknowledged).toBe(true);

    const completed = successItems(
      "/api/v1/cycles?status=completed",
      HatchHistoryDTOSchema,
    );
    expect(hatchHistoryFromDTO(completed[0]).hatchedEggs).toBe(20);

    const stopped = successItems(
      "/api/v1/cycles?status=stopped_early",
      AbortedCycleDTOSchema,
    );
    expect(abortedCycleFromDTO(stopped[0]).dayStopped).toBe(6);

    const original = successData("/api/v1/preferences", PreferencesDTOSchema);
    expect(preferencesToDTO(preferencesFromDTO(original))).toEqual(original);
  });

  it("covers every error code with a matching envelope", () => {
    const codes = new Set(failureExamples.map((item) => item.code));
    for (const code of [
      "validation_error",
      "not_found",
      "conflict",
      "rejected",
      "offline",
      "timeout",
      "unknown_error",
    ]) {
      expect(codes.has(code)).toBe(true);
    }
    for (const item of failureExamples) {
      const parsed = ErrorEnvelopeSchema.parse(item.response);
      expect(parsed.error.code).toBe(item.code);
    }
  });
});
