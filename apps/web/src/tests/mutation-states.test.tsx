import type { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { ApiRepository } from "../app/data/repositories/api-repository";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import type {
  CompleteCycleInput,
  EggcelerateRepository,
  StopCycleInput,
} from "../app/data/repositories/repository";
import type { SettingsPreferences } from "../app/data/settings";
import { wireExamples } from "../app/data/transport/examples";
import { resetChamberToReady } from "../app/domain/incubator";
import type { Incubator, Mode } from "../app/domain/types";
import { farmQueryKeys } from "../app/features/farm/query-keys";
import {
  mutationErrorPresentation,
  RepositoryQueryError,
} from "../app/features/farm/repository-query";
import {
  useCycleHistoryActions,
  useFarmActions,
} from "../app/features/farm/use-farm-data";
import {
  AppProviders,
  createAppQueryClient,
} from "../app/providers/AppProviders";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

async function waitFor(check: () => boolean) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (check()) return;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  }
  throw new Error("Timed out waiting for mutation state.");
}
interface FarmActionsHandle {
  addMode(mode: Mode): Promise<boolean>;
  updateMode(id: string, patch: Partial<Mode>): Promise<boolean>;
  deleteMode(id: string): Promise<boolean>;
  completeCycle(input: CompleteCycleInput): Promise<boolean>;
  stopCycle(input: StopCycleInput): Promise<boolean>;
  acknowledgeAlert(id: string): Promise<boolean>;
  dismissAlert(id: string): Promise<boolean>;
  markAllAlertsRead(): Promise<boolean>;
  clearReadAlerts(): Promise<boolean>;
  saveSettings(settings: SettingsPreferences): Promise<boolean>;
  addIncubator(unit: Incubator): Promise<boolean>;
  updateIncubator(id: string, patch: Partial<Incubator>): Promise<boolean>;
  actionState: { updatingIncubatorId: string | null };
}

async function mountActions(repository: EggcelerateRepository) {
  const seeded = await repository.listIncubators();
  if (!seeded.ok) throw new Error("Incubator fixtures failed to load.");
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(farmQueryKeys.incubators, seeded.data);
  const container = document.createElement("div");
  const root = createRoot(container);
  const observed: { current: FarmActionsHandle | null } = {
    current: null,
  };
  function Probe() {
    observed.current = { ...useFarmActions(), ...useCycleHistoryActions() };
    return null;
  }
  await act(async () => {
    root.render(
      <AppProviders repository={repository} queryClient={queryClient}>
        <Probe />
      </AppProviders>,
    );
  });
  return {
    observed,
    queryClient,
    cleanup: () => act(async () => root.unmount()),
  };
}

function storedUnit(queryClient: QueryClient, id: string): Incubator {
  const unit = queryClient
    .getQueryData<Incubator[]>(farmQueryKeys.incubators)
    ?.find((candidate) => candidate.id === id);
  if (!unit) throw new Error(`Chamber ${id} is missing from the cache.`);
  return unit;
}

