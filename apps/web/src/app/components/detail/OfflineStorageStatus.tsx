import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { appAuthApiBaseUrl } from "../../data/repositories/app-repository";
import { normalizeBaseUrl } from "../../data/repositories/api-repository";
import { notifySessionExpired } from "../../data/transport/session";
import type { Incubator } from "../../domain/types";
import { Button } from "../ui/button";

const schema = z.object({
  reported_at: z.string().nullable(),
  last_replay_at: z.string().nullable(),
  outcomes: z.record(z.number()),
  report: z.object({
    state: z.enum(["ready", "unavailable", "needs_init", "disabled"]),
    queued: z.number(), pending: z.number(), bytes: z.number(),
    untimed: z.number(), dropped: z.number(), corrupt: z.number(),
    oldest_ms: z.number().nullable().optional(), error: z.string(),
  }).nullable(),
});

async function readStatus(id: string) {
  const res = await fetch(
    `${normalizeBaseUrl(appAuthApiBaseUrl ?? "")}/api/v1/incubators/${encodeURIComponent(id)}/offline-storage`,
    { credentials: "include", cache: "no-store" },
  );
  if (res.status === 401) notifySessionExpired();
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) throw new Error("Recording status is unavailable.");
  return schema.parse(body.data);
}

export function OfflineStorageStatus({ unit }: { unit: Incubator }) {
  const query = useQuery({
    queryKey: ["offline-storage", unit.id], queryFn: () => readStatus(unit.id),
    enabled: !!appAuthApiBaseUrl, refetchInterval: 5000, retry: 1,
  });
  if (!appAuthApiBaseUrl) return null;
  const data = query.data, report = data?.report;
  const recent = !query.isError && !!data?.reported_at &&
    Date.now() - Date.parse(data.reported_at) < 45000;
  const quarantined = Object.entries(data?.outcomes ?? {})
    .filter(([key]) => key.startsWith("quarantined_")).reduce((sum, [, n]) => sum + n, 0);
  return (
    <section className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: "var(--border-default)" }} aria-label="Local recording">
      <h3>Local recording</h3>
      {query.isPending ? <p>Loading recording status…</p> : query.isError ? (
        <div>
          <p role="status">Recording status is unavailable.</p>
          <Button variant="outline" className="mt-2 h-[var(--control-height-action)] rounded-full" onClick={() => void query.refetch()}>Retry</Button>
        </div>
      ) : !report ? <p>Waiting for a device recording report.</p> : (
        <>
          <p role="status">
            {!recent ? "Device report is out of date. " : ""}
            {report.state === "ready"
              ? `${recent ? "Recording locally. " : "Last report: recording locally. "}${report.queued.toLocaleString()} saved readings waiting to upload.`
              : report.state === "needs_init"
                ? `${recent ? "Local recording needs setup on the controller. Readings are not being saved locally." : "Last report: local recording needed setup on the controller."}`
                : `${recent ? "Local recording is unavailable. Readings may be lost while disconnected." : "Last report: local recording was unavailable."}`}
          </p>
          {(report.dropped > 0 || report.corrupt > 0) && <p>{report.dropped.toLocaleString()} readings discarded before upload confirmation; {report.corrupt.toLocaleString()} damaged records detected.</p>}
          <details>
            <summary className="cursor-pointer py-2">Recording details</summary>
            <dl className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-2">
              <div><dt>Waiting to be saved</dt><dd>{report.pending.toLocaleString()} readings</dd></div>
              <div><dt>Without a confirmed time</dt><dd>{report.untimed.toLocaleString()} readings</dd></div>
              <div><dt>Oldest saved reading</dt><dd>{report.oldest_ms ? new Date(report.oldest_ms).toLocaleString() : "No confirmed timestamp"}</dd></div>
              <div><dt>Last historical upload accepted</dt><dd>{data?.last_replay_at ? new Date(data.last_replay_at).toLocaleString() : "None yet"}</dd></div>
              <div><dt>Historical readings held for review</dt><dd>{quarantined.toLocaleString()}</dd></div>
            </dl>
            <p>Historical uploads retain the original reading time. They do not indicate that the device is currently online.</p>
            <p>Recent readings still waiting to be saved may be lost if controller power is cut.</p>
          </details>
        </>
      )}
    </section>
  );
}
