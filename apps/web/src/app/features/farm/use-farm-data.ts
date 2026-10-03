import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  CandlingEntryInput,
  CompleteCycleInput,
  EggcelerateRepository,
  MutationOptions,
  StartCycleInput,
  StopCycleInput,
  UpdateIncubatorConfigurationInput,
  UpdateIncubatorProfileInput,
} from "../../data/repositories/repository";
import { initialSettings, type SettingsPreferences } from "../../data/settings";
import { createIdempotencyKey } from "../../data/transport/idempotency";
import type { Result } from "../../domain/result";
import type {
  AbortedCycleRecord,
  AlertEntry,
  CandlingLogEntry,
  HatchRecord,
  Incubator,
  Mode,
  TurnCommand,
} from "../../domain/types";
import { useAuth } from "../../providers/auth-context";
import { useRepository } from "../../providers/repository-context";
import { farmQueryKeys } from "./query-keys";
import { featureQueryState } from "./query-state";
import {
  mutationErrorPresentation,
  requireResultData,
} from "./repository-query";
import {
  resolvedTelemetryStatus,
  TELEMETRY_POLL_INTERVAL_MS,
  TELEMETRY_REFRESH_ENABLED,
} from "./telemetry";

export type CandlingUpdateInput = {
  entries: CandlingLogEntry[];
  candled?: Record<number, boolean>;
  fertileEggs?: number;
};

export type IncubatorUpdateIntent =
  | { type: "profile"; input: UpdateIncubatorProfileInput }
  | { type: "configuration"; input: UpdateIncubatorConfigurationInput }
  | { type: "start-cycle"; input: StartCycleInput }
  | { type: "reset-stopped-cycle" }
  | { type: "reconnect" }
  | { type: "candling"; input: CandlingUpdateInput };

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

export function useFarmData(historyActive = false) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") setNow(Date.now());
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);
  const repository = useRepository();
  const enabled = isAuthenticated && !authLoading;
  const modesQuery = useQuery({
    queryKey: farmQueryKeys.modes,
    queryFn: async () => requireResultData(await repository.listModes()),
    enabled,
  });
  const incubatorsQuery = useQuery({
    queryKey: farmQueryKeys.incubators,
    queryFn: async () => requireResultData(await repository.listIncubators()),
    enabled,
    staleTime: TELEMETRY_POLL_INTERVAL_MS,
    refetchInterval: TELEMETRY_REFRESH_ENABLED
      ? TELEMETRY_POLL_INTERVAL_MS
      : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
  });
  const alertsQuery = useQuery({
    queryKey: farmQueryKeys.alerts,
    queryFn: async () => requireResultData(await repository.listAlerts()),
    enabled,
    staleTime: TELEMETRY_POLL_INTERVAL_MS,
    refetchInterval: TELEMETRY_REFRESH_ENABLED
      ? TELEMETRY_POLL_INTERVAL_MS
      : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
  });
  const hatchRecordsQuery = useQuery({
    queryKey: farmQueryKeys.hatchRecords,
    queryFn: async () => requireResultData(await repository.listHatchRecords()),
    enabled,
    staleTime: 60_000,
    refetchInterval: TELEMETRY_REFRESH_ENABLED ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
  });
  const settingsQuery = useQuery({
    queryKey: farmQueryKeys.settings,
    queryFn: async () => requireResultData(await repository.listSettings()),
    enabled,
  });
  const queries = [modesQuery, incubatorsQuery];
  useEffect(() => {
    if (enabled && historyActive)
      void hatchRecordsQuery.refetch({ cancelRefetch: false });
  }, [enabled, historyActive, hatchRecordsQuery.refetch]);
  const initialError =
    queries.find((query) => query.error && query.data === undefined)?.error ??
    null;
  const backgroundError =
    queries.find((query) => query.error && query.data !== undefined)?.error ??
    null;

  return {
    modes: modesQuery.data ?? [],
    incubators: (incubatorsQuery.data ?? []).map((unit) => ({
      ...unit,
      telemetryStatus: resolvedTelemetryStatus(unit, now),
    })),
    alerts: alertsQuery.data ?? [],
    hatchRecords: hatchRecordsQuery.data ?? [],
    settings: settingsQuery.data ?? initialSettings,
    isLoading:
      enabled && queries.some((query) => query.isPending && !query.error),
    isRefreshing: queries.some(
      (query) => query.isFetching && query.data !== undefined,
    ),
    staleError: backgroundError,
    error: initialError,
    features: {
      alerts: featureQueryState(alertsQuery, enabled),
      history: featureQueryState(hatchRecordsQuery, enabled),
      settings: featureQueryState(settingsQuery, enabled),
    },
    retry: async () => {
      if (enabled) await Promise.all(queries.map((query) => query.refetch()));
    },
  };
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

