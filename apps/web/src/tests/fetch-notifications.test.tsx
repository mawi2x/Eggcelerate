import { useQuery } from "@tanstack/react-query";
import { act } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../app/App";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import { RepositoryQueryError } from "../app/features/farm/repository-query";
import { useFetchNotifications } from "../app/features/farm/use-fetch-notifications";
import {
  AppProviders,
  createAppQueryClient,
} from "../app/providers/AppProviders";
import { useAuth } from "../app/providers/auth-context";
import { render, waitFor } from "./render";

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    dismiss: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
  Toaster: () => null,
}));
afterEach(() => vi.restoreAllMocks());

async function setup() {
  const client = createAppQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });
  client.setQueryData(["farm", "alerts"], []);
  client.setQueryData(["farm", "readings", "chamber", "24h"], []);
  const failing = new Set<string>();
  let errorCode: "offline" | "unauthorized" = "offline";
  let observed!: ReturnType<typeof useFetchNotifications>;
  let auth!: ReturnType<typeof useAuth>;
  const refetch: Record<string, () => Promise<unknown>> = {};
  function Probe() {
    auth = useAuth();
    const alerts = useQuery({
      queryKey: ["farm", "alerts"],
      queryFn: async () => {
        if (failing.has("alerts"))
          throw new RepositoryQueryError(errorCode, "Unavailable");
        return [];
      },
      enabled: auth.isAuthenticated,
    });
    const readings = useQuery({
      queryKey: ["farm", "readings", "chamber", "24h"],
      queryFn: async () => {
        if (failing.has("readings"))
          throw new RepositoryQueryError(errorCode, "Unavailable");
        return [];
      },
      enabled: auth.isAuthenticated,
    });
    observed = useFetchNotifications();
    refetch.alerts = alerts.refetch;
    refetch.readings = readings.refetch;
    return (
      <div>
        {observed.notifications.map((entry) => (
          <p key={entry.id}>
            {entry.title}: {entry.message}
          </p>
        ))}
      </div>
    );
  }
  const mounted = await render(
    <AppProviders
      repository={new InMemoryEggcelerateRepository()}
      queryClient={client}
    >
      <Probe />
    </AppProviders>,
  );
  return {
    mounted,
    client,
    failing,
    notifications: () => observed,
    fetch: async (key: string) =>
      act(async () => {
        await refetch[key]();
      }),
    unauthorized: () => {
      errorCode = "unauthorized";
    },
    signOut: async () =>
      act(async () => {
        await auth.signOut();
      }),
  };
}

