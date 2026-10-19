import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { normalizeBaseUrl } from "../../data/repositories/api-repository";
import { appAuthApiBaseUrl } from "../../data/repositories/app-repository";
import {
  getCsrfToken,
  notifySessionExpired,
} from "../../data/transport/session";
import type { Incubator } from "../../domain/types";
import { Button } from "../ui/button";

const schema = z.object({
  enabled: z.boolean(),
  fresh: z.boolean(),
  report: z
    .object({
      lifecycle: z.number().default(0),
      running: z.boolean(),
      benchmark: z.object({ outcome: z.number() }).nullable().optional(),
      phase: z.number().default(0),
      fault: z.number(),
    })
    .nullable(),
  request: z.object({ action: z.string(), status: z.string() }).nullable(),
  intent: z.object({ phase: z.number() }).nullable().optional(),
});
async function control(id: string, action?: string) {
  const res = await fetch(
    `${normalizeBaseUrl(appAuthApiBaseUrl ?? "")}/api/v1/incubators/${encodeURIComponent(id)}/climate-control`,
    {
      method: action ? "POST" : "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(action ? { "X-CSRF-Token": getCsrfToken() ?? "" } : {}),
      },
      ...(action ? { body: JSON.stringify({ action }) } : {}),
    },
  );
  const body = await res.json().catch(() => null);
  if (res.status === 401) notifySessionExpired();
  if (!res.ok || !body?.ok)
    throw new Error(body?.error?.message ?? "Equipment status is unavailable.");
  return schema.parse(body.data);
}
export function ClimateControlStatus({ unit }: { unit: Incubator }) {
  const client = useQueryClient();
  const key = ["climate-control", unit.id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => control(unit.id),
    enabled: !!appAuthApiBaseUrl,
    refetchInterval: 2000,
    retry: 1,
  });
  const mutation = useMutation({
    mutationKey: ["climate-control", unit.id],
    meta: { unitName: unit.name },
    mutationFn: (action: string) => control(unit.id, action),
    onSuccess: (data) => {
      client.setQueryData(key, data);
      void client.invalidateQueries({ queryKey: ["incubators"] });
    },
  });
  if (!appAuthApiBaseUrl || query.data?.enabled === false) return null;
  const data = query.data,
    report = data?.report;
  const fresh = !!data?.fresh && !query.isError;
  const benchmarkActive = report?.benchmark?.outcome === 1;
  const pending = data?.request?.status === "pending";
  const authorized =
    !!unit.preparationStartedAt ||
    ["incubating", "lockdown", "hatching", "awaiting_finish"].includes(
      unit.cyclePhase,
    );
  // Warnings are delivered through Notifications; retain actionable controls.
  let message = "";
  if (fresh && report?.lifecycle === 1 && !report.fault) {
    if (pending) message = "Waiting for device confirmation.";
    else if (
      !["timed_out", "rejected", "expired"].includes(
        data?.request?.status ?? "",
      )
    ) {
      if (report.running && report.phase !== 1 && !benchmarkActive)
        message =
          "Automatically maintaining incubation temperature and humidity.";
      else if (!report.running)
        message =
          "Equipment is off. Sensor readings, displays and recording remain active.";
    }
  }
  const recovery =
    fresh &&
    report?.lifecycle === 1 &&
    !report.running &&
    (!!report.fault || authorized);
  const unexpectedOutput =
    !!report &&
    !authorized &&
    (report.running ||
      unit.outputStates?.heaterOn ||
      unit.outputStates?.mistOn ||
      unit.outputStates?.fanOn ||
      unit.outputStates?.exhaustOn);
  if (!message && !recovery && !unexpectedOutput) return null;
  return (
    <div
      className="mt-4 space-y-3 border-t pt-4"
      style={{ borderColor: "var(--border-default)" }}
    >
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      {fresh && report?.lifecycle === 1 && !report.running && (
        <div className="flex flex-wrap gap-2">
          {!!report.fault && (
            <Button
              variant="outline"
              className="rounded-full"
              disabled={mutation.isPending || pending}
              onClick={() => mutation.mutate("reset")}
            >
              Reset controller fault
            </Button>
          )}
          {!report.fault && authorized && (
            <Button
              variant="outline"
              className="rounded-full"
              disabled={mutation.isPending || pending}
              onClick={() => mutation.mutate("resume")}
            >
              Resume regulation
            </Button>
          )}
        </div>
      )}
      {report &&
        !authorized &&
        (report.running ||
          unit.outputStates?.heaterOn ||
          unit.outputStates?.mistOn ||
          unit.outputStates?.fanOn ||
          unit.outputStates?.exhaustOn) && (
          <Button
            variant="outline"
            className="rounded-full"
            disabled={mutation.isPending || pending}
            onClick={() => mutation.mutate("stop")}
          >
            Stop equipment
          </Button>
        )}
    </div>
  );
}
