import { focusManager } from "@tanstack/react-query";
import { act, Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import App from "../app/App";
import { FeatureDataStatus } from "../app/components/FeatureDataStatus";
import { RecoveryBoundary } from "../app/components/RecoveryBoundary";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import type { EggcelerateRepository } from "../app/data/repositories/repository";
import type { AlertEntry } from "../app/domain/types";
import { farmQueryKeys } from "../app/features/farm/query-keys";
import {
  useFarmData,
  useTurnCommandStatus,
} from "../app/features/farm/use-farm-data";
import {
  useIncubatorReadingMap,
  useIncubatorReadings,
} from "../app/features/farm/use-incubator-readings";
import {
  AppProviders,
  createAppQueryClient,
} from "../app/providers/AppProviders";
import { useAuth } from "../app/providers/auth-context";
import { recoverableLazy } from "../app/routing/recoverable-lazy";
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
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});
const failure = {
  ok: false as const,
  error: { code: "offline" as const, message: "Service unavailable" },
};
function queryClient() {
  const client = createAppQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });
  return client;
}
async function mountApp(
  repository: EggcelerateRepository,
  route = "/",
  client = queryClient(),
) {
  const location = memoryLocation({ path: route, record: true });
  const mounted = await render(
    <Router hook={location.hook}>
      <AppProviders repository={repository} queryClient={client}>
        <App />
      </AppProviders>
    </Router>,
  );
  return { ...mounted, client, location };
}
function retryButton(container: Element, label: string) {
  return container.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
}

