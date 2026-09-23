import { z } from "zod";
import { ModeDTOSchema } from "../dto";
import {
  AbortedCycleDTOSchema,
  AlertDTOSchema,
  CandlingEntryDTOSchema,
  CompleteCycleRequestSchema,
  CreateCandlingEntryRequestSchema,
  CreateIncubatorRequestSchema,
  HatchHistoryDTOSchema,
  IncubatorDTOSchema,
  ManualTurnRequestSchema,
  PreferencesDTOSchema,
  ReadingDTOSchema,
  ReconnectIncubatorRequestSchema,
  ResetStoppedCycleRequestSchema,
  resultEnvelopeSchema,
  StartCycleRequestSchema,
  StopCycleRequestSchema,
  UpdateCandlingEntryRequestSchema,
  UpdateIncubatorConfigurationRequestSchema,
  UpdateIncubatorProfileRequestSchema,
} from "./contracts";

// Representative wire examples reconciled with the B1 memory API.
// transport-examples.test.ts validates these against the transport schemas.
// Operational endpoints deliberately use their own shapes, not result envelopes.
export interface WireExample {
  method: string;
  path: string;
  request?: unknown;
  requestSchema?: z.ZodTypeAny;
  response: unknown;
  responseSchema: z.ZodTypeAny;
}

// Current memory adapter liveness/readiness; database checks arrive with B3.
export const HealthResponseSchema = z
  .object({ status: z.literal("ok") })
  .strict();
export const ReadyResponseSchema = z
  .object({
    ready: z.boolean(),
    checks: z
      .object({ store: z.literal("memory"), incubators: z.string() })
      .strict(),
  })
  .strict();

// Acceptance is not hardware acknowledgement; MQTT execution arrives with B4.
export const TurnAcceptedSchema = z
  .object({ command_id: z.string().min(1), status: z.literal("accepted") })
  .strict();

const broilerMode = {
  id: "broiler",
  name: "Broiler",
  built_in: true,
  target_temp_c: { min: 37.5, max: 37.8 },
  target_humidity_pct: { min: 55, max: 60 },
  incubation_days: 21,
  default_turn_interval_min: 240,
  temp_hysteresis_c: 0.2,
  humidity_hysteresis_pct: 3,
};

const candlingEntry = {
  id: "candling-1",
  day: 7,
  label: "First candling",
  observed_on: "2026-08-27",
  fertile_eggs: 22,
  clear_eggs: 2,
  uncertain_eggs: 0,
  developing_eggs: 21,
  stopped_developing_eggs: 0,
  note: "Strong veining across 22 eggs.",
  photo_keys: [],
  checks: ["veining", "air_cell"],
  checkpoint_type: "first",
};

const chamberOne = {
  id: "chamber-1",
  name: "Chamber One",
  device_id: "EGG-1003",
  mode_id: "broiler",
  day_of_incubation: 9,
  total_eggs_loaded: 24,
  fertile_eggs: 22,
  temperature_c: 37.6,
  humidity_pct: 57,
  water_ok: true,
  temperature_trend_c: 0.1,
  humidity_trend_pct: 0.3,
  power_source: "grid",
  battery_pct: 100,
  status: "optimal",
  last_turned_at: "2026-09-03T10:25:00.000Z",
  next_turn_at: "2026-09-03T14:25:00.000Z",
  turn_interval_min: 240,
  auto_turn: true,
  paired: true,
  cycle_phase: "incubating",
  condition_severity: "info",
  connection_state: "connected",
  telemetry_status: "fresh",
  telemetry_observed_at: "2026-09-03T10:00:00.000Z",
  telemetry_received_at: "2026-09-03T10:00:01.000Z",
  telemetry_last_seen_at: "2026-09-03T10:00:01.000Z",
  candled_days: [6],
  candling_entries: [candlingEntry],
};

