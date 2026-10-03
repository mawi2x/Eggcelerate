import { type Query, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AlertEntry } from "../../domain/types";
import { useAuth } from "../../providers/auth-context";
import { RepositoryQueryError } from "./repository-query";

const TOAST_ID = "farm-fetch-failure";
const TOAST_COOLDOWN_MS = 60_000;
const PREFIX = "local-fetch-";
const labels: Record<string, string> = {
  incubators: "incubator status",
  modes: "incubation modes",
  alerts: "alerts",
  "hatch-records": "hatch history",
  "aborted-cycles": "stopped-cycle history",
  readings: "readings",
  settings: "settings",
  "turn-command": "turn status",
};

type LocalNotification = AlertEntry & { hidden?: boolean };

/** One local notification per continuous outage, shared across farm queries.
 * Query retries/polling update the same episode; only a successful fetch resolves
 * its failure. Nothing here is written to the farm's durable device-alert feed.
 */
export function useFetchNotifications() {
  const client = useQueryClient();
  const auth = useAuth();
  const owner = auth.isAuthenticated
    ? `${auth.user?.id}:${auth.user?.email}`
    : null;
  const records = useRef<LocalNotification[]>([]);
  const lastToast = useRef({ owner: null as string | null, at: -Infinity });
  const [snapshot, setSnapshot] = useState<{
    owner: string | null;
    entries: AlertEntry[];
  }>({ owner: null, entries: [] });
  const actions = useRef({ publish: () => {} });

  useEffect(() => {
    records.current = [];
    if (lastToast.current.owner !== owner)
      lastToast.current = { owner, at: -Infinity };
    const publish = () =>
      setSnapshot({
        owner,
        entries: records.current.filter((entry) => !entry.hidden),
      });
    actions.current.publish = publish;
    publish();
    if (!owner) return;

    const failures = new Map<string, string>();
    let episode: LocalNotification | null = null;
    let sequence = 0;
    const synchronize = () => {
      if (failures.size === 0) {
        if (!episode) return;
        episode.title = "Data updates restored";
        episode.message =
          "The failed data requests succeeded. Automatic updates can continue.";
        episode.severity = "info";
        episode = null;
        toast.dismiss(TOAST_ID);
        publish();
        return;
      }
      const affected = Array.from(new Set(failures.values())).sort().join(", ");
      if (!episode) {
        episode = {
          id: `${PREFIX}${Date.now()}-${++sequence}`,
          title: "Unable to fetch data",
          unit: "Dashboard",
          severity: "warning",
          message: "",
          timestamp: new Date().toISOString(),
          acknowledged: false,
        };
        records.current = [episode, ...records.current].slice(0, 20);
        if (Date.now() - lastToast.current.at >= TOAST_COOLDOWN_MS) {
          lastToast.current.at = Date.now();
          toast.warning("Unable to fetch data", {
            id: TOAST_ID,
            description:
              "Check Notifications for details. Previously loaded data may be out of date.",
            duration: 5_000,
          });
        }
      }
      episode.message = `Could not update ${affected}. Previously loaded values may be out of date; some data may be unavailable. Retry the affected screen or check your connection.`;
      publish();
    };
    const inspect = (query: Query) => {
      const label =
        query.queryKey[0] === "farm"
          ? labels[String(query.queryKey[1])]
          : undefined;
      if (!label) return;
      if (query.state.status === "success") {
        if (failures.delete(query.queryHash)) synchronize();
      } else if (
        query.state.status === "error" &&
        query.state.fetchStatus === "idle" &&
        query.getObserversCount() > 0
      ) {
        if (
          query.state.error instanceof RepositoryQueryError &&
          query.state.error.code === "unauthorized"
        )
          return;
        if (!failures.has(query.queryHash)) {
          failures.set(query.queryHash, label);
          synchronize();
        }
      }
    };
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        (event.action.type === "error" ||
          (event.action.type === "success" && !event.action.manual))
      )
        inspect(event.query);
    });
    client.getQueryCache().getAll().forEach(inspect);
    return () => {
      unsubscribe();
      toast.dismiss(TOAST_ID);
    };
  }, [client, owner]);

  const update = (id: string | null, clearRead = false) => {
    for (const entry of records.current) {
      if (clearRead ? entry.acknowledged : id === null || entry.id === id) {
        if (clearRead) entry.hidden = true;
        else entry.acknowledged = true;
      }
    }
    actions.current.publish();
  };
  return {
    notifications: snapshot.owner === owner ? snapshot.entries : [],
    isLocal: (id: string) => id.startsWith(PREFIX),
    acknowledge: (id: string) => update(id),
    markAllRead: () => update(null),
    clearRead: () => update(null, true),
    dismiss: (id: string) => {
      const entry = records.current.find((entry) => entry.id === id);
      if (entry) entry.hidden = true;
      actions.current.publish();
    },
  };
}
