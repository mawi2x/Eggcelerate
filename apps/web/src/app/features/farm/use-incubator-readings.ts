import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import type { EggcelerateRepository, ReadingWindow } from "../../data/repositories/repository";
import type { Reading } from "../../domain/types";
import { useRepository } from "../../providers/repository-context";
import { farmQueryKeys } from "./query-keys";
import { requireResultData } from "./repository-query";

export function readingQueryOptions(
  repository: EggcelerateRepository,
  incubatorId: string,
  window: ReadingWindow,
) {
  return queryOptions({
    queryKey: farmQueryKeys.readingWindow(incubatorId, window),
    queryFn: async () => requireResultData(await repository.listReadings({ incubatorId, window })),
    staleTime: Infinity,
  });
}

export function useIncubatorReadings(
  incubatorId: string,
  window: ReadingWindow,
) {
  const repository = useRepository();
  const query = useQuery(readingQueryOptions(repository, incubatorId, window));
  return { ...query, readings: query.data ?? [] };
}

export function useIncubatorReadingMap(
  incubatorIds: readonly string[],
  window: ReadingWindow,
) {
  const repository = useRepository();
  const identity = incubatorIds.join("\u0000");
  const uniqueIds = Array.from(new Set(identity ? identity.split("\u0000") : []));

  return useQueries({
    queries: uniqueIds.map((incubatorId) => readingQueryOptions(repository, incubatorId, window)),
    combine: (results) => ({
      readingsByIncubator: Object.fromEntries(
        uniqueIds.map((incubatorId, index) => [incubatorId, results[index].data ?? []]),
      ) as Record<string, Reading[]>,
      isLoading: results.some((result) => result.isPending),
      error: results.find((result) => result.error)?.error ?? null,
      retry: async () => {
        await Promise.all(results.map((result) => result.refetch()));
      },
    }),
  });
}
