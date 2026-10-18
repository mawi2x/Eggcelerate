import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { IncubationRun, Incubator, Mode } from "../../domain/types";
import { requireResultData } from "../../features/farm/repository-query";
import { useRepository } from "../../providers/repository-context";
import { useTemperatureDisplay } from "../../providers/temperature-context";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CONTROL_FONT, toolbarInputStyle } from "./presentation";

export const RUN_STATUS: Record<IncubationRun["status"], string> = {
  preparing: "Preparing", incubating: "Incubating", completed: "Completed", stopped: "Stopped", cancelled: "Preparation only",
};

export function useRunHistory() {
  const repository = useRepository();
  const [chamber, setChamber] = useState("all");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState("all");
  const available = !!repository.listIncubationRuns;
  const query = useInfiniteQuery({
    queryKey: ["farm", "run-history", chamber, mode, status],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => repository.listIncubationRuns ? requireResultData(await repository.listIncubationRuns({
      before: pageParam, incubatorId: chamber === "all" ? undefined : chamber, modeId: mode === "all" ? undefined : mode, status: status === "all" ? undefined : status,
    })) : { runs: [], hasMore: false, nextCursor: null },
    getNextPageParam: (last) => last.hasMore ? last.nextCursor ?? undefined : undefined,
    enabled: available,
    refetchInterval: 30_000,
  });
  const runs = Array.from(new Map((query.data?.pages.flatMap((p) => p.runs) ?? []).map((r) => [r.id, r])).values());
  return { query, runs, chamber, setChamber, mode, setMode, status, setStatus, available };
}

export function IncubationRunHistory({ model, units, modes, onView }: {
  model: ReturnType<typeof useRunHistory>;
  units: Incubator[];
  modes: Mode[];
  onView: (run: IncubationRun) => void;
}) {
  const temperature = useTemperatureDisplay();
  const { query, runs, available } = model;
  const chambers = new Map([...units.map((u) => [u.id, u.name] as const), ...runs.map((r) => [r.incubatorId, units.find((u) => u.id === r.incubatorId)?.name ?? r.chamberName] as const)]);
  const species = new Map([...modes.map((m) => [m.id, m.name] as const), ...runs.map((r) => [r.mode.id, r.mode.name] as const)]);
  const formatTime = (at: string) => new Date(at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  if (!available) return <p className="text-(length:--type-body-sm) text-[var(--text-secondary)]">Run history is available when connected to the server.</p>;
  return (
    <section aria-label="Incubation history" className="space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 sm:grid-cols-3">
        {[
          { id: "run-chamber", label: "Chamber", value: model.chamber, change: model.setChamber, options: [["all", "All chambers"], ...chambers] },
          { id: "run-mode", label: "Mode", value: model.mode, change: model.setMode, options: [["all", "All modes"], ...species] },
          { id: "run-status", label: "Status", value: model.status, change: model.setStatus, options: [["all", "All statuses"], ...Object.entries(RUN_STATUS)] },
        ].map((filter) => (
          <div key={filter.id} className="min-w-0 space-y-1">
            <Label htmlFor={filter.id} style={CONTROL_FONT}>{filter.label}</Label>
            <Select size="toolbar" value={filter.value} onValueChange={filter.change}>
              <SelectTrigger id={filter.id} size="toolbar" className="h-[var(--control-height-filter-row)] w-full rounded-xl md:h-[var(--control-height-toolbar)]" style={{ ...toolbarInputStyle, ...CONTROL_FONT }}><SelectValue /></SelectTrigger>
              <SelectContent>{filter.options.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {query.isPending && <p role="status" className="text-(length:--type-body-sm)">Loading run history…</p>}
      {query.error && <div role="alert" className="flex flex-wrap items-center gap-3"><p>Run history could not be loaded.</p><Button size="sm" variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>}
      {!query.isPending && !query.error && runs.length === 0 && <p role="status" className="text-(length:--type-body-sm) text-[var(--text-secondary)]">No runs match these filters. Preparation will appear here when it begins.</p>}
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {runs.map((run) => {
          const statusColor = run.status === "completed" ? "success" : run.status === "stopped" || run.status === "cancelled" ? "info" : "warning";
          const chamber = units.find((u) => u.id === run.incubatorId);
          return (
            <li key={run.id} className="min-w-0 space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><h2 className="break-words" style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)", fontWeight: "var(--weight-bold)" }}>{chamber?.name ?? run.chamberName}</h2><p className="text-(length:--type-body-sm) font-semibold text-[var(--text-secondary)]">{run.mode.name}</p></div>
                <span className="rounded-full px-2.5 py-1 text-(length:--type-caption) font-semibold" style={{ backgroundColor: `var(--status-${statusColor}-bg)`, color: `var(--status-${statusColor}-fg)` }}>{RUN_STATUS[run.status]}</span>
              </div>
              <dl className="space-y-1 text-(length:--type-body-sm) text-[var(--text-secondary)]">
                <div className="flex flex-wrap justify-between gap-x-3"><dt>{run.preparedAt ? "Preparation began" : "Run began"}</dt><dd>{formatTime(run.startedAt)}</dd></div>
                {run.incubationAt && <div className="flex flex-wrap justify-between gap-x-3"><dt>Eggs loaded</dt><dd>{formatTime(run.incubationAt)}</dd></div>}
                <div className="flex flex-wrap justify-between gap-x-3"><dt>{run.endedAt ? "Ended" : "Progress"}</dt><dd>{run.endedAt ? formatTime(run.endedAt) : "Still running"}</dd></div>
                {run.totalEggs !== null && <div className="flex justify-between gap-3"><dt>Eggs set</dt><dd>{run.totalEggs}</dd></div>}
              </dl>
              <p className="text-pretty text-(length:--type-body-sm) text-[var(--text-secondary)]">Saved targets: {temperature.formatRange(run.mode.targetTemp)} and {run.mode.targetHumidity.min} to {run.mode.targetHumidity.max}% RH.</p>
              {run.endReason && <p className="text-(length:--type-caption) text-[var(--text-secondary)]">{run.endReason}</p>}
              {run.approximate && <p className="text-pretty text-(length:--type-caption) text-[var(--text-secondary)]">Earlier record. Times or saved targets may be approximate.</p>}
              <div className="flex justify-end"><Button size="sm" variant="outline" disabled={!chamber} className="rounded-xl border-[var(--brand-primary-soft)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-hover)] hover:bg-[var(--brand-primary-soft-hover)] hover:text-[var(--brand-primary-hover)]" onClick={() => onView(run)}>{chamber ? "View trends" : "Chamber removed"}</Button></div>
            </li>
          );
        })}
      </ul>
      {query.hasNextPage && <Button size="sm" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Load more runs"}</Button>}
    </section>
  );
}
