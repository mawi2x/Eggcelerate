import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { normalizeBaseUrl } from "../../data/repositories/api-repository";
import { appAuthApiBaseUrl } from "../../data/repositories/app-repository";
import {
  getCsrfToken,
  notifySessionExpired,
} from "../../data/transport/session";
import type { Incubator } from "../../domain/types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Typography } from "../ui/typography";

function ConnectedDeleteIncubator({
  unit,
  onDeleted,
}: {
  unit: Incubator;
  onDeleted: () => void;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!appAuthApiBaseUrl) return null;
  const blocked =
    !!unit.preparationStartedAt ||
    ["incubating", "lockdown", "hatching", "awaiting_finish"].includes(
      unit.cyclePhase,
    );
  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${normalizeBaseUrl(appAuthApiBaseUrl ?? "")}/api/v1/incubators/${encodeURIComponent(unit.id)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": getCsrfToken() ?? "",
          },
          body: JSON.stringify({ confirmation, force }),
        },
      );
      if (response.status === 401) notifySessionExpired();
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok)
        throw new Error(
          body?.error?.message ??
            "Deletion could not be confirmed. Refresh the incubator list before retrying.",
        );
      setOpen(false);
      onDeleted();
      await client.invalidateQueries();
      toast.success("Incubator deleted");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to delete incubator.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="space-y-2 border-t pt-4"
      style={{ borderColor: "var(--border-default)" }}
    >
      <Typography variant="headingSmall" as="h3">
        Delete incubator
      </Typography>
      <Typography variant="body" className="text-[var(--text-secondary)]">
        Permanently remove this incubator and its cycle history, candling logs,
        readings and notifications. You can pair the hardware again later.
      </Typography>
      {blocked && (
        <Typography variant="body">
          Stop the cycle or cancel preparation first, then confirm equipment is
          off in Live Monitor. Force deletion is available in the confirmation
          dialog.
        </Typography>
      )}
      <Button
        variant="destructive"
        className="rounded-full text-(length:--type-button-label)"
        onClick={() => {
          setConfirmation("");
          setForce(false);
          setError("");
          setOpen(true);
        }}
      >
        Delete incubator
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontSize: "var(--type-heading-md)" }}>
              Delete {unit.name}?
            </AlertDialogTitle>
            <AlertDialogDescription style={{ fontSize: "var(--type-body)" }}>
              This permanently deletes the incubator and its cycle history,
              candling logs, readings and notifications. This cannot be undone.
              Confirm all equipment is off before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="delete-incubator-name"
              className="block text-(length:--type-body)"
            >
              Type {unit.name} to confirm
            </label>
            <Input
              id="delete-incubator-name"
              value={confirmation}
              disabled={busy}
              autoComplete="off"
              onChange={(event) => setConfirmation(event.target.value)}
            />
            <label className="flex min-h-11 items-start gap-3 text-(length:--type-body)">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0"
                checked={force}
                disabled={busy}
                onChange={(event) => setForce(event.target.checked)}
              />
              <span>
                Force deletion: bypass cycle and equipment checks. This does not
                stop the physical equipment, which may keep running. Switch off
                its power before deleting.
              </span>
            </label>
            {error && (
              <Typography
                role="alert"
                variant="body"
                className="text-[var(--status-danger-fg)]"
              >
                {error}
              </Typography>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-full text-(length:--type-button-label)"
              disabled={busy}
            >
              Keep incubator
            </AlertDialogCancel>
            <Button
              variant="destructive"
              className="rounded-full text-(length:--type-button-label)"
              disabled={
                busy || confirmation !== unit.name || (blocked && !force)
              }
              onClick={() => void remove()}
              aria-busy={busy}
            >
              {busy
                ? "Deleting…"
                : force
                  ? "Force delete permanently"
                  : "Delete permanently"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function DeleteIncubator(props: {
  unit: Incubator;
  onDeleted: () => void;
}) {
  return appAuthApiBaseUrl ? <ConnectedDeleteIncubator {...props} /> : null;
}
