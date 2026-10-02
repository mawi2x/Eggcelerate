import { Warning, WifiSlash } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";
import { repositoryErrorMessage } from "../features/farm/repository-query";
import { Button } from "./ui/button";

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
  staleError,
  onRetry,
}: {
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
        <WifiSlash
          size={16}
          weight="fill"
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm">
          <strong>Offline.</strong> Showing the last loaded farm data. Changes
          may not be confirmed until you reconnect.
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
          <Warning
            size={16}
            weight="fill"
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <p className="min-w-0 text-sm">
            <strong>Data may be stale.</strong>{" "}
            {repositoryErrorMessage(staleError)}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return null;
}