const candlingPlanInputs = new WeakMap<MutationOptions, string>();
const candlingPlans = new WeakMap<
  MutationOptions,
  Array<() => Promise<Result<Incubator>>>
>();

async function routeCandlingUpdate(
  repository: EggcelerateRepository,
  id: string,
  input: CandlingUpdateInput,
  options: MutationOptions,
): Promise<Result<Incubator>> {
  const identity = JSON.stringify({ id, input });
  const original = candlingPlanInputs.get(options);
  if (original !== undefined && original !== identity)
    return {
      ok: false,
      error: {
        code: "conflict",
        message: "Retry options belong to a different candling change.",
      },
    };
  let plan = candlingPlans.get(options);
  if (!plan) {
    const current = await repository.getIncubator(id);
    if (!current.ok) return current;
    const nextLog = input.entries;
    const previousByDay = new Map(
      current.data.candlingLog.map((entry) => [entry.day, entry] as const),
    );
    const nextByDay = new Map(
      nextLog.map((entry) => [entry.day, entry] as const),
    );
    plan = [];
    for (const entry of nextLog) {
      const previous = previousByDay.get(entry.day);
      if (!previous) {
        const input = candlingEntryInput(entry);
        const child = {
          idempotencyKey: `${options.idempotencyKey}:create:${entry.day}`,
        };
        plan.push(() => repository.createCandlingEntry(id, input, child));
      } else if (
        JSON.stringify(candlingEntryInput(previous)) !==
        JSON.stringify(candlingEntryInput(entry))
      ) {
        const { day: _ignored, ...input } = candlingEntryInput(entry);
        const child = {
          idempotencyKey: `${options.idempotencyKey}:update:${entry.day}`,
        };
        plan.push(() =>
          repository.updateCandlingEntry(id, entry.day, input, child),
        );
      }
    }
    for (const day of previousByDay.keys()) {
      if (!nextByDay.has(day)) {
        const child = {
          idempotencyKey: `${options.idempotencyKey}:delete:${day}`,
        };
        plan.push(() => repository.deleteCandlingEntry(id, day, child));
      }
    }
    candlingPlans.set(options, plan);
    candlingPlanInputs.set(options, identity);
  }
  let latest: Result<Incubator> | undefined;
  for (const action of plan) {
    latest = await action();
    if (!latest.ok) return latest;
  }
  return latest ?? repository.getIncubator(id);
}

