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
      sensor_valid: z.boolean(),
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

const faultLabels: Record<number, string> = {
  1: "Sensor failure",
  2: "Stale sensor readings",
  3: "Overtemperature",
  4: "Heater safety timeout",
  5: "Controller storage failure",
  6: "Controller restarted after a crash",
  7: "Fan output failure; restart required",
};

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
  const data = query.data,
    report = data?.report;
  const fresh = !!data?.fresh && !query.isError;
  const benchmarkActive = report?.benchmark?.outcome === 1;
  const pending = data?.request?.status === "pending";
  const pendingAction = pending ? data?.request?.action : null;
  const requestStatus = data?.request?.status;
  const requestAction = data?.request?.action;
  const requestFailed =
    requestStatus === "rejected" ||
    requestStatus === "timed_out" ||
    requestStatus === "expired";
  const authorized =
    !!unit.preparationStartedAt ||
    ["incubating", "lockdown", "hatching", "awaiting_finish"].includes(
      unit.cyclePhase,
    );
  let message = "";
  if (pending) {
    message = `Waiting for the controller to confirm ${pendingAction ?? "the request"}.`;
  } else if (report?.fault) {
    message = `Fault ${report.fault}: ${faultLabels[report.fault] ?? "Controller fault"}.`;
  } else if (report && fresh && report.lifecycle === 1 && !report.running) {
    message = "No controller fault is reported. Equipment is stopped.";
  } else if (report?.running) {
    if (!report.sensor_valid) {
      message = "Sensor readings are invalid. Regulation should remain stopped.";
    } else if (report.phase === 1) {
      message = "Preparation regulation is running.";
    } else if (!benchmarkActive) {
      message = "Automatically maintaining incubation temperature and humidity.";
    }
  }
  const recovery =
    fresh &&
    report?.lifecycle === 1 &&
    !report.running;
  const unexpectedOutput =
    !!report &&
    (report.running ||
      unit.outputStates?.heaterOn ||
      unit.outputStates?.mistOn ||
      unit.outputStates?.fanOn ||
      unit.outputStates?.exhaustOn) &&
    (!authorized || !!report.fault);
  const actionError =
    mutation.error instanceof Error
      ? mutation.error.message
      : mutation.error
        ? "The controller request could not be sent."
        : null;

  if (!appAuthApiBaseUrl) {
    return (
      <p
        role="status"
        className="text-(length:--type-caption)"
        style={{ color: "var(--text-secondary)" }}
      >
        Controller recovery is unavailable for this data source.
      </p>
    );
  }
  if (query.isPending) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="text-(length:--type-caption)"
        style={{ color: "var(--text-secondary)" }}
      >
        Checking controller status…
      </p>
    );
  }
  if (query.isError) {
    return (
      <p
        role="alert"
        className="text-(length:--type-caption)"
        style={{ color: "var(--status-danger-fg)" }}
      >
        {query.error instanceof Error
          ? query.error.message
          : "Controller status is unavailable. Check the device connection and retry."}
      </p>
    );
  }
  if (data?.enabled === false) {
    return (
      <p
        role="status"
        className="text-(length:--type-caption)"
        style={{ color: "var(--text-secondary)" }}
      >
        Controller recovery is disabled on this server.
      </p>
    );
  }
  if (!fresh || !report) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="text-(length:--type-caption)"
        style={{ color: "var(--text-secondary)" }}
      >
        Waiting for a fresh controller report. Recovery actions are unavailable until the device reports its status.
      </p>
    );
  }
  if (report.lifecycle !== 1) {
    return (
      <p
        role="status"
        className="text-(length:--type-caption)"
        style={{ color: "var(--text-secondary)" }}
      >
        Upload the preparation and incubation firmware to enable controller recovery.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {message && (
        <p
          role={report.fault ? "alert" : "status"}
          aria-live={report.fault ? "assertive" : "polite"}
          className="text-(length:--type-caption)"
          style={{
            color: report.fault
              ? "var(--status-danger-fg)"
              : "var(--text-secondary)",
          }}
        >
          {message}
        </p>
      )}
      {report.fault && !report.sensor_valid && !report.running && (
        <p
          role="status"
          className="text-(length:--type-caption)"
          style={{ color: "var(--text-secondary)" }}
        >
          Reset becomes available after the controller reports valid sensor
          readings.
        </p>
      )}
      {recovery && (
        <div className="flex flex-wrap gap-2">
          {!!report.fault && (
            <Button
              variant="outline"
              size="default"
              className="rounded-full"
              disabled={
                mutation.isPending ||
                pending ||
                !report.sensor_valid ||
                report.fault === 7
              }
              onClick={() => mutation.mutate("reset")}
              aria-busy={
                mutation.isPending || (pending && pendingAction === "reset")
              }
            >
              {mutation.isPending
                ? "Sending reset…"
                : pending && pendingAction === "reset"
                  ? "Waiting for reset…"
                  : "Reset controller fault"}
            </Button>
          )}
          {!report.fault && authorized && (
            <Button
              variant="outline"
              size="default"
              className="rounded-full"
              disabled={mutation.isPending || pending || !report.sensor_valid}
              onClick={() => mutation.mutate("resume")}
              aria-busy={
                mutation.isPending || (pending && pendingAction === "resume")
              }
            >
              {mutation.isPending
                ? "Sending request…"
                : pending && pendingAction === "resume"
                  ? "Waiting for confirmation…"
                  : "Resume regulation"}
            </Button>
          )}
        </div>
      )}
      {report.fault && !report.running && report.sensor_valid && (
        <p
          className="text-(length:--type-caption)"
          style={{ color: "var(--text-secondary)" }}
        >
          The controller also checks for two good readings and a safe
          temperature before clearing the fault.
        </p>
      )}
      {report.fault === 7 && (
        <p
          role="status"
          className="text-(length:--type-caption)"
          style={{ color: "var(--text-secondary)" }}
        >
          Inspect the fan output, then restart the controller. This fault cannot
          be cleared with the reset command.
        </p>
      )}
      {requestFailed && (
        <p
          role="alert"
          className="text-(length:--type-caption)"
          style={{ color: "var(--status-danger-fg)" }}
        >
          The last {requestAction ?? "controller"} request was{" "}
          {requestStatus?.replace(/_/g, " ")}. Check the controller conditions
          before trying again.
        </p>
      )}
      {actionError && (
        <p
          role="alert"
          className="text-(length:--type-caption)"
          style={{ color: "var(--status-danger-fg)" }}
        >
          {actionError}
        </p>
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
            size="default"
            className="rounded-full"
            disabled={mutation.isPending || pending}
            onClick={() => mutation.mutate("stop")}
            aria-busy={
              mutation.isPending || (pending && pendingAction === "stop")
            }
          >
            {mutation.isPending
              ? "Sending stop…"
              : pending && pendingAction === "stop"
                ? "Waiting for stop…"
                : "Stop equipment"}
          </Button>
        )}
    </div>
  );
}
