import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AlertEntry, HatchRecord, Incubator, Mode } from "../../domain/types";
import type { CompleteCycleInput, StopCycleInput } from "../../data/repositories/repository";
import { initialSettings, type SettingsPreferences } from "../../data/settings";
import { useRepository } from "../../providers/repository-context";
import { farmQueryKeys } from "./query-keys";
import { mutationErrorPresentation, requireResultData } from "./repository-query";

async function runMutation(
  action: () => Promise<unknown>,
  options: { retry: () => void; rolledBack?: boolean },
): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    const feedback = mutationErrorPresentation(error, { rolledBack: options.rolledBack });
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
  const queries = [modesQuery, incubatorsQuery, alertsQuery, hatchRecordsQuery, settingsQuery];
  const initialError = queries.find((query) => query.error && query.data === undefined)?.error ?? null;
  const backgroundError = queries.find((query) => query.error && query.data !== undefined)?.error ?? null;

  return {
    modes: modesQuery.data ?? [],
    incubators: incubatorsQuery.data ?? [],
    alerts: alertsQuery.data ?? [],
    hatchRecords: hatchRecordsQuery.data ?? [],
    settings: settingsQuery.data ?? initialSettings,
    isLoading: queries.some((query) => query.isPending),
    isRefreshing: queries.some((query) => query.isFetching && query.data !== undefined),
    staleError: backgroundError,
    error: initialError,
    retry: async () => {
      await Promise.all(queries.map((query) => query.refetch()));
    },
  };
}

export function useFarmActions() {
  const repository = useRepository();
  const queryClient = useQueryClient();

  const addIncubatorMutation = useMutation({
    mutationFn: async (unit: Incubator) => requireResultData(await repository.addIncubator(unit)),
    onSuccess: (created) => {
      queryClient.setQueryData<Incubator[]>(farmQueryKeys.incubators, (current = []) => [
        ...current,
        created,
      ]);
    },
  });
  const updateIncubatorMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Incubator> }) =>
      requireResultData(await repository.updateIncubator(id, patch)),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: farmQueryKeys.incubators });
      const previous = queryClient
        .getQueryData<Incubator[]>(farmQueryKeys.incubators)
        ?.find((unit) => unit.id === id);
      queryClient.setQueryData<Incubator[]>(farmQueryKeys.incubators, (current = []) =>
        current.map((unit) => unit.id === id ? { ...unit, ...patch, id } : unit));
      return { previous };
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Incubator[]>(farmQueryKeys.incubators, (current = []) =>
        current.map((unit) => unit.id === updated.id ? updated : unit));
      void queryClient.invalidateQueries({ queryKey: farmQueryKeys.readingsFor(updated.id) });
    },
    onError: (_error, { id }, context) => {
      if (!context?.previous) return;
      queryClient.setQueryData<Incubator[]>(farmQueryKeys.incubators, (current = []) =>
        current.map((unit) => unit.id === id ? context.previous! : unit));
    },
  });
  const addModeMutation = useMutation({
    mutationFn: async (mode: Mode) => requireResultData(await repository.addMode(mode)),
    onSuccess: (created) => {
      queryClient.setQueryData<Mode[]>(farmQueryKeys.modes, (current = []) => [...current, created]);
    },
  });
  const updateModeMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Mode> }) =>
      requireResultData(await repository.updateMode(id, patch)),
    onSuccess: (updated) => {
      queryClient.setQueryData<Mode[]>(farmQueryKeys.modes, (current = []) =>
        current.map((mode) => mode.id === updated.id ? updated : mode));
      void queryClient.invalidateQueries({ queryKey: farmQueryKeys.incubators });
      void queryClient.invalidateQueries({ queryKey: farmQueryKeys.readings });
    },
  });
  const deleteModeMutation = useMutation({
    mutationFn: async (id: string) => requireResultData(await repository.deleteMode(id)),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<Mode[]>(farmQueryKeys.modes, (current = []) =>
        current.filter((mode) => mode.id !== id));
    },
  });
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (id: string) => requireResultData(await repository.acknowledgeAlert(id)),
    onSuccess: (updated) => {
      queryClient.setQueryData<AlertEntry[]>(farmQueryKeys.alerts, (current = []) =>
        current.map((alert) => alert.id === updated.id ? updated : alert));
    },
  });
  const dismissAlertMutation = useMutation({
    mutationFn: async (id: string) => requireResultData(await repository.dismissAlert(id)),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<AlertEntry[]>(farmQueryKeys.alerts, (current = []) =>
        current.filter((alert) => alert.id !== id));
    },
  });
  const markAllAlertsReadMutation = useMutation({
    mutationFn: async () => requireResultData(await repository.markAllAlertsRead()),
    onSuccess: (alerts) => queryClient.setQueryData(farmQueryKeys.alerts, alerts),
  });
  const clearReadAlertsMutation = useMutation({
    mutationFn: async () => requireResultData(await repository.clearReadAlerts()),
    onSuccess: (alerts) => queryClient.setQueryData(farmQueryKeys.alerts, alerts),
  });
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: SettingsPreferences) =>
      requireResultData(await repository.saveSettings(settings)),
    onSuccess: (settings) => queryClient.setQueryData(farmQueryKeys.settings, settings),
  });

  async function addIncubator(unit: Incubator): Promise<boolean> {
    return runMutation(() => addIncubatorMutation.mutateAsync(unit), {
      retry: () => void addIncubator(unit),
    });
  }
  async function updateIncubator(id: string, patch: Partial<Incubator>): Promise<boolean> {
    return runMutation(() => updateIncubatorMutation.mutateAsync({ id, patch }), {
      retry: () => void updateIncubator(id, patch),
      rolledBack: true,
    });
  }
  async function addMode(mode: Mode): Promise<boolean> {
    return runMutation(() => addModeMutation.mutateAsync(mode), {
      retry: () => void addMode(mode),
    });
  }
  async function updateMode(id: string, patch: Partial<Mode>): Promise<boolean> {
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
  async function saveSettings(settings: SettingsPreferences): Promise<boolean> {
    return runMutation(() => saveSettingsMutation.mutateAsync(settings), {
      retry: () => void saveSettings(settings),
    });
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
        ? updateIncubatorMutation.variables?.id ?? null
        : null,
      pendingAlertId: acknowledgeAlertMutation.isPending
        ? acknowledgeAlertMutation.variables ?? null
        : dismissAlertMutation.isPending
          ? dismissAlertMutation.variables ?? null
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
      queryClient.setQueryData<HatchRecord[]>(farmQueryKeys.hatchRecords, (current = []) => [
        ...current,
        record,
      ]);
      queryClient.setQueryData<Incubator[]>(farmQueryKeys.incubators, (current = []) =>
        current.map((unit) => unit.id === incubator.id ? incubator : unit));
      void queryClient.invalidateQueries({ queryKey: farmQueryKeys.readingsFor(incubator.id) });
    },
  });
  const stopCycleMutation = useMutation({
    mutationFn: async (input: StopCycleInput) =>
      requireResultData(await repository.stopCycle(input)),
    onSuccess: ({ incubator }) => {
      queryClient.setQueryData<Incubator[]>(farmQueryKeys.incubators, (current = []) =>
        current.map((unit) => unit.id === incubator.id ? incubator : unit));
      void queryClient.invalidateQueries({ queryKey: farmQueryKeys.abortedCycles });
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