const reading = {
  observed_at: "2026-09-03T10:00:00.000Z",
  received_at: "2026-09-03T10:00:01.000Z",
  temperature_c: 37.62,
  humidity_pct: 57.3,
  water_ok: true,
};

const alert = {
  id: "alert-1",
  incubator_id: "chamber-1",
  unit_name: "Chamber One",
  severity: "warning",
  code: "humidity-high",
  title: "Humidity above target",
  message: "Chamber One humidity 66% is above the 60% target.",
  occurred_at: "2026-09-03T10:05:00.000Z",
  acknowledged_at: null,
};

const hatchHistory = {
  id: "hatch-1",
  cycle_id: "cycle-1",
  incubator_id: "chamber-1",
  chamber_name: "Chamber One",
  mode_id: "broiler",
  mode_name: "Broiler",
  started_on: "2026-08-13",
  ended_on: "2026-09-03",
  total_eggs: 24,
  fertile_eggs: 22,
  hatched_eggs: 20,
};

const abortedCycle = {
  id: "aborted-1",
  cycle_id: "cycle-2",
  incubator_id: "chamber-2",
  chamber_name: "Chamber Two",
  mode_id: "duck",
  mode_name: "Duck",
  stopped_at: "2026-09-03T09:00:00.000Z",
  day_stopped: 6,
  total_eggs: 30,
  fertile_eggs: null,
};

const preferences = {
  farm_name: "Sunrise Poultry",
  account_holder: "Farmer Juan Dela Cruz",
  display_name: "Farmer Juan",
  notifications: {
    enabled: { temp: true, humidity: true, water: true },
    sms: true,
    email: true,
    phone: "",
    email_address: "",
  },
  temperature_unit: "c",
  time_zone: "gmt8",
};

const incubatorEnvelope = resultEnvelopeSchema(IncubatorDTOSchema);
const incubatorListEnvelope = resultEnvelopeSchema(z.array(IncubatorDTOSchema));

