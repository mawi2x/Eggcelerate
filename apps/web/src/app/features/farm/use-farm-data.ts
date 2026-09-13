import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CandlingEntryInput,
  CompleteCycleInput,
  EggcelerateRepository,
  MutationOptions,
  StopCycleInput,
} from "../../data/repositories/repository";
import { initialSettings, type SettingsPreferences } from "../../data/settings";
import type { Result } from "../../domain/result";
import type {
  AlertEntry,
  CandlingLogEntry,
  HatchRecord,
  Incubator,
  Mode,
} from "../../domain/types";
import { useRepository } from "../../providers/repository-context";
import { farmQueryKeys } from "./query-keys";
import {
  mutationErrorPresentation,
  requireResultData,
} from "./repository-query";

async function runMutation(
  action: () => Promise<unknown>,
  options: { retry: () => void; rolledBack?: boolean },
): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    const feedback = mutationErrorPresentation(error, {
      rolledBack: options.rolledBack,
    });
    toast.error(feedback.title, {
      description: feedback.description,
      action: { label: "Retry", onClick: options.retry },
    });
    return false;
  }
}

export function useFarmData() {
  const repository = useRepository();
  const modesQuery = useQuery({
    queryKey: farmQueryKeys.modes,
    queryFn: async () => requireResultData(await repository.listModes()),
  });
  const incubatorsQuery = useQuery({
    queryKey: farmQueryKeys.incubators,
    queryFn: async () => requireResultData(await repository.listIncubators()),
  });
  const alertsQuery = useQuery({
    queryKey: farmQueryKeys.alerts,
    queryFn: async () => requireResultData(await repository.listAlerts()),
  });
  const hatchRecordsQuery = useQuery({
    queryKey: farmQueryKeys.hatchRecords,
    queryFn: async () => requireResultData(await repository.listHatchRecords()),
  });
  const settingsQuery = useQuery({
    queryKey: farmQueryKeys.settings,
    queryFn: async () => requireResultData(await repository.listSettings()),
  });
  const queries = [
    modesQuery,
    incubatorsQuery,
    alertsQuery,
    hatchRecordsQuery,
    settingsQuery,
  ];
  const initialError =
    queries.find((query) => query.error && query.data === undefined)?.error ??
    null;
  const backgroundError =
    queries.find((query) => query.error && query.data !== undefined)?.error ??
    null;

  return {
    modes: modesQuery.data ?? [],
    incubators: incubatorsQuery.data ?? [],
    alerts: alertsQuery.data ?? [],
    hatchRecords: hatchRecordsQuery.data ?? [],
    settings: settingsQuery.data ?? initialSettings,
    isLoading: queries.some((query) => query.isPending),
    isRefreshing: queries.some(
      (query) => query.isFetching && query.data !== undefined,
    ),
    staleError: backgroundError,
    error: initialError,
    retry: async () => {
      await Promise.all(queries.map((query) => query.refetch()));
    },
  };
}

const CONFIG_PATCH_KEYS = ["modeId", "autoTurn", "turnInterval"];
const TURN_PATCH_KEYS = ["lastTurned", "nextTurn"];
// Exact key set produced by resetChamberToReady(). repository.test.ts pins
// this against the helper so the reset route cannot silently drift.
const RESET_PATCH_KEYS = [
  "autoTurn",
  "candled",
  "candlingLog",
  "conditionSeverity",
  "connectionState",
  "cyclePhase",
  "dayOfIncubation",
  "fertileEggs",
  "lastTurned",
  "nextTurn",
  "status",
  "totalEggsLoaded",
];

function sameKeySet(keys: string[], wanted: string[]): boolean {
  if (keys.length !== wanted.length) return false;
  return keys.every((key) => wanted.includes(key));
}

function validationFailure(message: string): Result<Incubator> {
  return { ok: false, error: { code: "validation_error", message } };
}

function candlingEntryInput(entry: CandlingLogEntry): CandlingEntryInput {
  return {
    day: entry.day,
    label: entry.label,
    date: entry.date,
    fertile: entry.fertile,
    clear: entry.clear,
    uncertain: entry.uncertain,
    note: entry.note,
    photos: [...entry.photos],
    checks: [...entry.checks],
    checkpointType: entry.checkpointType,
    developing: entry.developing,
    stoppedDeveloping: entry.stoppedDeveloping,
  };
}

