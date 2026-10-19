import { z } from "zod";
import { appAuthApiBaseUrl } from "../../data/repositories/app-repository";
import { benchmarkModes, benchmarkRequest, benchmarkStatus, runSchema, type BenchmarkRun } from "../../features/benchmarks/use-benchmarks";
import { BenchmarkRunReadings } from "./BenchmarkHistory";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { useInfiniteQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { IncubationRun, Incubator, Mode } from "../../domain/types";
import { requireResultData } from "../../features/farm/repository-query";
import { useRepository } from "../../providers/repository-context";
import { Button } from "../ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "../ui/alert-dialog";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CONTROL_FONT, toolbarInputStyle } from "./presentation";

export const RUN_STATUS: Record<IncubationRun["status"], string> = {
  preparing: "Preparing", incubating: "Incubating", completed: "Completed", stopped: "Stopped", cancelled: "Preparation only",
};

const RUN_STATUS_TOKENS = {
  success: { backgroundColor: "var(--status-success-bg)", color: "var(--status-success-fg)" },
  warning: { backgroundColor: "var(--status-warning-bg)", color: "var(--status-warning-fg)" },
  info: { backgroundColor: "var(--status-info-bg)", color: "var(--status-info-fg)" },
} as const;

export function useRunHistory() {
  const repository = useRepository();
  const [chamber, setChamber] = useState("all");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState("all");
  const available = !!repository.listIncubationRuns;
  const benchmarkOnlyFilter = mode.startsWith("benchmark:") || (status !== "all" && !(status in RUN_STATUS));
  const query = useInfiniteQuery({
    queryKey: ["farm", "run-history", chamber, mode, status],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => repository.listIncubationRuns ? requireResultData(await repository.listIncubationRuns({
      before: pageParam, incubatorId: chamber === "all" ? undefined : chamber, modeId: mode === "all" ? undefined : mode, status: status === "all" ? undefined : status,
    })) : { runs: [], hasMore: false, nextCursor: null },
    getNextPageParam: (last) => last.hasMore ? last.nextCursor ?? undefined : undefined,
    enabled: available && !benchmarkOnlyFilter,
    refetchInterval: 30_000,
  });
  const runs = Array.from(new Map((query.data?.pages.flatMap((p) => p.runs) ?? []).map((r) => [r.id, r])).values());
  return { query, runs, benchmarkOnlyFilter, chamber, setChamber, mode, setMode, status, setStatus, available };
}

export function IncubationRunHistory({ model, units, modes, onView }: {
  model: ReturnType<typeof useRunHistory>;
  units: Incubator[];
  modes: Mode[];
  onView: (run: IncubationRun) => void;
}) {
  const { query, available } = model;
  const runs = model.benchmarkOnlyFilter ? [] : model.runs;
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkRun | null>(null);
  const benchmarkQueries = useQueries({ queries: units.map((unit) => ({
    queryKey: ["benchmarks", unit.id],
    queryFn: async () => z.object({ runs: z.array(runSchema) }).parse(await benchmarkRequest(unit.id)).runs,
    enabled: !!appAuthApiBaseUrl,
    refetchInterval: 10000,
    retry: 1,
  })) });
  const benchmarkRuns = Array.from(new Map(benchmarkQueries.flatMap((q) => q.data ?? []).map((run) => [run.id, run])).values());
  const benchmarkFilterStatus = (run: BenchmarkRun) => run.status === "cancelled" ? "stopped" : run.status;
  const filteredBenchmarks = benchmarkRuns.filter((run) =>
    (model.chamber === "all" || run.incubator_id === model.chamber) &&
    (model.mode === "all" || model.mode === `benchmark:${run.kind}`) &&
    (model.status === "all" || model.status === benchmarkFilterStatus(run)));
  const entries = [
    ...runs.map((run) => ({ type: "incubation" as const, run, started: run.startedAt })),
    ...filteredBenchmarks.map((run) => ({ type: "benchmark" as const, run, started: run.started_at })),
  ].sort((a, b) => new Date(b.started).getTime() - new Date(a.started).getTime());
  const loading = (!model.benchmarkOnlyFilter && query.isPending) || (!!appAuthApiBaseUrl && benchmarkQueries.some((q) => q.isPending));
  const benchmarkErrors = benchmarkQueries.filter((q) => q.isError);
  const extraStatuses = Array.from(new Set(benchmarkRuns.map(benchmarkFilterStatus))).filter((status) => !(status in RUN_STATUS));
  const repository = useRepository();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<IncubationRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const removeHistory = async () => {
    if (!deleting || busy || !repository.deleteIncubationRun) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const result = await repository.deleteIncubationRun(deleting.id);
      if (!result.ok) { setDeleteError(result.error.message); return; }
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["farm", "run-history"] });
    } catch {
      setDeleteError("History entry could not be deleted. Try again.");
    } finally { setBusy(false); }
  };
  const chambers = new Map([...units.map((u) => [u.id, u.name] as const), ...runs.map((r) => [r.incubatorId, units.find((u) => u.id === r.incubatorId)?.name ?? r.chamberName] as const), ...benchmarkRuns.map((r) => [r.incubator_id, units.find((u) => u.id === r.incubator_id)?.name ?? r.chamber_name] as const)]);
  const species = new Map([...modes.map((m) => [m.id, m.name] as const), ...runs.map((r) => [r.mode.id, r.mode.name] as const), ...benchmarkModes.map((mode) => [`benchmark:${mode.id}`, mode.name] as const)]);
  if (!available) return <p className="text-(length:--type-body-sm) text-[var(--text-secondary)]">Run history is available when connected to the server.</p>;
  return (
    <section aria-label="Incubation history" className="space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3 md:gap-3 md:p-4">
        {[
          { id: "run-chamber", label: "Chamber", value: model.chamber, change: model.setChamber, options: [["all", "All chambers"], ...chambers] },
          { id: "run-mode", label: "Mode", value: model.mode, change: model.setMode, options: [["all", "All modes"], ...species] },
          { id: "run-status", label: "Status", value: model.status, change: model.setStatus, options: [["all", "All statuses"], ...Object.entries(RUN_STATUS), ...extraStatuses.map((status) => [status, benchmarkStatus(status)])] },
        ].map((filter) => (
          <div key={filter.id} className="min-w-0 space-y-1">
            <Label htmlFor={filter.id} style={{ ...CONTROL_FONT, fontSize: "var(--type-filter-label)" }}>{filter.label}</Label>
            <Select size="filter" value={filter.value} onValueChange={filter.change}>
              <SelectTrigger id={filter.id} size="filter" className="h-[var(--control-height-default)] w-full min-w-0 rounded-xl px-2 [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate md:h-[var(--control-height-toolbar)] md:px-3" aria-label={`${filter.label}: ${filter.options.find(([id]) => id === filter.value)?.[1] ?? filter.value}`} style={{ ...toolbarInputStyle, ...CONTROL_FONT, fontSize: "var(--type-filter-value)" }}><SelectValue /></SelectTrigger>
              <SelectContent>{filter.options.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {loading && <p role="status" className="text-(length:--type-body-sm)">Loading run history…</p>}
      {!model.benchmarkOnlyFilter && query.error && <div role="alert" className="flex flex-wrap items-center gap-3"><p>Run history could not be loaded.</p><Button size="sm" variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>}
      {!loading && !query.error && benchmarkErrors.length === 0 && entries.length === 0 && <p role="status" className="text-(length:--type-body-sm) text-[var(--text-secondary)]">No runs match these filters. Preparation will appear here when it begins.</p>}
      {benchmarkErrors.length > 0 && <div role="alert" className="flex flex-wrap items-center gap-3"><p>Some mode history could not be loaded.</p><Button size="sm" variant="outline" onClick={() => benchmarkErrors.forEach((q) => void q.refetch())}>Retry</Button></div>}
      <ul className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {entries.map((entry) => {
          if (entry.type === "benchmark") {
            const run = entry.run;
            const chamber = units.find((u) => u.id === run.incubator_id);
            const name = benchmarkModes.find((m) => m.id === run.kind)?.name ?? run.kind.toUpperCase();
            const statusTokens = RUN_STATUS_TOKENS[run.status === "completed" ? "success" : run.ended_at ? "info" : "warning"];
            return <li key={`benchmark:${run.id}`} className="flex min-w-0 flex-col rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="break-words text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)", fontWeight: "var(--weight-bold)" }}>{chamber?.name ?? run.chamber_name}</h2>
                  <span title={name} aria-label={name} className="rounded-full bg-[var(--brand-primary-soft)] px-2 py-0.5 text-(length:--type-caption) font-semibold text-[var(--brand-primary-hover)]">{run.kind.toUpperCase()}</span>
                </div>
                <span className="rounded-full px-2.5 py-1 text-(length:--type-caption) font-semibold" style={statusTokens}>{benchmarkStatus(run.status)}</span>
              </div>
              <p className="mt-1 text-(length:--type-caption) text-[var(--text-secondary)]"><time dateTime={run.started_at}>{new Date(run.started_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</time>{" to "}{run.ended_at ? <time dateTime={run.ended_at}>{new Date(run.ended_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</time> : "Present"}</p>
              <div className="mt-3 flex justify-end">
                <Button variant="outline" aria-label={`View readings for ${chamber?.name ?? run.chamber_name}, ${name}`} className="h-[var(--control-height-mobile)] max-h-[var(--control-height-mobile)] rounded-full py-0 shadow-sm transition-colors hover:bg-[var(--surface-action-hover)] md:h-[var(--control-height-default)] md:max-h-[var(--control-height-default)]" style={{ backgroundColor: "var(--surface-card)", color: "var(--brand-primary)", border: "var(--border-width-hairline) solid var(--border-ink)", fontFamily: "var(--font-body)", fontSize: "var(--type-button-label)", fontWeight: "var(--weight-bold)", lineHeight: "var(--leading-button)", paddingLeft: 12, paddingRight: 10 }} onClick={() => setSelectedBenchmark(run)}><span>View readings</span><ChevronRight aria-hidden="true" size={15} /></Button>
              </div>
            </li>;
          }
          const run = entry.run;
          const statusColor = run.status === "completed" ? "success" : run.status === "stopped" || run.status === "cancelled" ? "info" : "warning";
          const statusTokens = RUN_STATUS_TOKENS[statusColor];
          const chamber = units.find((u) => u.id === run.incubatorId);
          return (
            <li key={run.id} className="flex min-w-0 flex-col rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="break-words text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)", fontWeight: "var(--weight-bold)" }}>{chamber?.name ?? run.chamberName}</h2>
                  <span className="rounded-full bg-[var(--brand-primary-soft)] px-2 py-0.5 text-(length:--type-caption) font-semibold text-[var(--brand-primary-hover)]">{run.mode.name}</span>
                </div>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-(length:--type-caption) font-semibold" style={statusTokens}>{RUN_STATUS[run.status]}</span>
              </div>

              <p className="mt-1 text-(length:--type-caption) text-[var(--text-secondary)]">
                <time dateTime={run.startedAt}>{new Date(run.startedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</time>
                {" to "}
                {run.endedAt ? <time dateTime={run.endedAt}>{new Date(run.endedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</time> : "Present"}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                {run.endedAt && repository.deleteIncubationRun && (
                  <Button variant="ghost" className="mr-auto h-[var(--control-height-mobile)] rounded-full py-0 text-(length:--type-button-label) font-bold leading-[var(--leading-button)] text-[var(--status-danger-fg)] md:h-[var(--control-height-default)]" onClick={() => { setDeleting(run); setDeleteError(null); }}><span>Delete history</span></Button>
                )}
                <Button variant="outline" disabled={!chamber} aria-label={`View readings for ${chamber?.name ?? run.chamberName}, ${new Date(run.startedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}`} className="h-[var(--control-height-mobile)] max-h-[var(--control-height-mobile)] rounded-full py-0 shadow-sm transition-colors hover:bg-[var(--surface-action-hover)] md:h-[var(--control-height-default)] md:max-h-[var(--control-height-default)]" style={{ backgroundColor: "var(--surface-card)", color: "var(--brand-primary)", border: "var(--border-width-hairline) solid var(--border-ink)", fontFamily: "var(--font-body)", fontSize: "var(--type-button-label)", fontWeight: "var(--weight-bold)", lineHeight: "var(--leading-button)", paddingLeft: 12, paddingRight: 10 }} onClick={() => onView(run)}>
                  <span>{chamber ? "View readings" : "Chamber removed"}</span>
                  {chamber && <ChevronRight aria-hidden="true" size={15} />}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <Dialog open={!!selectedBenchmark} onOpenChange={(open) => { if (!open) setSelectedBenchmark(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>{selectedBenchmark ? benchmarkModes.find((m) => m.id === selectedBenchmark.kind)?.name : "Mode readings"}</DialogTitle><DialogDescription>{selectedBenchmark ? `${selectedBenchmark.chamber_name} — ${benchmarkStatus(selectedBenchmark.status)}` : ""}</DialogDescription></DialogHeader>
          {selectedBenchmark && <BenchmarkRunReadings run={benchmarkRuns.find((run) => run.id === selectedBenchmark.id) ?? selectedBenchmark} />}
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this history entry?</AlertDialogTitle>
            <AlertDialogDescription>Remove {deleting?.chamberName} ({deleting?.mode.name}) from incubation history. Sensor readings and hatch records will be kept. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className="text-(length:--type-body-sm) text-[var(--status-danger-fg)]">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className="h-[var(--control-height-mobile)] py-0 text-(length:--type-button-label) font-bold leading-[var(--leading-button)] md:h-[var(--control-height-default)]">Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void removeHistory()} className="h-[var(--control-height-mobile)] py-0 text-(length:--type-button-label) font-bold leading-[var(--leading-button)] md:h-[var(--control-height-default)]"><span>{busy ? "Deleting…" : "Delete history"}</span></Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {!model.benchmarkOnlyFilter && query.hasNextPage && <Button size="sm" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Load more runs"}</Button>}
    </section>
  );
}
