import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import type { Incubator } from "../app/domain/types";
import { farmQueryKeys } from "../app/features/farm/query-keys";
import {
  mutationErrorPresentation,
  RepositoryQueryError,
} from "../app/features/farm/repository-query";
import { useFarmActions } from "../app/features/farm/use-farm-data";
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

describe("repository mutation states", () => {
  it("simulates offline, rejected, and timeout results without writing", async () => {
    for (const failureMode of ["offline", "rejected", "timeout"] as const) {
      const repository = new InMemoryEggcelerateRepository({
        failureModes: { updateIncubator: failureMode },
      });
      const result = await repository.updateIncubator("chamber-1", {
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
      failureModes: { updateIncubator: "timeout" },
    });
    const seeded = await repository.listIncubators();
    if (!seeded.ok) throw new Error("Incubator fixtures failed to load.");
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(farmQueryKeys.incubators, seeded.data);
    const container = document.createElement("div");
    const root = createRoot(container);
    const observed: { current: ReturnType<typeof useFarmActions> | null } = {
      current: null,
    };

    function Probe() {
      const actions = useFarmActions();
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
});