async function routeCandlingPatch(
  repository: EggcelerateRepository,
  id: string,
  patch: Partial<Incubator>,
): Promise<Result<Incubator>> {
  const current = await repository.getIncubator(id);
  if (!current.ok) return current;
  const nextLog = patch.candlingLog;
  if (!Array.isArray(nextLog)) {
    return validationFailure("Candling patch must include the entry list.");
  }
  const previousByDay = new Map(
    current.data.candlingLog.map((entry) => [entry.day, entry] as const),
  );
  const nextByDay = new Map(
    nextLog.map((entry) => [entry.day, entry] as const),
  );
  let latest: Result<Incubator> = current;
  for (const entry of nextLog) {
    const previous = previousByDay.get(entry.day);
    if (!previous) {
      latest = await repository.createCandlingEntry(
        id,
        candlingEntryInput(entry),
      );
    } else if (
      JSON.stringify(candlingEntryInput(previous)) !==
      JSON.stringify(candlingEntryInput(entry))
    ) {
      const { day: _ignored, ...rest } = candlingEntryInput(entry);
      latest = await repository.updateCandlingEntry(id, entry.day, rest);
    }
    if (!latest.ok) return latest;
  }
  for (const day of previousByDay.keys()) {
    if (!nextByDay.has(day)) {
      latest = await repository.deleteCandlingEntry(id, day);
      if (!latest.ok) return latest;
    }
  }
  return latest;
}

// Screen-facing updateIncubator() keeps its signature so screens and the App
// funnel stay untouched. Every patch shape routes to exactly one explicit
// repository command; derived-only or unknown patches fail loudly instead of
// writing arbitrary state. ApiRepository will expose the commands directly
// and this router retires with the mock-era funnel.
async function routeIncubatorPatch(
  repository: EggcelerateRepository,
  id: string,
  patch: Partial<Incubator>,
  options?: MutationOptions,
): Promise<Result<Incubator>> {
  const keys = Object.keys(patch);
  if (keys.length === 1 && keys[0] === "name") {
    return repository.updateIncubatorProfile(
      id,
      { name: patch.name ?? "" },
      options,
    );
  }
  if (sameKeySet(keys, RESET_PATCH_KEYS)) {
    return repository.resetStoppedCycle(id);
  }
  if ("dayOfIncubation" in patch || "totalEggsLoaded" in patch) {
    if (
      typeof patch.modeId !== "string" ||
      typeof patch.totalEggsLoaded !== "number"
    ) {
      return validationFailure("Cycle start needs a mode and an egg count.");
    }
    return repository.startCycle(id, {
      modeId: patch.modeId,
      totalEggs: patch.totalEggsLoaded,
    });
  }
  if (keys.length > 0 && keys.every((key) => CONFIG_PATCH_KEYS.includes(key))) {
    return repository.updateIncubatorConfiguration(
      id,
      {
        modeId: patch.modeId,
        autoTurn: patch.autoTurn,
        turnIntervalHours: patch.turnInterval,
      },
      options,
    );
  }
  if (sameKeySet(keys, TURN_PATCH_KEYS)) {
    return repository.requestManualTurn(id);
  }
  if (patch.paired === true) {
    return repository.reconnectIncubator(id, options);
  }
  if ("candled" in patch || "candlingLog" in patch) {
    return routeCandlingPatch(repository, id, patch);
  }
  return validationFailure("Unsupported incubator patch for the command port.");
}