// Exercise real queries and repository failures, including the initial no-cache case.
describe("feature recovery", () => {
  it("an initial alerts failure leaves chamber monitoring available and retries only alerts", async () => {
    const repository = new InMemoryEggcelerateRepository();
    const alerts = vi
      .spyOn(repository, "listAlerts")
      .mockResolvedValueOnce(failure);
    const chambers = vi.spyOn(repository, "listIncubators");
    const mounted = await mountApp(repository);
    try {
      await waitFor(
        () => mounted.container.textContent?.includes("Good day") ?? false,
      );
      expect(mounted.container.textContent).toContain("Active Incubators");
      expect(mounted.container.textContent).not.toContain(
        "Unable to load farm data",
      );
      await act(async () => mounted.location.navigate("/alerts"));
      await waitFor(() =>
        Boolean(retryButton(mounted.container, "Retry farm alerts")),
      );
      expect(mounted.container.textContent).toContain(
        "Farm alerts could not be loaded.",
      );
      expect(mounted.container.textContent).not.toContain(
        "You're all caught up",
      );
      const chamberCalls = chambers.mock.calls.length;
      await act(async () =>
        retryButton(mounted.container, "Retry farm alerts")?.click(),
      );
      await waitFor(() => !retryButton(mounted.container, "Retry farm alerts"));
      expect(alerts).toHaveBeenCalledTimes(2);
      expect(chambers).toHaveBeenCalledTimes(chamberCalls);
      expect(mounted.container.textContent).toContain("Temperature Too High");
    } finally {
      await mounted.unmount();
      mounted.client.clear();
    }
  });

  it("history failure leaves environmental charts available and hides unavailable hatch totals", async () => {
    const repository = new InMemoryEggcelerateRepository();
    const history = vi
      .spyOn(repository, "listHatchRecords")
      .mockResolvedValue(failure);
    const mounted = await mountApp(repository, "/trends");
    try {
      await waitFor(
        () =>
          mounted.container.textContent?.includes("Environmental Trends") ??
          false,
        "Trends lazy route did not finish loading.",
        5_000,
      );
      expect(mounted.container.textContent).not.toContain(
        "Unable to load farm data",
      );
      const hatch = Array.from(
        mounted.container.querySelectorAll("button"),
      ).find((b) => b.textContent === "Hatch History");
      await act(async () => hatch?.click());
      await waitFor(() =>
        Boolean(retryButton(mounted.container, "Retry hatch history")),
      );
      expect(mounted.container.textContent).toContain(
        "Hatch history could not be loaded.",
      );
      expect(
        mounted.container.querySelector("#hatch-summary-title"),
      ).toBeNull();
      history.mockRestore();
      await act(async () =>
        retryButton(mounted.container, "Retry hatch history")?.click(),
      );
      await waitFor(
        () => mounted.container.querySelector("#hatch-summary-title") !== null,
      );
      expect(retryButton(mounted.container, "Retry hatch history")).toBeNull();
      expect(mounted.container.textContent).toContain("Chamber Twelve");
    } finally {
      await mounted.unmount();
      mounted.client.clear();
    }
  });

  it("settings failure does not block monitoring and prevents editing fallback preferences", async () => {
    const repository = new InMemoryEggcelerateRepository();
    const settings = vi
      .spyOn(repository, "listSettings")
      .mockResolvedValue(failure);
    const mounted = await mountApp(repository);
    try {
      await waitFor(
        () => mounted.container.textContent?.includes("Good day") ?? false,
      );
      await act(async () => mounted.location.navigate("/settings"));
      await waitFor(() =>
        Boolean(retryButton(mounted.container, "Retry settings")),
      );
      expect(mounted.container.querySelector("input")).toBeNull();
      settings.mockRestore();
      await act(async () =>
        retryButton(mounted.container, "Retry settings")?.click(),
      );
      await waitFor(() => !retryButton(mounted.container, "Retry settings"));
      await waitFor(() => mounted.container.querySelector("input") !== null);
    } finally {
      await mounted.unmount();
      mounted.client.clear();
    }
  });

  it("preserves stale alerts with a timestamp and no loading replacement during retry", async () => {
    const repository = new InMemoryEggcelerateRepository();
    const mounted = await mountApp(repository, "/alerts");
    try {
      await waitFor(
        () =>
          mounted.container.textContent?.includes("Temperature Too High") ??
          false,
      );
      vi.spyOn(repository, "listAlerts").mockResolvedValue(failure);
      await act(async () => {
        await mounted.client.refetchQueries({ queryKey: farmQueryKeys.alerts });
      });
      expect(mounted.container.textContent).toContain(
        "Farm alerts may be out of date.",
      );
      expect(mounted.container.textContent).toContain("Last updated:");
      expect(mounted.container.textContent).toContain("Temperature Too High");
      let release!: (
        value: Awaited<ReturnType<typeof repository.listAlerts>>,
      ) => void;
      vi.mocked(repository.listAlerts).mockImplementation(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      await act(async () =>
        retryButton(mounted.container, "Retry farm alerts")?.click(),
      );
      expect(mounted.container.textContent).toContain("Temperature Too High");
      expect(mounted.container.textContent).not.toContain("Loading farm data");
      await waitFor(
        () =>
          retryButton(mounted.container, "Retry farm alerts")?.disabled ===
          true,
      );
      await act(async () => release({ ok: true, data: [] }));
      await waitFor(() => !retryButton(mounted.container, "Retry farm alerts"));
    } finally {
      await mounted.unmount();
      mounted.client.clear();
    }
  });

  it("keeps critical initial failures retryable", async () => {
    const repository = new InMemoryEggcelerateRepository();
    vi.spyOn(repository, "listIncubators").mockResolvedValueOnce(failure);
    const mounted = await mountApp(repository);
    try {
      await waitFor(
        () =>
          mounted.container.textContent?.includes("Unable to load farm data") ??
          false,
      );
      const retry = Array.from(
        mounted.container.querySelectorAll("button"),
      ).find((b) => b.textContent === "Try again");
      await act(async () => retry?.click());
      await waitFor(
        () => mounted.container.textContent?.includes("Good day") ?? false,
      );
    } finally {
      await mounted.unmount();
      mounted.client.clear();
    }
  });
});

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("quiet refresh and session cleanup", () => {
  it("polls alerts/history only when visible, refreshes on return and history activation, and stops on logout", async () => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    const repository = new InMemoryEggcelerateRepository();
    const alerts = vi.spyOn(repository, "listAlerts");
    const history = vi.spyOn(repository, "listHatchRecords");
    const client = queryClient();
    let data!: ReturnType<typeof useFarmData>;
    let auth!: ReturnType<typeof useAuth>;
    let active = false;
    function Probe() {
      auth = useAuth();
      data = useFarmData(active);
      return (
        <FeatureDataStatus label="Farm alerts" state={data.features.alerts} />
      );
    }
    const shell = () => (
      <AppProviders repository={repository} queryClient={client}>
        <Probe />
      </AppProviders>
    );
    const mounted = await render(shell());
    try {
      await advance(5);
      expect(alerts).toHaveBeenCalledTimes(1);
      expect(history).toHaveBeenCalledTimes(1);
      await advance(15_000);
      expect(alerts.mock.calls.length).toBeGreaterThan(1);
      expect(history).toHaveBeenCalledTimes(1);
      expect(mounted.container.textContent).toBe("");
      await advance(45_000);
      expect(history.mock.calls.length).toBeGreaterThan(1);
      await act(async () => focusManager.setFocused(false));
      const before = [alerts.mock.calls.length, history.mock.calls.length];
      await advance(60_000);
      expect([alerts.mock.calls.length, history.mock.calls.length]).toEqual(
        before,
      );
      await act(async () => focusManager.setFocused(true));
      await advance(5);
      expect(alerts.mock.calls.length).toBeGreaterThan(before[0]);
      expect(history.mock.calls.length).toBeGreaterThan(before[1]);
      const historyCalls = history.mock.calls.length;
      active = true;
      await mounted.rerender(shell());
      await advance(5);
      expect(history).toHaveBeenCalledTimes(historyCalls + 1);
      active = false;
      await mounted.rerender(shell());
      active = true;
      await mounted.rerender(shell());
      await advance(5);
      expect(history).toHaveBeenCalledTimes(historyCalls + 2);
      await act(async () => auth.signOut());
      const afterLogout = [alerts.mock.calls.length, history.mock.calls.length];
      await advance(60_000);
      await act(async () => {
        await data.features.alerts.retry();
        await data.features.history.retry();
        await data.retry();
      });
      expect([alerts.mock.calls.length, history.mock.calls.length]).toEqual(
        afterLogout,
      );
      expect(client.getQueryData(farmQueryKeys.alerts)).toBeUndefined();
    } finally {
      await mounted.unmount();
      client.clear();
    }
  });

  it("disables readings and pending-command polling while signed out", async () => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    const repository = new InMemoryEggcelerateRepository();
    const readings = vi.spyOn(repository, "listReadings");
    const turns = vi.spyOn(repository, "getTurnCommand");
    const client = queryClient();
    client.setQueryData(farmQueryKeys.turnCommand("chamber-1"), {
      id: "turn-1",
      status: "pending",
    });
    function Probe() {
      useIncubatorReadings("chamber-1", "24h");
      useIncubatorReadingMap(["chamber-2"], "24h");
      useTurnCommandStatus("chamber-1");
      return null;
    }
    const mounted = await render(
      <AppProviders
        repository={repository}
        queryClient={client}
        initiallyAuthenticated={false}
      >
        <Probe />
      </AppProviders>,
    );
    try {
      await advance(60_000);
      expect(readings).not.toHaveBeenCalled();
      expect(turns).not.toHaveBeenCalled();
    } finally {
      await mounted.unmount();
      client.clear();
    }
  });

  it("session expiry stops polling and a late response cannot repopulate private data", async () => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    const identity = {
      authenticated: true,
      user: {
        id: "user-1",
        email: "owner@example.com",
        display_name: "Owner",
        role: "owner",
      },
      farm: { id: "farm-1", name: "Farm" },
      csrf_token: "c".repeat(43),
      registration_enabled: false,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: identity }),
      }),
    );
    const repository = new InMemoryEggcelerateRepository();
    let release!: (
      value: Awaited<ReturnType<typeof repository.listAlerts>>,
    ) => void;
    const alerts = vi.spyOn(repository, "listAlerts").mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const readings = vi.spyOn(repository, "listReadings");
    const client = queryClient();
    let auth!: ReturnType<typeof useAuth>;
    function Probe() {
      auth = useAuth();
      useFarmData();
      useIncubatorReadings("chamber-1", "24h");
      return <span>{auth.status}</span>;
    }
    const mounted = await render(
      <AppProviders
        repository={repository}
        queryClient={client}
        authApiBaseUrl="/api"
      >
        <Probe />
      </AppProviders>,
    );
    try {
      await advance(5);
      expect(auth.isAuthenticated).toBe(true);
      expect(alerts).toHaveBeenCalledTimes(1);
      await act(async () =>
        window.dispatchEvent(new Event("eggcelerate:session-expired")),
      );
      await act(async () =>
        release({
          ok: true,
          data: [
            {
              id: "private",
              title: "Private",
              message: "Secret",
              unit: "Farm",
              severity: "info",
              timestamp: new Date().toISOString(),
              acknowledged: false,
            } satisfies AlertEntry,
          ],
        }),
      );
      const calls = [alerts.mock.calls.length, readings.mock.calls.length];
      await advance(60_000);
      expect(auth.isAuthenticated).toBe(false);
      expect([alerts.mock.calls.length, readings.mock.calls.length]).toEqual(
        calls,
      );
      expect(client.getQueryData(farmQueryKeys.alerts)).toBeUndefined();
      expect(
        client
          .getQueryCache()
          .getAll()
          .every((query) => query.state.data === undefined),
      ).toBe(true);
    } finally {
      await mounted.unmount();
      client.clear();
    }
  });
});

