import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { normalizeBaseUrl } from "../../data/repositories/api-repository";
import { appAuthApiBaseUrl } from "../../data/repositories/app-repository";
import { getCsrfToken, notifySessionExpired } from "../../data/transport/session";

export const benchmarkModes = [
  { id: "htm", name: "Highest Temperature Mode (HTM)", description: "Measure heating up to a 38.5°C test ceiling. The physical maximum may be higher; safety limits stay active." },
  { id: "ltm", name: "Lowest Temperature Mode (LTM)", description: "Measure cooling with the heater and mist off, circulation on, and exhaust at full speed." },
  { id: "lhm", name: "Lowest Humidity Mode (LHM)", description: "Keep mist off, warm to 37.5–37.8°C, then compare 60% and 100% exhaust for ten minutes each." },
] as const;
export type BenchmarkKind = typeof benchmarkModes[number]["id"];
const resultSchema = z.object({ windows: z.number(), samples: z.number(), mean_t: z.number(), mean_rh: z.number(), min_t: z.number(), max_t: z.number(), min_rh: z.number(), max_rh: z.number(), dew_point: z.number() });
const snapshotSchema = z.object({ run_id: z.string(), kind: z.number(), outcome: z.number(), stage: z.number(), elapsed_ms: z.number(), stage_elapsed_ms: z.number(), samples: z.number(), min_t: z.number(), max_t: z.number(), min_rh: z.number(), max_rh: z.number(), invalidated: z.number(), results: z.array(resultSchema) });
export const runSchema = z.object({ id: z.string(), incubator_id: z.string(), chamber_name: z.string(), kind: z.enum(["htm", "ltm", "lhm"]), status: z.string(), started_at: z.string(), ended_at: z.string().nullable(), conditions: z.object({ notes: z.string().optional() }).passthrough(), reason: z.string().nullable(), result: snapshotSchema.nullable() });
export type BenchmarkRun = z.infer<typeof runSchema>;
export async function benchmarkRequest(unitId: string, suffix = "", body?: unknown) {
  const response = await fetch(`${normalizeBaseUrl(appAuthApiBaseUrl ?? "")}/api/v1/incubators/${encodeURIComponent(unitId)}/benchmarks${suffix}`, {
    method: body === undefined ? "GET" : "POST", credentials: "include", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(body === undefined ? {} : { "X-CSRF-Token": getCsrfToken() ?? "" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const envelope = await response.json().catch(() => null);
  if (response.status === 401) notifySessionExpired();
  if (!response.ok || !envelope?.ok) throw new Error(envelope?.error?.message ?? "Benchmark service is unavailable.");
  return envelope.data as unknown;
}
export function useBenchmarks(unitId: string) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["benchmarks", unitId], queryFn: async () => z.object({ runs: z.array(runSchema) }).parse(await benchmarkRequest(unitId)).runs, enabled: !!appAuthApiBaseUrl && !!unitId, refetchInterval: 3000, retry: 1 });
  const start = useMutation({ mutationFn: (input: { kind: BenchmarkKind; conditions: string }) => benchmarkRequest(unitId, "", { ...input, empty_confirmed: true }), onSuccess: () => client.invalidateQueries({ queryKey: ["benchmarks", unitId] }) });
  const stop = useMutation({ mutationFn: () => benchmarkRequest(unitId, "/stop", {}), onSuccess: () => client.invalidateQueries({ queryKey: ["benchmarks", unitId] }) });
  return { query, start, stop, active: query.data?.find((run) => !run.ended_at), available: !!appAuthApiBaseUrl };
}
export function benchmarkStatus(status: string) {
  const labels: Record<string, string> = { requested: "Waiting for device confirmation", running: "Benchmark running", stopping: "Waiting for stop confirmation", completed: "Completed", cancelled: "Stopped", timed_out: "Time limit reached", ceiling_reached: "Test ceiling reached", faulted: "Stopped by a sensor or controller fault", restart_interrupted: "Interrupted by restart", temperature_limited: "No qualified humidity plateau", rejected: "Start rejected" };
  return labels[status] ?? status;
}