export const wireExamples: WireExample[] = [
  {
    method: "GET",
    path: "/healthz",
    response: { status: "ok" },
    responseSchema: HealthResponseSchema,
  },
  {
    method: "GET",
    path: "/readyz",
    response: { ready: true, checks: { store: "memory", incubators: "12" } },
    responseSchema: ReadyResponseSchema,
  },
  {
    method: "GET",
    path: "/api/v1/incubators",
    response: { ok: true, data: [chamberOne] },
    responseSchema: incubatorListEnvelope,
  },
  {
    method: "POST",
    path: "/api/v1/incubators",
    request: {
      name: "Chamber Thirteen",
      device_id: "EGG-1015",
      mode_id: "broiler",
    },
    requestSchema: CreateIncubatorRequestSchema,
    response: { ok: true, data: chamberOne },
    responseSchema: incubatorEnvelope,
  },
  {
    method: "GET",
    path: "/api/v1/incubators/chamber-1",
    response: { ok: true, data: chamberOne },
    responseSchema: incubatorEnvelope,
  },
  {
    method: "PATCH",
    path: "/api/v1/incubators/chamber-1",
    request: { name: "Renamed chamber" },
    requestSchema: UpdateIncubatorProfileRequestSchema,
    response: { ok: true, data: { ...chamberOne, name: "Renamed chamber" } },
    responseSchema: incubatorEnvelope,
  },
  {
    method: "PATCH",
    path: "/api/v1/incubators/chamber-1",
    request: { mode_id: "duck", turn_interval_min: 360 },
    requestSchema: UpdateIncubatorConfigurationRequestSchema,
    response: { ok: true, data: chamberOne },
    responseSchema: incubatorEnvelope,
  },
  {
    method: "POST",
    path: "/api/v1/incubators/chamber-1/reconnect",
    request: {},
    requestSchema: ReconnectIncubatorRequestSchema,
    response: { ok: true, data: chamberOne },
    responseSchema: incubatorEnvelope,
  },
  {
    method: "POST",
    path: "/api/v1/incubators/chamber-1/cycles",
    request: { mode_id: "broiler", total_eggs: 24 },
    requestSchema: StartCycleRequestSchema,
    response: { ok: true, data: chamberOne },
    responseSchema: incubatorEnvelope,
  },
  {
    method: "POST",
    path: "/api/v1/incubators/chamber-1/cycles/current/reset",
    request: {},
    requestSchema: ResetStoppedCycleRequestSchema,
    response: { ok: true, data: chamberOne },
    responseSchema: incubatorEnvelope,
  },
  {
    method: "POST",
    path: "/api/v1/incubators/chamber-1/cycles/current/complete",
    request: { hatched_eggs: 20 },
    requestSchema: CompleteCycleRequestSchema,
    response: { ok: true, data: hatchHistory },
    responseSchema: resultEnvelopeSchema(HatchHistoryDTOSchema),
  },
  {
    method: "POST",
    path: "/api/v1/incubators/chamber-2/cycles/current/stop",
    request: {},
    requestSchema: StopCycleRequestSchema,
    response: { ok: true, data: abortedCycle },
    responseSchema: resultEnvelopeSchema(AbortedCycleDTOSchema),
  },
  {
    method: "POST",
    path: "/api/v1/incubators/chamber-1/commands/turn",
    request: {},
    requestSchema: ManualTurnRequestSchema,
    response: { ok: true, data: { command_id: "cmd-1", status: "accepted" } },
    responseSchema: resultEnvelopeSchema(TurnAcceptedSchema),
  },
  {
    method: "GET",
    path: "/api/v1/incubators/chamber-1/readings?window=24h",
    response: { ok: true, data: [reading] },
    responseSchema: resultEnvelopeSchema(z.array(ReadingDTOSchema)),
  },
  {
    method: "GET",
    path: "/api/v1/incubators/chamber-1/cycles/current/candling-entries",
    response: { ok: true, data: [candlingEntry] },
    responseSchema: resultEnvelopeSchema(z.array(CandlingEntryDTOSchema)),
  },
  {
    method: "POST",
    path: "/api/v1/incubators/chamber-1/cycles/current/candling-entries",
    request: {
      day: 13,
      label: "Second candling",
      observed_on: "2026-09-02",
      fertile_eggs: 22,
      clear_eggs: 2,
      uncertain_eggs: 0,
      note: "Movement observed.",
      photo_keys: [],
      checks: ["movement"],
      checkpoint_type: "later",
    },
    requestSchema: CreateCandlingEntryRequestSchema,
    response: { ok: true, data: candlingEntry },
    responseSchema: resultEnvelopeSchema(CandlingEntryDTOSchema),
  },
  {
    method: "PATCH",
    path: "/api/v1/incubators/chamber-1/cycles/current/candling-entries/candling-1",
    request: { note: "Recheck tomorrow" },
    requestSchema: UpdateCandlingEntryRequestSchema,
    response: { ok: true, data: candlingEntry },
    responseSchema: resultEnvelopeSchema(CandlingEntryDTOSchema),
  },
  {
    method: "DELETE",
    path: "/api/v1/incubators/chamber-1/cycles/current/candling-entries/candling-1",
    response: { ok: true, data: { id: "candling-1" } },
    responseSchema: resultEnvelopeSchema(z.object({ id: z.string().min(1) })),
  },
  {
    method: "GET",
    path: "/api/v1/modes",
    response: { ok: true, data: [broilerMode] },
    responseSchema: resultEnvelopeSchema(z.array(ModeDTOSchema)),
  },
  {
    method: "POST",
    path: "/api/v1/modes",
    request: broilerMode,
    requestSchema: ModeDTOSchema,
    response: { ok: true, data: broilerMode },
    responseSchema: resultEnvelopeSchema(ModeDTOSchema),
  },
  {
    method: "GET",
    path: "/api/v1/modes/broiler",
    response: { ok: true, data: broilerMode },
    responseSchema: resultEnvelopeSchema(ModeDTOSchema),
  },
  {
    method: "PATCH",
    path: "/api/v1/modes/broiler",
    request: { target_temp_c: { min: 37.5, max: 37.9 } },
    requestSchema: ModeDTOSchema.partial(),
    response: { ok: true, data: broilerMode },
    responseSchema: resultEnvelopeSchema(ModeDTOSchema),
  },
  {
    method: "DELETE",
    path: "/api/v1/modes/broiler",
    response: { ok: true, data: { id: "broiler" } },
    responseSchema: resultEnvelopeSchema(z.object({ id: z.string().min(1) })),
  },
  {
    method: "GET",
    path: "/api/v1/alerts",
    response: { ok: true, data: [alert] },
    responseSchema: resultEnvelopeSchema(z.array(AlertDTOSchema)),
  },
  {
    method: "POST",
    path: "/api/v1/alerts/alert-1/acknowledge",
    response: {
      ok: true,
      data: { ...alert, acknowledged_at: "2026-09-03T10:10:00.000Z" },
    },
    responseSchema: resultEnvelopeSchema(AlertDTOSchema),
  },
  {
    method: "DELETE",
    path: "/api/v1/alerts/alert-1",
    response: { ok: true, data: { id: "alert-1" } },
    responseSchema: resultEnvelopeSchema(z.object({ id: z.string().min(1) })),
  },
  {
    method: "POST",
    path: "/api/v1/alerts/actions/acknowledge-all",
    response: { ok: true, data: [alert] },
    responseSchema: resultEnvelopeSchema(z.array(AlertDTOSchema)),
  },
  {
    method: "POST",
    path: "/api/v1/alerts/actions/clear-acknowledged",
    response: { ok: true, data: [] },
    responseSchema: resultEnvelopeSchema(z.array(AlertDTOSchema)),
  },
  {
    method: "GET",
    path: "/api/v1/cycles?status=completed",
    response: { ok: true, data: [hatchHistory] },
    responseSchema: resultEnvelopeSchema(z.array(HatchHistoryDTOSchema)),
  },
  {
    method: "GET",
    path: "/api/v1/cycles?status=stopped_early",
    response: { ok: true, data: [abortedCycle] },
    responseSchema: resultEnvelopeSchema(z.array(AbortedCycleDTOSchema)),
  },
  {
    method: "GET",
    path: "/api/v1/preferences",
    response: { ok: true, data: preferences },
    responseSchema: resultEnvelopeSchema(PreferencesDTOSchema),
  },
  {
    method: "PUT",
    path: "/api/v1/preferences",
    request: preferences,
    requestSchema: PreferencesDTOSchema,
    response: { ok: true, data: preferences },
    responseSchema: resultEnvelopeSchema(PreferencesDTOSchema),
  },
];

export const failureExamples: { code: string; response: unknown }[] = [
  {
    code: "validation_error",
    response: {
      ok: false,
      error: {
        code: "validation_error",
        message: "Total eggs must be a whole number.",
      },
    },
  },
  {
    code: "not_found",
    response: {
      ok: false,
      error: {
        code: "not_found",
        message: "Incubator chamber-99 was not found.",
      },
    },
  },
  {
    code: "conflict",
    response: {
      ok: false,
      error: {
        code: "conflict",
        message: "A candling entry for day 7 already exists.",
      },
    },
  },
  {
    code: "rejected",
    response: {
      ok: false,
      error: { code: "rejected", message: "Device rejected the turn command." },
    },
  },
  {
    code: "offline",
    response: {
      ok: false,
      error: { code: "offline", message: "Device EGG-1005 is offline." },
    },
  },
  {
    code: "timeout",
    response: {
      ok: false,
      error: {
        code: "timeout",
        message: "Confirmation was not received in time.",
      },
    },
  },
  {
    code: "unknown_error",
    response: {
      ok: false,
      error: { code: "unknown_error", message: "Unexpected server failure." },
    },
  },
];