describe("fetch notifications", () => {
  it("groups simultaneous query failures, keeps cached data, and toasts once through polling and partial recovery", async () => {
    vi.mocked(toast.warning).mockClear();
    const probe = await setup();
    try {
      probe.failing.add("alerts");
      await probe.fetch("alerts");
      probe.failing.add("readings");
      await probe.fetch("readings");
      await probe.fetch("alerts");
      const entries = probe.notifications().notifications;
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toContain("alerts, readings");
      expect(toast.warning).toHaveBeenCalledTimes(1);
      expect(probe.client.getQueryData(["farm", "alerts"])).toEqual([]);
      probe.failing.delete("alerts");
      await probe.fetch("alerts");
      expect(probe.notifications().notifications[0].message).toContain(
        "Could not update readings.",
      );
      probe.failing.delete("readings");
      await probe.fetch("readings");
      expect(probe.notifications().notifications[0].title).toBe(
        "Data updates restored",
      );
      expect(probe.notifications().notifications[0].id).toBe(entries[0].id);
      expect(toast.warning).toHaveBeenCalledTimes(1);
    } finally {
      await probe.mounted.unmount();
      probe.client.clear();
    }
  });

  it("keeps dismissed failures hidden through retries and limits rapid recurrence toasts", async () => {
    vi.mocked(toast.warning).mockClear();
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const probe = await setup();
    try {
      probe.failing.add("alerts");
      await probe.fetch("alerts");
      const id = probe.notifications().notifications[0].id;
      await act(async () => probe.notifications().acknowledge(id));
      expect(probe.notifications().notifications[0].acknowledged).toBe(true);
      await act(async () => probe.notifications().clearRead());
      expect(probe.notifications().notifications).toHaveLength(0);
      await probe.fetch("alerts");
      expect(probe.notifications().notifications).toHaveLength(0);
      probe.failing.clear();
      await probe.fetch("alerts");
      probe.failing.add("alerts");
      await probe.fetch("alerts");
      expect(probe.notifications().notifications).toHaveLength(1);
      expect(toast.warning).toHaveBeenCalledTimes(1);
      await act(async () =>
        probe
          .notifications()
          .dismiss(probe.notifications().notifications[0].id),
      );
      await probe.fetch("alerts");
      expect(probe.notifications().notifications).toHaveLength(0);
      probe.failing.clear();
      await probe.fetch("alerts");
      now += 60_000;
      probe.failing.add("alerts");
      await probe.fetch("alerts");
      expect(toast.warning).toHaveBeenCalledTimes(2);
      await act(async () => probe.notifications().markAllRead());
      expect(probe.notifications().notifications[0].acknowledged).toBe(true);
    } finally {
      await probe.mounted.unmount();
      probe.client.clear();
    }
  });

  it("ignores unauthorized and unrelated queries and clears notifications on logout", async () => {
    vi.mocked(toast.warning).mockClear();
    const probe = await setup();
    try {
      probe.unauthorized();
      probe.failing.add("alerts");
      await probe.fetch("alerts");
      expect(probe.notifications().notifications).toHaveLength(0);
      await act(async () => {
        await probe.client
          .fetchQuery({
            queryKey: ["other"],
            queryFn: async () => {
              throw new Error("Failure");
            },
          })
          .catch(() => {});
      });
      expect(toast.warning).not.toHaveBeenCalled();
      probe.failing.add("readings");
      await probe.fetch("readings");
      expect(probe.notifications().notifications).toHaveLength(0);
      await probe.signOut();
      expect(probe.notifications().notifications).toHaveLength(0);
    } finally {
      await probe.mounted.unmount();
      probe.client.clear();
    }
  });

  it("clears an active incident on logout and ignores subsequent cache errors", async () => {
    const probe = await setup();
    try {
      probe.failing.add("alerts");
      await probe.fetch("alerts");
      expect(probe.notifications().notifications).toHaveLength(1);
      await probe.signOut();
      expect(probe.notifications().notifications).toHaveLength(0);
      await probe.fetch("alerts");
      expect(probe.notifications().notifications).toHaveLength(0);
    } finally {
      await probe.mounted.unmount();
      probe.client.clear();
    }
  });

  it("does not claim recovery from an optimistic cache write and bounds local history", async () => {
    const probe = await setup();
    try {
      probe.failing.add("alerts");
      await probe.fetch("alerts");
      await act(async () => {
        probe.client.setQueryData(["farm", "alerts"], []);
      });
      expect(probe.notifications().notifications[0].title).toBe(
        "Unable to fetch data",
      );
      probe.failing.clear();
      await probe.fetch("alerts");
      expect(probe.notifications().notifications[0].title).toBe(
        "Data updates restored",
      );
      for (let index = 0; index < 21; index++) {
        probe.failing.add("alerts");
        await probe.fetch("alerts");
        probe.failing.clear();
        await probe.fetch("alerts");
      }
      expect(probe.notifications().notifications).toHaveLength(20);
    } finally {
      await probe.mounted.unmount();
      probe.client.clear();
    }
  });

  it("stays quiet when an automatic retry succeeds", async () => {
    vi.mocked(toast.warning).mockClear();
    window.history.replaceState(null, "", "/");
    const repository = new InMemoryEggcelerateRepository();
    vi.spyOn(repository, "listAlerts").mockResolvedValueOnce({
      ok: false,
      error: { code: "offline", message: "Temporary failure" },
    });
    const client = createAppQueryClient();
    client.setDefaultOptions({
      queries: { retry: 1, retryDelay: 0, staleTime: Infinity },
    });
    const mounted = await render(
      <AppProviders repository={repository} queryClient={client}>
        <App />
      </AppProviders>,
    );
    try {
      await waitFor(
        () => mounted.container.textContent?.includes("Good day") ?? false,
      );
      expect(toast.warning).not.toHaveBeenCalled();
      expect(mounted.container.textContent).not.toContain(
        "Unable to fetch data",
      );
    } finally {
      await mounted.unmount();
      client.clear();
    }
  });

  it("exposes secondary failures through the bell and feed while monitoring remains usable", async () => {
    window.history.replaceState(null, "", "/");
    const repository = new InMemoryEggcelerateRepository();
    vi.spyOn(repository, "listAlerts").mockResolvedValue({
      ok: false,
      error: { code: "offline", message: "Alerts unavailable" },
    });
    const acknowledge = vi.spyOn(repository, "markAllAlertsRead");
    const client = createAppQueryClient();
    client.setDefaultOptions({
      queries: { retry: false, staleTime: Infinity },
    });
    const mounted = await render(
      <AppProviders repository={repository} queryClient={client}>
        <App />
      </AppProviders>,
    );
    try {
      await waitFor(
        () => mounted.container.textContent?.includes("Good day") ?? false,
      );
      const bell = () =>
        mounted.container.querySelector<HTMLButtonElement>(
          'button[aria-label="Notifications, 1 unread"]',
        );
      await waitFor(() => Boolean(bell()));
      await act(async () => bell()?.click());
      await waitFor(
        () =>
          document.body.textContent?.includes("Could not update alerts.") ??
          false,
      );
      const viewAll = Array.from(document.body.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("View All Notifications"),
      );
      await act(async () => viewAll?.click());
      await waitFor(() =>
        Boolean(
          mounted.container.querySelector(
            'section[aria-label="Notifications"]',
          ),
        ),
      );
      expect(mounted.container.textContent).toContain("Unable to fetch data");
      const mark =
        mounted.container.querySelector<HTMLButtonElement>(
          'button[aria-label="Mark all as read"]',
        ) ??
        Array.from(mounted.container.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Mark All as Read"),
        );
      expect(mark).toBeDefined();
      await act(async () => mark?.click());
      expect(acknowledge).not.toHaveBeenCalled();
    } finally {
      await mounted.unmount();
      client.clear();
      window.history.replaceState(null, "", "/");
    }
  });
});