export function useFarmActions() {
  const repository = useRepository();
  const queryClient = useQueryClient();

  const addIncubatorMutation = useMutation({
    mutationFn: async ({
      unit,
      options,
    }: {
      unit: Incubator;
      options: MutationOptions;
    }) => requireResultData(await repository.addIncubator(unit, options)),
    onSuccess: (created) => {
      queryClient.setQueryData<Incubator[]>(
        farmQueryKeys.incubators,
        (current = []) => [
          ...current.filter((unit) => unit.id !== created.id),
          created,
        ],
      );
    },
  });
  const updateIncubatorMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
      options,
    }: {
      id: string;
      patch: Partial<Incubator>;
      options: MutationOptions;
    }) =>
      requireResultData(
        await routeIncubatorPatch(repository, id, patch, options),
      ),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: farmQueryKeys.incubators });
      const previous = queryClient
        .getQueryData<Incubator[]>(farmQueryKeys.incubators)
        ?.find((unit) => unit.id === id);
      queryClient.setQueryData<Incubator[]>(
        farmQueryKeys.incubators,
        (current = []) =>
          current.map((unit) =>
            unit.id === id ? { ...unit, ...patch, id } : unit,
          ),
      );
      return { previous };
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Incubator[]>(
        farmQueryKeys.incubators,
        (current = []) =>
          current.map((unit) => (unit.id === updated.id ? updated : unit)),
      );
      void queryClient.invalidateQueries({
        queryKey: farmQueryKeys.readingsFor(updated.id),
      });
    },
    onError: (_error, { id }, context) => {
      const previous = context?.previous;
      if (!previous) return;
      queryClient.setQueryData<Incubator[]>(
        farmQueryKeys.incubators,
        (current = []) =>
          current.map((unit) => (unit.id === id ? previous : unit)),
      );
    },
  });
  const addModeMutation = useMutation({
    mutationFn: async (mode: Mode) =>
      requireResultData(await repository.addMode(mode)),
    onSuccess: (created) => {
      queryClient.setQueryData<Mode[]>(farmQueryKeys.modes, (current = []) => [
        ...current,
        created,
      ]);
    },
  });
  const updateModeMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Mode> }) =>
      requireResultData(await repository.updateMode(id, patch)),
    onSuccess: (updated) => {
      queryClient.setQueryData<Mode[]>(farmQueryKeys.modes, (current = []) =>
        current.map((mode) => (mode.id === updated.id ? updated : mode)),
      );
      void queryClient.invalidateQueries({
        queryKey: farmQueryKeys.incubators,
      });
      void queryClient.invalidateQueries({ queryKey: farmQueryKeys.readings });
    },
  });
  const deleteModeMutation = useMutation({
    mutationFn: async (id: string) =>
      requireResultData(await repository.deleteMode(id)),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<Mode[]>(farmQueryKeys.modes, (current = []) =>
        current.filter((mode) => mode.id !== id),
      );
    },
  });
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (id: string) =>
      requireResultData(await repository.acknowledgeAlert(id)),
    onSuccess: (updated) => {
      queryClient.setQueryData<AlertEntry[]>(
        farmQueryKeys.alerts,
        (current = []) =>
          current.map((alert) => (alert.id === updated.id ? updated : alert)),
      );
    },
  });
  const dismissAlertMutation = useMutation({
    mutationFn: async (id: string) =>
      requireResultData(await repository.dismissAlert(id)),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<AlertEntry[]>(
        farmQueryKeys.alerts,
        (current = []) => current.filter((alert) => alert.id !== id),
      );
    },
  });
  const markAllAlertsReadMutation = useMutation({
    mutationFn: async () =>
      requireResultData(await repository.markAllAlertsRead()),
    onSuccess: (alerts) =>
      queryClient.setQueryData(farmQueryKeys.alerts, alerts),
  });
  const clearReadAlertsMutation = useMutation({
    mutationFn: async () =>
      requireResultData(await repository.clearReadAlerts()),
    onSuccess: (alerts) =>
      queryClient.setQueryData(farmQueryKeys.alerts, alerts),
  });
  const saveSettingsMutation = useMutation({
    mutationFn: async ({
      settings,
      options,
    }: {
      settings: SettingsPreferences;
      options: MutationOptions;
    }) => requireResultData(await repository.saveSettings(settings, options)),
    onSuccess: (settings) =>
      queryClient.setQueryData(farmQueryKeys.settings, settings),
  });

  async function addIncubator(
    unit: Incubator,
    options: MutationOptions = { idempotencyKey: crypto.randomUUID() },
  ): Promise<boolean> {
    return runMutation(
      () => addIncubatorMutation.mutateAsync({ unit, options }),
      {
        retry: () => void addIncubator(unit, options),
      },
    );
  }
  async function updateIncubator(
    id: string,
    patch: Partial<Incubator>,
    options: MutationOptions = { idempotencyKey: crypto.randomUUID() },
  ): Promise<boolean> {
    return runMutation(
      () => updateIncubatorMutation.mutateAsync({ id, patch, options }),
      {
        retry: () => void updateIncubator(id, patch, options),
        rolledBack: true,
      },
    );
  }
  async function addMode(mode: Mode): Promise<boolean> {
    return runMutation(() => addModeMutation.mutateAsync(mode), {
      retry: () => void addMode(mode),
    });
  }
  async function updateMode(
    id: string,
    patch: Partial<Mode>,
  ): Promise<boolean> {
    return runMutation(() => updateModeMutation.mutateAsync({ id, patch }), {
      retry: () => void updateMode(id, patch),
    });
  }
  async function deleteMode(id: string): Promise<boolean> {
    return runMutation(() => deleteModeMutation.mutateAsync(id), {
      retry: () => void deleteMode(id),
    });
  }
  async function acknowledgeAlert(id: string): Promise<boolean> {
    return runMutation(() => acknowledgeAlertMutation.mutateAsync(id), {
      retry: () => void acknowledgeAlert(id),
    });
  }
  async function dismissAlert(id: string): Promise<boolean> {
    return runMutation(() => dismissAlertMutation.mutateAsync(id), {
      retry: () => void dismissAlert(id),
    });
  }
  async function markAllAlertsRead(): Promise<boolean> {
    return runMutation(() => markAllAlertsReadMutation.mutateAsync(), {
      retry: () => void markAllAlertsRead(),
    });
  }
  async function clearReadAlerts(): Promise<boolean> {
    return runMutation(() => clearReadAlertsMutation.mutateAsync(), {
      retry: () => void clearReadAlerts(),
    });
  }
  async function saveSettings(
    settings: SettingsPreferences,
    options: MutationOptions = { idempotencyKey: crypto.randomUUID() },
  ): Promise<boolean> {
    return runMutation(
      () => saveSettingsMutation.mutateAsync({ settings, options }),
      {
        retry: () => void saveSettings(settings, options),
      },
    );
  }

  return {
    addIncubator,
    updateIncubator,
    addMode,
    updateMode,
    deleteMode,
    acknowledgeAlert,
    dismissAlert,
    markAllAlertsRead,
    clearReadAlerts,
    saveSettings,
    actionState: {
      addingIncubator: addIncubatorMutation.isPending,
      updatingIncubatorId: updateIncubatorMutation.isPending
        ? (updateIncubatorMutation.variables?.id ?? null)
        : null,
      pendingAlertId: acknowledgeAlertMutation.isPending
        ? (acknowledgeAlertMutation.variables ?? null)
        : dismissAlertMutation.isPending
          ? (dismissAlertMutation.variables ?? null)
          : null,
      markingAllAlertsRead: markAllAlertsReadMutation.isPending,
      clearingReadAlerts: clearReadAlertsMutation.isPending,
      savingSettings: saveSettingsMutation.isPending,
    },
  };
}

