import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  fresh: z.boolean().optional(),
  auto_turn: z.boolean().optional(),
  allow_turn: z.boolean().optional(),
  interval_minutes: z.number().optional(),
  report: z
    .object({
      tray_capability: z.boolean().optional(),
      tray_running: z.boolean().optional(),
      tray_cancel_return: z.boolean().optional(),
      tray_position: z.number().optional(),
      tray_status: z.number().optional(),
    })
    .nullable()
    .optional(),
  state: z
    .object({
      suspended: z.boolean().optional(),
      next_at: z.string().optional(),
      home_status: z.string().nullable().optional(),
      home_confirmed: z.boolean().optional(),
      request: z.object({ action: z.string(), status: z.string() }).optional(),
    })
    .optional(),
});

async function control(id: string, action?: string) {
  const res = await fetch(
    `${normalizeBaseUrl(appAuthApiBaseUrl ?? "")}/api/v1/incubators/${encodeURIComponent(id)}/tray-control`,
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
    throw new Error(body?.error?.message ?? "Tray control unavailable.");
  return schema.parse(body.data);
}

export function TrayControlStatus({ unit }: { unit: Incubator }) {
  const client = useQueryClient();
  const [position, setPosition] = useState("");
  const key = ["tray-control", unit.id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => control(unit.id),
    enabled: !!appAuthApiBaseUrl,
    refetchInterval: 2000,
    retry: 1,
  });
  const mutation = useMutation({
    mutationKey: ["tray-control", unit.id],
    meta: { unitName: unit.name },
    mutationFn: (action: string) => control(unit.id, action),
    onSuccess: (data) => {
      client.setQueryData(key, data);
      setPosition("");
      void client.invalidateQueries({ queryKey: ["incubators"] });
    },
  });
  if (
    !appAuthApiBaseUrl ||
    query.data?.enabled === false ||
    unit.cyclePhase === "ready"
  )
    return null;
  const data = query.data,
    report = data?.report,
    state = data?.state;
  const fresh = !!data?.fresh && !query.isError;
  const pending = ["pending", "moving"].includes(state?.request?.status ?? "");
  const busy = mutation.isPending || pending || !!report?.tray_running;
  const positions = ["Unknown", "+45°", "−45°", "Level"];
  let message = "Waiting for tray status.";
  if (report && !report.tray_capability) message = "";
  else if (query.isError || !fresh) message = "";
  else if (!report?.tray_capability) message = "";
  else if (report.tray_cancel_return)
    message = "The cycle is cancelled. The tray is making a timed return toward level. Check its position when it stops.";
  else if (report.tray_running)
    message =
      "Timed movement running. The device will switch the motor off automatically.";
  else if (pending)
    message = "Waiting for the device to acknowledge the tray command.";
  else if (state?.home_confirmed)
    message = "Level position confirmed by you. Turning is stopped.";
  else if (state?.home_status?.startsWith("cancel_"))
    message = state.home_status === "cancel_return_complete_check_level"
      ? "The timed return has finished. Check that the tray is level."
      : "The cycle is cancelled and turning is paused. Check the tray position; an unknown position cannot be returned automatically.";
  else if (state?.home_status) message = "Turning is paused. Check that the tray is level.";
  else if (state?.suspended ?? true)
    message =
      "Turning is paused. Save the tray’s current side after visually checking it to resume.";
  else if (data?.auto_turn)
    message = `Automatic turning every ${(data.interval_minutes ?? 0) / 60} hours. Missed turns are skipped.`;
  else message = "Automatic turning is off.";
  return (
    <div
      className="mt-4 space-y-3 border-t pt-4"
      style={{ borderColor: "var(--border-default)" }}
    >
      <h3 className="font-semibold">Tray turning</h3>
      {message && <p role="status">{message}</p>}
      {report?.tray_capability && (
        <>
          <p className="text-(length:--type-body)" style={{ color: "var(--text-secondary)" }}>
            Last reported position:{" "}
            {positions[report.tray_position ?? 0] ?? "Unknown"}
            {report.tray_position
              ? " (operator supplied or estimated from timing)"
              : ""}
            .
          </p>
          {state?.request &&
            !["rejected", "interrupted", "timed_out"].includes(
              state.request.status,
            ) && (
              <p className="text-(length:--type-body)">
                Latest command: {state.request.action.replace(/_/g, " ")} —{" "}
                {state.request.status === "completed"
                  ? "timed command completed"
                  : state.request.status}
                .
              </p>
            )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={
                !fresh || busy || ![1, 2].includes(report.tray_position ?? 0)
              }
              onClick={() => mutation.mutate("home")}
            >
              Return toward level (5 seconds)
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("stop")}
            >
              Stop tray / pause turning
            </Button>
          </div>
          <div className="space-y-2">
            <label
              htmlFor={`tray-position-${unit.id}`}
              className="block text-(length:--type-body) font-medium"
            >
              Current position, checked by you
            </label>
            {data?.allow_turn && (
              <p className="text-(length:--type-body)">
                When automatic turning is enabled, saving a position resumes the
                schedule. From level, it starts with a 5-second tilt.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <select
                id={`tray-position-${unit.id}`}
                className="h-[var(--control-height-action)] rounded-lg border bg-transparent px-3"
                value={position}
                disabled={!fresh || busy}
                onChange={(event) => setPosition(event.target.value)}
              >
                <option value="">Choose observed position</option>
                {data?.allow_turn && (
                  <>
                    <option value="confirm_plus">+45°</option>
                    <option value="confirm_minus">−45°</option>
                  </>
                )}
                <option value="confirm_level">Level</option>
              </select>
              <Button
                variant="outline"
                className="rounded-full"
                disabled={!fresh || busy || !position}
                onClick={() => mutation.mutate(position)}
              >
                Save current position
              </Button>
            </div>
          </div>
          <p className="text-(length:--type-body)" style={{ color: "var(--text-secondary)" }}>
            Side-to-side runs use 10 seconds; return toward level uses 5
            seconds. Motor timing estimates position and does not measure the
            angle.
          </p>
        </>
      )}
    </div>
  );
}
