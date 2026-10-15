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
const faults = [
  "None",
  "Sensor failure",
  "Stale sensor readings",
  "Overheating",
  "Continuous heating safety timeout",
  "Settings storage failure",
  "Controller reset after a crash",
];
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
  const pending = data?.request?.status === "pending";
  const authorized =
    !!unit.preparationStartedAt ||
    ["incubating", "lockdown", "hatching", "awaiting_finish"].includes(
      unit.cyclePhase,
    );
  let message = "Waiting for equipment status.";
  if (query.isError)
    message = "Equipment status is unknown. Check the connection.";
  else if (report && !fresh)
    message =
      "Equipment status is stale. A stop or start is not confirmed until the device responds.";
  else if (report && report.lifecycle !== 1)
    message =
      "Upload the preparation/incubation firmware to enable automatic regulation.";
  else if (report?.fault)
    message = `Regulation stopped: ${faults[report.fault] ?? "controller fault"}. Resolve the cause before resetting.`;
  else if (pending)
    message = `Waiting for device confirmation: ${{ prepare: "begin preparation", incubate: "continue regulation for incubation", stop: "turn all equipment off", reset: "reset fault" }[data?.request?.action ?? ""] ?? "command"}.`;
  else if (data?.request?.status === "timed_out")
    message =
      "The device did not confirm the command. Equipment state may have changed; check the connection.";
  else if (data?.request?.status === "rejected")
    message =
      "The device declined the command or restarted. Check readings and equipment status before continuing.";
  else if (report?.running)
    message =
      report.phase === 1
        ? "Automatically regulating for preparation. Day 1 has not started."
        : "Automatically maintaining incubation temperature and humidity.";
  else if (report)
    message =
      "Equipment is off. Sensor readings, displays and recording remain active.";
  return (
    <div
      className="mt-4 space-y-3 border-t pt-4"
      style={{ borderColor: "var(--border-default)" }}
    >
      <p role="status" aria-live="polite">
        {message}
      </p>
      {fresh && report?.lifecycle === 1 && !report.running && (
        <div className="flex flex-wrap gap-2">
          {!!report.fault && (
            <Button
              variant="outline"
              disabled={mutation.isPending || pending}
              onClick={() => mutation.mutate("reset")}
            >
              Reset controller fault
            </Button>
          )}
          {!report.fault && authorized && (
            <Button
              variant="outline"
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
            disabled={mutation.isPending || pending}
            onClick={() => mutation.mutate("stop")}
          >
            Stop equipment
          </Button>
        )}
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </div>
  );
}