export function useCycleHistoryActions() {
  const repository = useRepository();
  const queryClient = useQueryClient();

  const completeCycleMutation = useMutation({
    mutationFn: async (input: CompleteCycleInput) =>
      requireResultData(await repository.completeCycle(input)),
    onSuccess: ({ incubator, record }) => {
      queryClient.setQueryData<HatchRecord[]>(
        farmQueryKeys.hatchRecords,
        (current = []) => [...current, record],
      );
      queryClient.setQueryData<Incubator[]>(
        farmQueryKeys.incubators,
        (current = []) =>
          current.map((unit) => (unit.id === incubator.id ? incubator : unit)),
      );
      void queryClient.invalidateQueries({
        queryKey: farmQueryKeys.readingsFor(incubator.id),
      });
    },
  });
  const stopCycleMutation = useMutation({
    mutationFn: async (input: StopCycleInput) =>
      requireResultData(await repository.stopCycle(input)),
    onSuccess: ({ incubator }) => {
      queryClient.setQueryData<Incubator[]>(
        farmQueryKeys.incubators,
        (current = []) =>
          current.map((unit) => (unit.id === incubator.id ? incubator : unit)),
      );
      void queryClient.invalidateQueries({
        queryKey: farmQueryKeys.abortedCycles,
      });
    },
  });

  async function completeCycle(input: CompleteCycleInput): Promise<boolean> {
    return runMutation(() => completeCycleMutation.mutateAsync(input), {
      retry: () => void completeCycle(input),
    });
  }
  async function stopCycle(input: StopCycleInput): Promise<boolean> {
    return runMutation(() => stopCycleMutation.mutateAsync(input), {
      retry: () => void stopCycle(input),
    });
  }

  return {
    completeCycle,
    stopCycle,
    isCompletingCycle: completeCycleMutation.isPending,
    isStoppingCycle: stopCycleMutation.isPending,
  };
}
