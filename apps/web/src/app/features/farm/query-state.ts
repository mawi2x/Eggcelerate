import type { UseQueryResult } from "@tanstack/react-query";

export type FeatureQueryState = {
  hasData: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  updatedAt: number;
  retry: () => Promise<unknown>;
};

export function featureQueryState<T>(
  query: UseQueryResult<T>,
  enabled: boolean,
): FeatureQueryState {
  return {
    hasData: query.data !== undefined,
    isLoading: enabled && query.isPending && !query.error,
    isFetching: query.isFetching,
    error: query.error,
    updatedAt: query.dataUpdatedAt,
    retry: () => (enabled ? query.refetch() : Promise.resolve()),
  };
}
