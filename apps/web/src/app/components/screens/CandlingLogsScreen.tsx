import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Search,
} from "lucide-react";
import { ExclamationIcon } from "../icons";
import { Button } from "../ui/button";
import { FilterBar } from "../ui/filter-bar";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { PaginationBar } from "../ui/pagination-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ViewToggle, ViewMode } from "../ViewToggle";
import {
  CandlingCheckpoint,
  CandlingLogEntry,
  Incubator,
  Mode,
  computeCandling,
} from "../../data/mockData";

const RUST = "var(--brand-primary)";
const TEXT = "var(--text-primary)";
const MUTED = "var(--text-secondary)";
const BORDER = "var(--border-default)";
const CARD_BORDER = "var(--border-subtle)";
const SURFACE = "var(--surface-card)";
const SUBTLE = "var(--surface-subtle)";
const TILE = "#F2EEE5";
const SHADOW = "0 2px 12px rgba(0,0,0,0.04)";

export type InspectionStatus = "overdue" | "due" | "upcoming" | "complete" | "not-started" | "ended";

export interface CandlingSummary {
  unit: Incubator;
  mode: Mode;
  checkpoints: CandlingCheckpoint[];
  completedCheckpoints: number;
  nextCheckpoint: CandlingCheckpoint | null;
  latestLog: CandlingLogEntry | null;
  status: InspectionStatus;
}

const statusMeta: Record<InspectionStatus, {
  label: string;
  description: string;
  fg: string;
  bg: string;
  Icon: React.ComponentType<{ size?: number | string; color?: string; className?: string }>;
}> = {
  overdue: {
    label: "Overdue",
    description: "Needs an inspection",
    fg: "var(--status-warning-fg)",
    bg: "var(--status-warning-bg)",
    Icon: ExclamationIcon,
  },
  due: {
    label: "Due today",
    description: "Ready to inspect",
    fg: "var(--status-warning-fg)",
    bg: "var(--status-warning-bg)",
    Icon: Clock3,
  },
  upcoming: {
    label: "Upcoming",
    description: "Scheduled later",
    fg: "var(--status-info-fg)",
    bg: "var(--status-info-bg)",
    Icon: BellRing,
  },
  complete: {
    label: "Complete",
    description: "All checkpoints logged",
    fg: "var(--status-success-fg)",
    bg: "var(--status-success-bg)",
    Icon: CheckCircle2,
  },
  "not-started": {
    label: "Not started",
    description: "Waiting for Day 1",
    fg: "var(--status-info-fg)",
    bg: "var(--status-info-bg)",
    Icon: CalendarClock,
  },
  ended: {
    label: "Cycle ended",
    description: "No further checks scheduled",
    fg: "var(--status-info-fg)",
    bg: "var(--status-info-bg)",
    Icon: CheckCircle2,
  },
};

type RowFilter = "all" | "action" | "upcoming" | "complete";
type SortKey = "attention" | "name" | "recent";

function latestLogFor(unit: Incubator): CandlingLogEntry | null {
  return [...unit.candlingLog]
    .sort((a, b) => b.day - a.day || b.date.localeCompare(a.date))[0] ?? null;
}

/** Derives the global inspection status from the mode checkpoints and unit progress. */
export function getCandlingSummary(unit: Incubator, mode: Mode): CandlingSummary {
  const checkpoints = computeCandling(mode.incubationDays);
  const completedDays = new Set<number>([
    ...Object.entries(unit.candled ?? {})
      .filter(([, completed]) => completed)
      .map(([day]) => Number(day)),
    ...unit.candlingLog.map((entry) => entry.day),
  ]);
  const completedCheckpoints = checkpoints.filter(({ day }) => completedDays.has(day)).length;
  const nextCheckpoint = checkpoints.find(({ day }) => !completedDays.has(day)) ?? null;

  let status: InspectionStatus;
  if (unit.cyclePhase === "stopped_early") {
    status = "ended";
  } else if (!nextCheckpoint) {
    status = "complete";
  } else if (unit.cyclePhase === "ready" || unit.dayOfIncubation <= 0) {
    status = "not-started";
  } else if (unit.dayOfIncubation > nextCheckpoint.day) {
    status = "overdue";
  } else if (unit.dayOfIncubation === nextCheckpoint.day) {
    status = "due";
  } else {
    status = "upcoming";
  }

  return {
    unit,
    mode,
    checkpoints,
    completedCheckpoints,
    nextCheckpoint,
    latestLog: latestLogFor(unit),
    status,
  };
}

function formatLogDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function StatusTag({ status }: { status: InspectionStatus }) {
  const meta = statusMeta[status];
  const Icon = meta.Icon;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ backgroundColor: meta.bg, color: meta.fg, fontSize: 12, fontWeight: 700 }}
    >
      <Icon size={14} color={meta.fg} aria-hidden="true" />
      {meta.label}
    </span>
  );
}


function JournalCard({ row, onOpen }: { row: CandlingSummary; onOpen: (id: string) => void }) {
  const latestNote = row.latestLog?.note.trim() || "No note recorded for this inspection.";

  return (
    <article
      className="group flex min-w-0 flex-col rounded-2xl border bg-[var(--surface-subtle)] p-5 transition-colors duration-200 hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)]"
      style={{ borderColor: BORDER, boxShadow: SHADOW }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="truncate"
            style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)", fontWeight: "var(--weight-semibold)", lineHeight: "var(--leading-snug)", color: TEXT }}
            title={row.unit.name}
          >
            {row.unit.name}
          </h3>
          <p className="mt-0.5 truncate" style={{ color: MUTED, fontSize: "var(--type-body-sm)", lineHeight: "var(--leading-normal)" }} title={row.mode.name}>
            {row.mode.name}
          </p>
        </div>
        <StatusTag status={row.status} />
      </div>

      <div
        className="mt-4 rounded-2xl border p-3.5"
        style={{
          backgroundColor: TILE,
          borderColor: BORDER,
          backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(232,226,213,0.85) 28px)",
        }}
      >
        <div>
          <p style={{ color: TEXT, fontSize: "var(--type-label)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase" }}>
            Latest journal entry
          </p>
          <p className="mt-1 truncate" style={{ color: MUTED, fontSize: "var(--type-caption)" }} title={row.latestLog?.label ?? undefined}>
            {row.latestLog ? `${formatLogDate(row.latestLog.date)} · ${row.latestLog.label}` : "No inspection recorded yet"}
          </p>
        </div>
        <p className="mt-3 line-clamp-2" style={{ color: MUTED, fontSize: "var(--type-body-sm)", lineHeight: "var(--leading-relaxed)" }}>
          {latestNote}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span style={{ color: MUTED, fontSize: "var(--type-caption)", fontWeight: "var(--weight-semibold)" }}>
          {row.completedCheckpoints} of {row.checkpoints.length} checkpoints
        </span>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl transition-colors hover:bg-[#FFF5F2]"
          onClick={() => onOpen(row.unit.id)}
          aria-label={`Open candling log for ${row.unit.name}`}
          style={{ backgroundColor: "transparent", borderColor: RUST, color: RUST, height: 36, fontSize: "var(--type-body-sm)", fontWeight: "var(--weight-medium)" }}
        >
          Open log <ArrowRight size={15} aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}

export function CandlingLogsScreen({
  units,
  modes,
  onOpenCandling,
}: {
  units: Incubator[];
  modes: Mode[];
  onOpenCandling: (id: string) => void;
}) {
  const [filter, setFilter] = useState<RowFilter>("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("attention");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [filter, modeFilter, search, sort]);

  const summaries = useMemo(
    () => units.map((unit) => {
      const mode = modes.find((candidate) => candidate.id === unit.modeId) ?? modes[0];
      return getCandlingSummary(unit, mode);
    }),
    [modes, units],
  );

  const counts = useMemo(() => ({
    action: summaries.filter((row) => row.status === "overdue" || row.status === "due").length,
    due: summaries.filter((row) => row.status === "due").length,

    upcoming: summaries.filter((row) => row.status === "upcoming").length,
    complete: summaries.filter((row) => row.status === "complete").length,
  }), [summaries]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = summaries.filter((row) => {
      const matchesFilter = filter === "all"
        || (filter === "action" && (row.status === "overdue" || row.status === "due"))
        || (filter === "upcoming" && row.status === "upcoming")
        || (filter === "complete" && row.status === "complete");
      const matchesMode = modeFilter === "all" || row.mode.id === modeFilter;
      const matchesSearch = !query
        || row.unit.name.toLowerCase().includes(query)
        || row.unit.deviceId.toLowerCase().includes(query)
        || row.mode.name.toLowerCase().includes(query);
      return matchesFilter && matchesMode && matchesSearch;
    });

    const statusRank: Record<InspectionStatus, number> = {
      overdue: 0,
      due: 1,
      upcoming: 2,
      "not-started": 3,
      complete: 4,
      ended: 5,
    };

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.unit.name.localeCompare(b.unit.name);
      if (sort === "recent") {
        const aDate = a.latestLog ? new Date(a.latestLog.date).getTime() : 0;
        const bDate = b.latestLog ? new Date(b.latestLog.date).getTime() : 0;
        return bDate - aDate || a.unit.name.localeCompare(b.unit.name);
      }
      return statusRank[a.status] - statusRank[b.status]
        || (a.nextCheckpoint?.day ?? Number.POSITIVE_INFINITY) - (b.nextCheckpoint?.day ?? Number.POSITIVE_INFINITY)
        || a.unit.name.localeCompare(b.unit.name);
    });
  }, [filter, modeFilter, search, sort, summaries]);

  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  return (
    <div className="space-y-5">

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: MUTED }}
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search incubators..."
            aria-label="Search candling logs"
            className="rounded-xl pl-9"
            style={{ backgroundColor: TILE, borderColor: BORDER, color: TEXT }}
          />
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: 20 }}>
        <FilterBar
          ariaLabel="Candling log filter"
          value={filter}
          onChange={(key) => setFilter(key as RowFilter)}
          options={[
            { key: "all", label: "All", count: summaries.length },
            { key: "action", label: "Needs action", count: counts.action },
            { key: "upcoming", label: "Upcoming", count: counts.upcoming },
            { key: "complete", label: "Complete", count: counts.complete },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger
              className="w-auto min-w-[140px] rounded-xl"
              style={{ height: 38, backgroundColor: SURFACE, borderColor: CARD_BORDER, color: TEXT, fontSize: 13, fontWeight: 500 }}
              aria-label="Filter by incubation mode"
            >
              <SelectValue placeholder="All modes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modes</SelectItem>
              {modes.map((mode) => <SelectItem key={mode.id} value={mode.id}>{mode.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger
              className="w-auto min-w-[140px] rounded-xl"
              style={{ height: 38, backgroundColor: SURFACE, borderColor: CARD_BORDER, color: TEXT, fontSize: 13, fontWeight: 500 }}
              aria-label="Sort candling logs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="attention">Sort: Attention</SelectItem>
              <SelectItem value="recent">Sort: Recent</SelectItem>
              <SelectItem value="name">Sort: Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <section aria-label="Candling journal list">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-5 py-12 text-center" style={{ backgroundColor: SUBTLE, borderColor: BORDER }}>
            <p style={{ color: TEXT, fontWeight: "var(--weight-bold)" }}>No candling logs match these filters</p>
            <p className="mt-1" style={{ color: MUTED, fontSize: "var(--type-body-sm)" }}>Try a different chamber, mode, or status.</p>
            {(search || filter !== "all" || modeFilter !== "all") && (
              <Button
                type="button"
                variant="outline"
                className="mt-4 rounded-xl"
                onClick={() => { setSearch(""); setFilter("all"); setModeFilter("all"); }}
                style={{ borderColor: BORDER, color: RUST, backgroundColor: SURFACE }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => <JournalCard key={row.unit.id} row={row} onOpen={onOpenCandling} />)}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: SUBTLE, borderColor: BORDER, border: `1px solid ${BORDER}` }}>
            <PaginationBar
              className="border-b border-t-0"
              page={safePage}
              pageSize={rowsPerPage}
              totalItems={rows.length}
              itemLabel="chambers"
              pageSizeOptions={[10, 20, 50]}
              onPageSizeChange={(value) => {
                setRowsPerPage(value);
                setPage(1);
              }}
              onPageChange={setPage}
            />

            <div className="h-[560px] overflow-auto">
              <Table>
                <TableCaption className="sr-only">Candling inspection status by incubator chamber</TableCaption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky top-0 z-10" style={{ backgroundColor: SUBTLE, borderBottom: `1px solid ${BORDER}`, color: "var(--text-muted)", fontSize: "var(--type-label)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase" }}>CHAMBER</TableHead>
                    <TableHead className="sticky top-0 z-10" style={{ backgroundColor: SUBTLE, borderBottom: `1px solid ${BORDER}`, color: "var(--text-muted)", fontSize: "var(--type-label)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase" }}>NEXT CHECK</TableHead>
                    <TableHead className="sticky top-0 z-10" style={{ backgroundColor: SUBTLE, borderBottom: `1px solid ${BORDER}`, color: "var(--text-muted)", fontSize: "var(--type-label)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase" }}>LAST LOGGED</TableHead>
                    <TableHead className="sticky top-0 z-10" style={{ backgroundColor: SUBTLE, borderBottom: `1px solid ${BORDER}`, color: "var(--text-muted)", fontSize: "var(--type-label)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase" }}>STATUS</TableHead>
                    <TableHead className="sticky top-0 z-10 text-right" style={{ backgroundColor: SUBTLE, borderBottom: `1px solid ${BORDER}`, color: "var(--text-muted)", fontSize: "var(--type-label)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase" }}>ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row) => {
                    const meta = statusMeta[row.status];
                    return (
                      <TableRow key={row.unit.id} className="hover:bg-[var(--nav-hover-bg)]">
                        <TableCell style={{ color: TEXT, whiteSpace: "normal" }}>
                          <div className="min-w-[190px]">
                            <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)", fontWeight: "var(--weight-bold)" }}>
                              {row.unit.name}
                            </p>
                            <p className="mt-0.5" style={{ color: MUTED, fontSize: "var(--type-caption)" }}>
                              {row.mode.name}
                            </p>
                            <p className="mt-1" style={{ color: MUTED, fontSize: "var(--type-caption)" }}>
                              {row.unit.candlingLog.length} {row.unit.candlingLog.length === 1 ? "inspection" : "inspections"} logged
                            </p>
                          </div>
                        </TableCell>

                        <TableCell style={{ whiteSpace: "normal" }}>
                          <div className="min-w-[155px]">
                            <p style={{ color: TEXT, fontSize: "var(--type-body-sm)", fontWeight: "var(--weight-semibold)" }}>
                              {row.nextCheckpoint?.label ?? (row.status === "ended" ? "Cycle ended" : "All checkpoints logged")}
                            </p>
                            <p className="mt-0.5" style={{ color: row.status === "overdue" ? meta.fg : MUTED, fontSize: "var(--type-caption)", fontWeight: row.status === "overdue" ? "var(--weight-bold)" : "var(--weight-regular)" }}>
                              {row.nextCheckpoint ? `Day ${row.nextCheckpoint.day} · ${row.nextCheckpoint.dayRange}` : meta.description}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell style={{ whiteSpace: "normal" }}>
                          <div className="min-w-[155px]">
                            <p style={{ color: TEXT, fontSize: "var(--type-body-sm)", fontWeight: "var(--weight-semibold)" }}>
                              {row.latestLog ? formatLogDate(row.latestLog.date) : "No inspection yet"}
                            </p>
                            <p className="mt-0.5" style={{ color: MUTED, fontSize: "var(--type-caption)" }}>
                              {row.latestLog?.label ?? "Start with the first checkpoint"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell><StatusTag status={row.status} /></TableCell>

                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => onOpenCandling(row.unit.id)}
                            aria-label={`Open candling log for ${row.unit.name}`}
                            style={{ borderColor: BORDER, color: RUST, backgroundColor: SURFACE }}
                          >
                            Open log <ArrowRight size={15} aria-hidden="true" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