async function routeIncubatorUpdate(
  repository: EggcelerateRepository,
  id: string,
  intent: IncubatorUpdateIntent,
  options?: MutationOptions,
): Promise<Result<Incubator>> {
  switch (intent.type) {
    case "profile":
      return repository.updateIncubatorProfile(id, intent.input, options);
    case "configuration":
      return repository.updateIncubatorConfiguration(id, intent.input, options);
    case "start-cycle":
      return repository.startCycle(id, intent.input, options);
    case "reset-stopped-cycle":
      return repository.resetStoppedCycle(id, options);
    case "reconnect":
      return repository.reconnectIncubator(id, options);
    case "candling":
      return routeCandlingUpdate(
        repository,
        id,
        intent.input,
        options ?? { idempotencyKey: createIdempotencyKey() },
      );
  }
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
      intent,
      options,
    }: {
      id: string;
      intent: IncubatorUpdateIntent;
      options: MutationOptions;
    }) =>
      requireResultData(
        await routeIncubatorUpdate(repository, id, intent, options),
      ),
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
  });
  const requestTurnMutation = useMutation({
    mutationFn: async ({
      id,
      options,
    }: {
      id: string;
      options: MutationOptions;
    }) => requireResultData(await repository.requestManualTurn(id, options)),
    onSuccess: (command, { id }) => {
      queryClient.setQueryData(farmQueryKeys.turnCommand(id), command);
      queryClient.setQueryData<Incubator[]>(
        farmQueryKeys.incubators,
        (current = []) =>
          current.map((unit) =>
            unit.id === id
              ? { ...unit, turnCommandStatus: command.status }
              : unit,
          ),
      );
    },
  });
  const addModeMutation = useMutation({
    mutationFn: async ({
      mode,
      options,
    }: {
      mode: Mode;
      options: MutationOptions;
    }) => requireResultData(await repository.addMode(mode, options)),
    onSuccess: (created) => {
      queryClient.setQueryData<Mode[]>(farmQueryKeys.modes, (current = []) => [
        ...current,
        created,
      ]);
    },
  });
  const updateModeMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
      options,
    }: {
      id: string;
      patch: Partial<Mode>;
      options: MutationOptions;
    }) => requireResultData(await repository.updateMode(id, patch, options)),
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
    mutationFn: async ({
      id,
      options,
    }: {
      id: string;
      options: MutationOptions;
    }) => requireResultData(await repository.deleteMode(id, options)),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<Mode[]>(farmQueryKeys.modes, (current = []) =>
        current.filter((mode) => mode.id !== id),
      );
    },
  });
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async ({
      id,
      options,
    }: {
      id: string;
      options: MutationOptions;
    }) => requireResultData(await repository.acknowledgeAlert(id, options)),
    onSuccess: (updated) => {
      queryClient.setQueryData<AlertEntry[]>(
        farmQueryKeys.alerts,
        (current = []) =>
          current.map((alert) => (alert.id === updated.id ? updated : alert)),
      );
    },
  });
  const dismissAlertMutation = useMutation({
    mutationFn: async ({
      id,
      options,
    }: {
      id: string;
      options: MutationOptions;
    }) => requireResultData(await repository.dismissAlert(id, options)),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<AlertEntry[]>(
        farmQueryKeys.alerts,
        (current = []) => current.filter((alert) => alert.id !== id),
      );
    },
  });
  const markAllAlertsReadMutation = useMutation({
    mutationFn: async (options: MutationOptions) =>
      requireResultData(await repository.markAllAlertsRead(options)),
    onSuccess: (alerts) =>
      queryClient.setQueryData(farmQueryKeys.alerts, alerts),
  });
  const clearReadAlertsMutation = useMutation({
    mutationFn: async (options: MutationOptions) =>
      requireResultData(await repository.clearReadAlerts(options)),
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
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
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
    intent: IncubatorUpdateIntent,
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
  ): Promise<boolean> {
    return runMutation(
      () => updateIncubatorMutation.mutateAsync({ id, intent, options }),
      {
        retry: () => void updateIncubator(id, intent, options),
      },
    );
  }
  async function requestTurn(
    id: string,
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
  ): Promise<boolean> {
    return runMutation(() => requestTurnMutation.mutateAsync({ id, options }), {
      retry: () => void requestTurn(id, options),
    });
  }
  async function addMode(
    mode: Mode,
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
  ): Promise<boolean> {
    return runMutation(() => addModeMutation.mutateAsync({ mode, options }), {
      retry: () => void addMode(mode, options),
    });
  }
  async function updateMode(
    id: string,
    patch: Partial<Mode>,
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
  ): Promise<boolean> {
    return runMutation(
      () => updateModeMutation.mutateAsync({ id, patch, options }),
      {
        retry: () => void updateMode(id, patch, options),
      },
    );
  }
  async function deleteMode(
    id: string,
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
  ): Promise<boolean> {
    return runMutation(() => deleteModeMutation.mutateAsync({ id, options }), {
      retry: () => void deleteMode(id, options),
    });
  }
  async function acknowledgeAlert(
    id: string,
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
  ): Promise<boolean> {
    return runMutation(
      () => acknowledgeAlertMutation.mutateAsync({ id, options }),
      {
        retry: () => void acknowledgeAlert(id, options),
      },
    );
  }
  async function dismissAlert(
    id: string,
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
  ): Promise<boolean> {
    return runMutation(
      () => dismissAlertMutation.mutateAsync({ id, options }),
      {
        retry: () => void dismissAlert(id, options),
      },
    );
  }
  async function markAllAlertsRead(
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
  ): Promise<boolean> {
    return runMutation(() => markAllAlertsReadMutation.mutateAsync(options), {
      retry: () => void markAllAlertsRead(options),
    });
  }
  async function clearReadAlerts(
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
  ): Promise<boolean> {
    return runMutation(() => clearReadAlertsMutation.mutateAsync(options), {
      retry: () => void clearReadAlerts(options),
    });
  }
  async function saveSettings(
    settings: SettingsPreferences,
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
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
    requestTurn,
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
      requestingTurnIncubatorId: requestTurnMutation.isPending
        ? (requestTurnMutation.variables?.id ?? null)
        : null,
      pendingAlertId: acknowledgeAlertMutation.isPending
        ? (acknowledgeAlertMutation.variables?.id ?? null)
        : dismissAlertMutation.isPending
          ? (dismissAlertMutation.variables?.id ?? null)
          : null,
      markingAllAlertsRead: markAllAlertsReadMutation.isPending,
      clearingReadAlerts: clearReadAlertsMutation.isPending,
      savingSettings: saveSettingsMutation.isPending,
    },
  };
}

