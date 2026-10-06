import type { FeatureQueryState } from "../features/farm/query-state";
import { Button } from "./ui/button";

export function FeatureDataStatus({
  label,
  state,
}: {
  label: string;
  state: FeatureQueryState;
}) {
  if (!state.error) {
    return state.isLoading && !state.hasData ? (
      <p role="status" className="py-3 text-sm text-[var(--text-secondary)]">
        Loading {label.toLowerCase()}…
      </p>
    ) : null;
  }
  return (
    <div
      role="status"
      className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--status-warning-fg)] bg-[var(--status-warning-bg)] p-3 text-[var(--status-warning-fg)]"
    >
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">
          {label}{" "}
          {state.hasData ? "may be out of date." : "could not be loaded."}
        </p>
        <p>
          {state.hasData
            ? "Showing previously loaded data."
            : "Check your connection and try again."}
        </p>
        {state.hasData && state.updatedAt > 0 && (
          <p>Last updated: {new Date(state.updatedAt).toLocaleString()}</p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={state.isFetching}
        aria-label={`Retry ${label.toLowerCase()}`}
        onClick={() => void state.retry()}
      >
        <span>Retry</span>
      </Button>
    </div>
  );
}