describe("render and lazy recovery", () => {
  it.each(["app", "screen"] as const)(
    "recovers a %s render failure with an explicit retry",
    async (scope) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      let fail = true;
      function Broken() {
        if (fail) throw new Error("Render failure");
        return <p>Recovered content</p>;
      }
      const mounted = await render(
        <RecoveryBoundary
          scope={scope}
          onRetry={() => {
            fail = false;
          }}
        >
          <Broken />
        </RecoveryBoundary>,
      );
      try {
        expect(mounted.container.textContent).toContain(
          scope === "app"
            ? "The dashboard couldn’t load"
            : "This screen couldn’t load",
        );
        const retry = Array.from(
          mounted.container.querySelectorAll("button"),
        ).find((b) => b.textContent === "Try again");
        await act(async () => retry?.click());
        expect(mounted.container.textContent).toContain("Recovered content");
      } finally {
        await mounted.unmount();
      }
    },
  );

  it("explains that cached module-download failures require a page reload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function MissingModule(): never {
      throw new TypeError("error loading dynamically imported module");
    }
    const mounted = await render(
      <RecoveryBoundary scope="screen">
        <MissingModule />
      </RecoveryBoundary>,
    );
    try {
      expect(mounted.container.textContent).toContain(
        "Try again will reload the page",
      );
      expect(
        Array.from(mounted.container.querySelectorAll("button")).filter(
          (b) => b.textContent === "Reload page",
        ),
      ).toHaveLength(0);
    } finally {
      await mounted.unmount();
    }
  });

  it("a rejected lazy import can retry with a new lazy instance without replacing the shell", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("Chunk failed"))
      .mockResolvedValue({ default: () => <p>Loaded screen</p> });
    const screen = recoverableLazy(loader);
    const Screen = screen.Component;
    const mounted = await render(
      <>
        <nav>Shell navigation</nav>
        <RecoveryBoundary scope="screen" onRetry={screen.retry}>
          <Suspense fallback={<p>Loading screen</p>}>
            <Screen />
          </Suspense>
        </RecoveryBoundary>
      </>,
    );
    try {
      await waitFor(
        () =>
          mounted.container.textContent?.includes(
            "This screen couldn’t load",
          ) ?? false,
      );
      expect(mounted.container.textContent).toContain("Shell navigation");
      const retry = Array.from(
        mounted.container.querySelectorAll("button"),
      ).find((b) => b.textContent === "Try again");
      await act(async () => retry?.click());
      await waitFor(
        () => mounted.container.textContent?.includes("Loaded screen") ?? false,
      );
      expect(loader).toHaveBeenCalledTimes(2);
    } finally {
      await mounted.unmount();
    }
  });

  it("navigating away clears a failed screen while the application boundary stays healthy", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken(): never {
      throw new Error("Broken route");
    }
    const view = (route: string) => (
      <RecoveryBoundary scope="app">
        <nav>Navigation</nav>
        <RecoveryBoundary key={route} scope="screen">
          {route === "bad" ? <Broken /> : <p>Other screen</p>}
        </RecoveryBoundary>
      </RecoveryBoundary>
    );
    const mounted = await render(view("bad"));
    try {
      await mounted.rerender(view("good"));
      expect(mounted.container.textContent).toContain("Other screen");
      expect(mounted.container.textContent).not.toContain("couldn’t load");
    } finally {
      await mounted.unmount();
    }
  });
});