export function useTurnCommandStatus(incubatorId: string): TurnCommand | null {
  const { isAuthenticated } = useAuth();
  const repository = useRepository();
  const queryClient = useQueryClient();
  const queryKey = farmQueryKeys.turnCommand(incubatorId);
  const cachedCommand = queryClient.getQueryData<TurnCommand>(queryKey);
  const query = useQuery({
    queryKey,
    staleTime: 0,
    enabled: isAuthenticated && Boolean(cachedCommand?.id),
    queryFn: async () => {
      const command = queryClient.getQueryData<TurnCommand>(queryKey);
      if (!command) throw new Error("No manual turn command is available.");
      return requireResultData(
        await repository.getTurnCommand(incubatorId, command.id),
      );
    },
    refetchInterval: (current) =>
      current.state.data?.status === "pending" ||
      current.state.data?.status === "dispatched"
        ? 2_000
        : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  return query.data ?? cachedCommand ?? null;
}

export function useCycleHistoryActions() {
  const repository = useRepository();
  const queryClient = useQueryClient();

  const completeCycleMutation = useMutation({
    mutationFn: async ({
      input,
      options,
    }: {
      input: CompleteCycleInput;
      options: MutationOptions;
    }) => requireResultData(await repository.completeCycle(input, options)),
    onSuccess: (record, { input }) => {
      queryClient.setQueryData<HatchRecord[]>(
        farmQueryKeys.hatchRecords,
        (current = []) => [
          ...current.filter((item) => item.id !== record.id),
          record,
        ],
      );
      void queryClient.invalidateQueries({
        queryKey: farmQueryKeys.incubators,
      });
      void queryClient.invalidateQueries({
        queryKey: farmQueryKeys.readingsFor(input.incubatorId),
      });
    },
  });
  const stopCycleMutation = useMutation({
    mutationFn: async ({
      input,
      options,
    }: {
      input: StopCycleInput;
      options: MutationOptions;
    }) => requireResultData(await repository.stopCycle(input, options)),
    onSuccess: (record, { input }) => {
      queryClient.setQueryData<AbortedCycleRecord[]>(
        farmQueryKeys.abortedCycles,
        (current = []) => [
          ...current.filter((item) => item.id !== record.id),
          record,
        ],
      );
      void queryClient.invalidateQueries({
        queryKey: farmQueryKeys.incubators,
      });
      void queryClient.invalidateQueries({
        queryKey: farmQueryKeys.readingsFor(input.incubatorId),
      });
    },
  });

  async function completeCycle(
    input: CompleteCycleInput,
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
  ): Promise<boolean> {
    return runMutation(
      () => completeCycleMutation.mutateAsync({ input, options }),
      {
        retry: () => void completeCycle(input, options),
      },
    );
  }
  async function stopCycle(
    input: StopCycleInput,
    options: MutationOptions = { idempotencyKey: createIdempotencyKey() },
  ): Promise<boolean> {
    return runMutation(
      () => stopCycleMutation.mutateAsync({ input, options }),
      {
        retry: () => void stopCycle(input, options),
      },
    );
  }

  return {
    completeCycle,
    stopCycle,
    isCompletingCycle: completeCycleMutation.isPending,
    isStoppingCycle: stopCycleMutation.isPending,
  };
}
