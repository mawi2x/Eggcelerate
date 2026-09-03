import { useSyncExternalStore } from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "./ui/button";
import { repositoryErrorMessage } from "../features/farm/repository-query";

function subscribeToConnectivity(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function useBrowserOnline() {
  return useSyncExternalStore(
    subscribeToConnectivity,
    () => navigator.onLine,
    () => true,
  );
}

export function FarmDataStatus({
  isRefreshing,
  staleError,
  onRetry,
}: {
  isRefreshing: boolean;
  staleError: unknown;
  onRetry: () => void;
}) {
  const isOnline = useBrowserOnline();

  if (!isOnline) {
    return (
      <div
        className="mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5"
        style={{
          borderColor: "var(--status-warning-fg)",
          backgroundColor: "var(--status-warning-bg)",
          color: "var(--status-warning-fg)",
        }}
        role="status"
        aria-live="polite"
      >
        <WifiOff size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-sm">
          <strong>Offline.</strong> Showing the last loaded farm data. Changes may not be confirmed until you reconnect.
        </p>
      </div>
    );
  }

  if (staleError) {
    return (
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
        style={{
          borderColor: "var(--status-warning-fg)",
          backgroundColor: "var(--status-warning-bg)",
          color: "var(--status-warning-fg)",
        }}
        role="alert"
      >
        <div className="flex min-w-0 items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 text-sm">
            <strong>Data may be stale.</strong> {repositoryErrorMessage(staleError)}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (!isRefreshing) return null;

  return (
    <div className="mb-3 flex items-center gap-2 text-sm text-[var(--text-secondary)]" role="status">
      <RefreshCw size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      Refreshing farm data…
    </div>
  );
}