describe("repository mutation states", () => {
  it.each(
    (
      [
        "turn",
        "addMode",
        "updateMode",
        "deleteMode",
        "start",
        "reset",
        "complete",
        "stop",
        "create",
        "profile",
        "configuration",
        "reconnect",
        "preferences",
        "acknowledgeAlert",
        "dismissAlert",
        "markAllAlertsRead",
        "clearReadAlerts",
      ] as const
    ).flatMap((operation) =>
      [
        false,
        ...(operation === "complete" ||
        operation === "stop" ||
        operation === "turn"
          ? [true]
          : []),
      ].map((loseFollowup) => ({ operation, loseFollowup })),
    ),
  )(
    "reuses $operation key after lost response (follow-up GET: $loseFollowup)",
    async ({ operation, loseFollowup }) => {
      vi.mocked(toast.error).mockClear();
      const example = wireExamples.find(
        (item) => item.path === "/api/v1/incubators",
      );
      const envelope = example?.response as {
        ok: true;
        data: Record<string, unknown>[];
      };
      const preferenceEnvelope = wireExamples.find(
        (item) => item.path === "/api/v1/preferences" && item.method === "GET",
      )?.response as { ok: true; data: Record<string, unknown> };
      const alertEnvelope = wireExamples.find(
        (item) => item.path === "/api/v1/alerts" && item.method === "GET",
      )?.response as { ok: true; data: Record<string, unknown>[] };
      const terminalEnvelope = wireExamples.find((item) =>
        item.path.endsWith(`/cycles/current/${operation}`),
      )?.response as { ok: true; data: Record<string, unknown> } | undefined;
      const modeEnvelope = wireExamples.find(
        (item) => item.path === "/api/v1/modes" && item.method === "GET",
      )?.response as { ok: true; data: Record<string, unknown>[] };
      const dto = envelope.data[0];
      const seen: string[] = [];
      const results = new Map<string, unknown>();
      let commits = 0;
      let loseResponse = true;
      const repository = new ApiRepository({
        baseUrl: "http://api",
        fetchImpl: (async (url: unknown, init?: RequestInit) => {
          if (!init?.method || init.method === "GET") {
            if (
              loseFollowup &&
              commits > 0 &&
              loseResponse &&
              String(url).endsWith(`/incubators/${dto.id}`)
            ) {
              loseResponse = false;
              throw new TypeError("Follow-up GET lost after terminal commit");
            }
            return {
              json: async () =>
                String(url).endsWith("/modes")
                  ? modeEnvelope
                  : String(url).endsWith("/preferences")
                    ? preferenceEnvelope
                    : String(url).endsWith(`/incubators/${dto.id}`)
                      ? { ok: true, data: dto }
                      : envelope,
            } as Response;
          }
          const key = new Headers(init.headers).get("Idempotency-Key") ?? "";
          seen.push(key);
          if (!results.has(key)) {
            commits += 1;
            const patch = JSON.parse((init.body as string) || "{}") as Record<
              string,
              unknown
            >;
            results.set(key, {
              ok: true,
              data:
                operation === "turn"
                  ? { command_id: key, status: "accepted" }
                  : operation === "addMode" || operation === "updateMode"
                    ? { ...modeEnvelope.data[0], ...patch }
                    : operation === "deleteMode"
                      ? { id: modeEnvelope.data[0].id }
                      : operation === "complete" || operation === "stop"
                        ? terminalEnvelope?.data
                        : operation === "start" || operation === "reset"
                          ? dto
                          : operation === "preferences"
                            ? patch
                            : operation === "acknowledgeAlert"
                              ? alertEnvelope.data[0]
                              : operation === "dismissAlert"
                                ? { id: alertEnvelope.data[0].id }
                                : operation === "markAllAlertsRead" ||
                                    operation === "clearReadAlerts"
                                  ? alertEnvelope.data
                                  : { ...dto, ...patch },
            });
          }
          if (loseResponse && !loseFollowup) {
            loseResponse = false;
            throw new TypeError("Response lost after server commit");
          }
          return { json: async () => results.get(key) } as Response;
        }) as typeof fetch,
      });
      const mounted = await mountActions(repository);
      try {
        const actions = mounted.observed.current;
        if (!actions) throw new Error("Actions did not mount");
        const input = storedUnit(mounted.queryClient, dto.id as string);
        const settings = await repository.listSettings();
        if (!settings.ok) throw new Error("Settings fixture failed");
        const modes = await repository.listModes();
        if (!modes.ok) throw new Error("Modes fixture failed");
        const invoke = () =>
          operation === "addMode"
            ? actions.addMode(modes.data[0])
            : operation === "updateMode"
              ? actions.updateMode(modes.data[0].id, { name: "Retry mode" })
              : operation === "deleteMode"
                ? actions.deleteMode(modes.data[0].id)
                : operation === "turn"
                  ? actions.updateIncubator(input.id, {
                      lastTurned: new Date().toISOString(),
                      nextTurn: new Date().toISOString(),
                    })
                  : operation === "start"
                    ? actions.updateIncubator(input.id, {
                        modeId: input.modeId,
                        totalEggsLoaded: 20,
                        dayOfIncubation: 1,
                      })
                    : operation === "reset"
                      ? actions.updateIncubator(
                          input.id,
                          resetChamberToReady(input, new Date()),
                        )
                      : operation === "complete"
                        ? actions.completeCycle({
                            incubatorId: input.id,
                            chamber: input.name,
                            modeName: "Broiler",
                            cycleDays: 9,
                            totalEggs: 24,
                            fertileEggs: 22,
                            hatchedEggs: 20,
                          })
                        : operation === "stop"
                          ? actions.stopCycle({
                              incubatorId: input.id,
                              incubator: input.name,
                              modeName: "Broiler",
                              dayStopped: 9,
                              totalEggs: 24,
                              fertileEggs: 22,
                            })
                          : operation === "acknowledgeAlert" ||
                              operation === "dismissAlert"
                            ? actions[operation](
                                alertEnvelope.data[0].id as string,
                              )
                            : operation === "markAllAlertsRead" ||
                                operation === "clearReadAlerts"
                              ? actions[operation]()
                              : operation === "preferences"
                                ? actions.saveSettings(settings.data)
                                : operation === "create"
                                  ? actions.addIncubator(input)
                                  : actions.updateIncubator(
                                      input.id,
                                      operation === "profile"
                                        ? { name: "Retry name" }
                                        : operation === "configuration"
                                          ? { autoTurn: false }
                                          : { paired: true },
                                    );
        await act(async () => {
          expect(await invoke()).toBe(false);
        });
        const feedback = vi.mocked(toast.error).mock.calls[
          vi.mocked(toast.error).mock.calls.length - 1
        ]?.[1] as unknown as {
          action: { onClick: () => void };
        };
        await act(async () => feedback.action.onClick());
        await waitFor(
          () =>
            seen.length === 2 &&
            !mounted.observed.current?.actionState.updatingIncubatorId,
        );
        expect(seen[0]).not.toBe("");
        expect(seen[1]).toBe(seen[0]);
        expect(commits).toBe(1);
        // An intentional new user operation receives a different key.
        await act(async () => {
          expect(await invoke()).toBe(true);
        });
        expect(seen[2]).not.toBe(seen[0]);
        expect(commits).toBe(2);
      } finally {
        await mounted.cleanup();
      }
    },
  );
  it.each(
    (["create", "update", "delete"] as const).flatMap((operation) =>
      [false, true].map((loseFollowup) => ({ operation, loseFollowup })),
    ),
  )(
    "retries candling $operation with the same action and target (follow-up: $loseFollowup)",
    async ({ operation, loseFollowup }) => {
      vi.mocked(toast.error).mockClear();
      const envelope = wireExamples.find(
        (item) => item.path === "/api/v1/incubators",
      )?.response as { ok: true; data: Record<string, unknown>[] };
      const entry = {
        id: "chamber-1-d2",
        day: 2,
        label: "Journal",
        observed_on: "2026-09-14",
        fertile_eggs: 10,
        clear_eggs: 1,
        uncertain_eggs: 0,
        note: "Before",
        photo_keys: ["photos/one"],
        checks: [],
        checkpoint_type: "first",
      };
      let journal: Record<string, unknown>[] =
        operation === "create" ? [] : [entry];
      const dto = () => ({
        ...envelope.data[0],
        candling_entries: journal,
        candled_days: journal.map((e) => e.day),
      });
      const receipts = new Map<string, unknown>();
      const seen: { method: string; key: string; path: string }[] = [];
      let lose = true;
      let commits = 0;
      const repository = new ApiRepository({
        baseUrl: "http://api",
        fetchImpl: (async (url: unknown, init?: RequestInit) => {
          const path = String(url);
          const method = init?.method ?? "GET";
          if (method === "GET") {
            if (
              loseFollowup &&
              lose &&
              commits > 0 &&
              path.endsWith("/incubators/chamber-1")
            ) {
              lose = false;
              throw new TypeError("Follow-up lost");
            }
            const data = path.endsWith("/incubators")
              ? [dto()]
              : path.endsWith("/candling-entries")
                ? journal
                : dto();
            return { json: async () => ({ ok: true, data }) } as Response;
          }
          const key = new Headers(init?.headers).get("Idempotency-Key") ?? "";
          seen.push({ method, key, path });
          if (!receipts.has(key)) {
            commits += 1;
            const body = JSON.parse((init?.body as string) || "{}");
            if (method === "POST") journal = [{ ...entry, ...body }];
            else if (method === "PATCH") journal = [{ ...journal[0], ...body }];
            else if (method === "DELETE") journal = [];
            receipts.set(key, {
              ok: true,
              data: method === "DELETE" ? { id: entry.id } : journal[0],
            });
          }
          if (!loseFollowup && lose) {
            lose = false;
            throw new TypeError("Committed response lost");
          }
          return { json: async () => receipts.get(key) } as Response;
        }) as typeof fetch,
      });
      const mounted = await mountActions(repository);
      try {
        const unit = storedUnit(mounted.queryClient, "chamber-1");
        const next =
          operation === "create"
            ? [
                {
                  id: "draft",
                  day: 2,
                  label: "Journal",
                  date: "2026-09-14",
                  fertile: 10,
                  clear: 1,
                  uncertain: 0,
                  note: "After",
                  photos: ["photos/one"],
                  checks: [],
                },
              ]
            : operation === "delete"
              ? []
              : unit.candlingLog.map((e) => ({ ...e, note: "After" }));
        await act(async () => {
          expect(
            await mounted.observed.current?.updateIncubator(unit.id, {
              candlingLog: next,
            }),
          ).toBe(false);
        });
        const feedback = vi.mocked(toast.error).mock.calls[
          vi.mocked(toast.error).mock.calls.length - 1
        ]?.[1] as unknown as { action: { onClick: () => void } };
        await act(async () => feedback.action.onClick());
        await waitFor(
          () =>
            seen.length === 2 &&
            !mounted.observed.current?.actionState.updatingIncubatorId,
        );
        expect(commits).toBe(1);
        expect(seen[0].key).not.toBe("");
        expect(seen[1]).toEqual(seen[0]);
        expect(seen[0].method).toBe(
          operation === "create"
            ? "POST"
            : operation === "update"
              ? "PATCH"
              : "DELETE",
        );
        expect(journal).toHaveLength(operation === "delete" ? 0 : 1);
      } finally {
        await mounted.cleanup();
      }
    },
  );

  it("simulates offline, rejected, and timeout results without writing", async () => {
    for (const failureMode of ["offline", "rejected", "timeout"] as const) {
      const repository = new InMemoryEggcelerateRepository({
        failureModes: { updateIncubatorProfile: failureMode },
      });
      const result = await repository.updateIncubatorProfile("chamber-1", {
        name: "Should not persist",
      });
      const stored = await repository.getIncubator("chamber-1");

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(failureMode);
      expect(stored.ok && stored.data.name).toBe("Chamber One");
    }
  });

  it("shows a pending optimistic value and rolls it back after timeout", async () => {
    const repository = new InMemoryEggcelerateRepository({
      latencyMs: 30,
      failureModes: { updateIncubatorProfile: "timeout" },
    });
    const seeded = await repository.listIncubators();
    if (!seeded.ok) throw new Error("Incubator fixtures failed to load.");
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(farmQueryKeys.incubators, seeded.data);
    const container = document.createElement("div");
    const root = createRoot(container);
    const observed: { current: FarmActionsHandle | null } = {
      current: null,
    };

    function Probe() {
      const actions = { ...useFarmActions(), ...useCycleHistoryActions() };
      observed.current = actions;
      return <span>{actions.actionState.updatingIncubatorId ?? "idle"}</span>;
    }

    await act(async () =>
      root.render(
        <AppProviders repository={repository} queryClient={queryClient}>
          <Probe />
        </AppProviders>,
      ),
    );

    let resultPromise: Promise<boolean> | null = null;
    act(() => {
      if (!observed.current) throw new Error("Probe did not mount");
      resultPromise = observed.current.updateIncubator("chamber-1", {
        name: "Pending name",
      });
    });
    await waitFor(
      () => observed.current?.actionState.updatingIncubatorId === "chamber-1",
    );
    expect(
      queryClient.getQueryData<Incubator[]>(farmQueryKeys.incubators)?.[0].name,
    ).toBe("Pending name");

    let result = true;
    await act(async () => {
      if (!resultPromise) throw new Error("Expected a pending mutation");
      result = await resultPromise;
    });
    await waitFor(
      () => observed.current?.actionState.updatingIncubatorId === null,
    );
    expect(result).toBe(false);
    expect(observed.current?.actionState.updatingIncubatorId).toBeNull();
    expect(
      queryClient.getQueryData<Incubator[]>(farmQueryKeys.incubators)?.[0].name,
    ).toBe("Chamber One");

    await act(async () => root.unmount());
  });

  it("provides specific recovery copy for rejected, offline, and rolled-back timeouts", () => {
    expect(
      mutationErrorPresentation(new RepositoryQueryError("offline", "offline")),
    ).toEqual({
      title: "You're offline",
      description:
        "Reconnect, then try again. Your unsaved changes are still available.",
    });
    expect(
      mutationErrorPresentation(
        new RepositoryQueryError("rejected", "Not permitted."),
      ),
    ).toMatchObject({ title: "Change rejected" });
    expect(
      mutationErrorPresentation(
        new RepositoryQueryError("timeout", "timeout"),
        { rolledBack: true },
      ),
    ).toEqual({
      title: "Confirmation timed out",
      description:
        "The change was not confirmed. Try again. The previous values were restored.",
    });
  });

  it("routes turn, reconnect, reset, and unsupported patches to explicit commands", async () => {
    const repository = new InMemoryEggcelerateRepository({});
    const mounted = await mountActions(repository);
    const actions = () => {
      if (!mounted.observed.current) throw new Error("Probe did not mount");
      return mounted.observed.current;
    };

    const before = storedUnit(mounted.queryClient, "chamber-1");
    expect(
      await actions().updateIncubator("chamber-1", {
        lastTurned: "2000-01-01T00:00:00.000Z",
        nextTurn: "2000-01-01T04:00:00.000Z",
      }),
    ).toBe(true);
    expect(storedUnit(mounted.queryClient, "chamber-1").lastTurned).not.toBe(
      before.lastTurned,
    );

    expect(await actions().updateIncubator("chamber-1", { paired: true })).toBe(
      true,
    );
    expect(storedUnit(mounted.queryClient, "chamber-1").connectionState).toBe(
      "connected",
    );

    expect(
      await actions().updateIncubator("chamber-1", resetChamberToReady(before)),
    ).toBe(true);
    expect(storedUnit(mounted.queryClient, "chamber-1").dayOfIncubation).toBe(
      0,
    );
    expect(storedUnit(mounted.queryClient, "chamber-1").cyclePhase).toBe(
      "ready",
    );

    expect(
      await actions().updateIncubator("chamber-1", { status: "optimal" }),
    ).toBe(false);
    await mounted.cleanup();
  });

  it("creates and deletes candling entries from log patches", async () => {
    const repository = new InMemoryEggcelerateRepository({});
    const mounted = await mountActions(repository);
    const actions = () => {
      if (!mounted.observed.current) throw new Error("Probe did not mount");
      return mounted.observed.current;
    };

    const unit = storedUnit(mounted.queryClient, "chamber-1");
    const entry = {
      day: 99,
      label: "Late check",
      date: "2026-09-03",
      fertile: 20,
      clear: 1,
      uncertain: 0,
      note: "",
      photos: [],
      checks: [],
      checkpointType: "later" as const,
    };
    expect(
      await actions().updateIncubator("chamber-1", {
        candlingLog: [...unit.candlingLog, entry],
      }),
    ).toBe(true);
    const afterAdd = storedUnit(mounted.queryClient, "chamber-1");
    expect(afterAdd.candlingLog.some((item) => item.day === 99)).toBe(true);
    expect(afterAdd.candled[99]).toBe(true);

    expect(
      await actions().updateIncubator("chamber-1", {
        candlingLog: afterAdd.candlingLog.filter((item) => item.day !== 99),
      }),
    ).toBe(true);
    const afterDelete = storedUnit(mounted.queryClient, "chamber-1");
    expect(afterDelete.candlingLog.some((item) => item.day === 99)).toBe(false);
    await mounted.cleanup();
  });
});
