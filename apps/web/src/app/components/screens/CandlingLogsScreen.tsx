import {
  Bell,
  CalendarDots,
  CheckCircle,
  Clock,
  Notepad,
} from "@phosphor-icons/react";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  ArrowUpNarrowWide,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { computeCandling } from "../../domain/candling";
import type {
  CandlingCheckpoint,
  CandlingLogEntry,
  Incubator,
  Mode,
} from "../../domain/types";
import { ExclamationIcon } from "../icons";
import { StatusIconBadge, statusIconBadgeGlyphSize } from "../StatusIconBadge";
import { Button } from "../ui/button";
import { FilterBar } from "../ui/filter-bar";
import { Input } from "../ui/input";
import { PaginationBar } from "../ui/pagination-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { useIsMobile } from "../ui/use-mobile";
import { cn } from "../ui/utils";
import { type ViewMode, ViewToggle } from "../ViewToggle";

const RUST = "var(--brand-primary)";
const TEXT = "var(--text-primary)";
const MUTED = "var(--text-secondary)";
const BORDER = "var(--border-default)";
const CARD_BORDER = "var(--border-default)";
const SUBTLE = "var(--surface-subtle)";

const CANDLING_STATUS_COLORS: Record<string, string> = {
  overdue: "#DC2626",
  due: "#D97706",
  upcoming: "#2563EB",
  complete: "#16A34A",
  "not-started": "#8A6B52",
  ended: "#78716C",
};
const SURFACE = "var(--surface-card)";
const TILE = "#F2EEE5";
const INPUT_BORDER = "#D8D0C0";
const inputStyle = { borderColor: INPUT_BORDER, backgroundColor: "#F2EEE5" };

export type InspectionStatus =
  | "overdue"
  | "due"
  | "upcoming"
  | "complete"
  | "not-started"
  | "ended";

export interface CandlingSummary {
  unit: Incubator;
  mode: Mode;
  checkpoints: CandlingCheckpoint[];
  completedCheckpoints: number;
  nextCheckpoint: CandlingCheckpoint | null;
  latestLog: CandlingLogEntry | null;
  status: InspectionStatus;
}

const statusMeta: Record<
  InspectionStatus,
  {
    label: string;
    description: string;
    fg: string;
    bg: string;
    Icon: React.ComponentType<{
      size?: number | string;
      color?: string;
      className?: string;
    }>;
  }
> = {
  overdue: {
    label: "Overdue",
    description: "Needs an inspection",
    fg: "var(--status-warning-fg)",
    bg: "var(--status-warning-bg)",
    Icon: (props) => <ExclamationIcon {...props} />,
  },
  due: {
    label: "Due today",
    description: "Ready to inspect",
    fg: "var(--status-warning-fg)",
    bg: "var(--status-warning-bg)",
    Icon: (props) => <Clock {...props} weight="fill" />,
  },
  upcoming: {
    label: "Upcoming",
    description: "Scheduled later",
    fg: "var(--status-info-fg)",
    bg: "var(--status-info-bg)",
    Icon: (props) => <Bell {...props} weight="fill" />,
  },
  complete: {
    label: "Complete",
    description: "All checkpoints logged",
    fg: "var(--status-success-fg)",
    bg: "var(--status-success-bg)",
    Icon: (props) => <CheckCircle {...props} weight="fill" />,
  },
  "not-started": {
    label: "Not started",
    description: "Waiting for Day 1",
    fg: "var(--status-info-fg)",
    bg: "var(--status-info-bg)",
    Icon: (props) => <CalendarDots {...props} weight="fill" />,
  },
  ended: {
    label: "Cycle ended",
    description: "No further checks scheduled",
    fg: "var(--status-info-fg)",
    bg: "var(--status-info-bg)",
    Icon: (props) => <CheckCircle {...props} weight="fill" />,
  },
};

type RowFilter = "all" | "action" | "upcoming" | "complete";
type SortKey = "attention" | "name" | "recent";

function latestLogFor(unit: Incubator): CandlingLogEntry | null {
  return (
    [...unit.candlingLog].sort(
      (a, b) => b.day - a.day || b.date.localeCompare(a.date),
    )[0] ?? null
  );
}

/** Derives the global inspection status from the mode checkpoints and unit progress. */
export function getCandlingSummary(
  unit: Incubator,
  mode: Mode,
): CandlingSummary {
  const checkpoints = computeCandling(mode.incubationDays);
  const completedDays = new Set<number>([
    ...Object.entries(unit.candled ?? {})
      .filter(([, completed]) => completed)
      .map(([day]) => Number(day)),
    ...unit.candlingLog.map((entry) => entry.day),
  ]);
  const completedCheckpoints = checkpoints.filter(({ day }) =>
    completedDays.has(day),
  ).length;
  const nextCheckpoint =
    checkpoints.find(({ day }) => !completedDays.has(day)) ?? null;

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
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusTag({ status }: { status: InspectionStatus }) {
  const meta = statusMeta[status];
  const Icon = meta.Icon;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{
        backgroundColor: meta.bg,
        color: meta.fg,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      <Icon size={14} color={meta.fg} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function JournalCard({
  row,
  onOpen,
  highlighted = false,
}: {
  row: CandlingSummary;
  onOpen: (id: string) => void;
  highlighted?: boolean;
}) {
  const latestNote =
    row.latestLog?.note.trim() || "No note recorded for this inspection.";

  return (
    <article
      className={cn(
        "group flex h-full min-w-0 flex-col justify-between rounded-2xl border p-5 transition-colors duration-200",
        highlighted
          ? "border-[var(--nav-hover-border)] bg-[var(--nav-hover-bg)] shadow-md"
          : "border-[var(--border-default)] bg-[var(--surface-subtle)] hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] shadow-[0_2px_12px_rgba(0,0,0,0.04)]",
      )}
    >
      <div>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className="truncate"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--type-heading-sm)",
                fontWeight: "var(--weight-semibold)",
                lineHeight: "var(--leading-snug)",
                color: TEXT,
              }}
              title={row.unit.name}
            >
              {row.unit.name}
            </h3>
            <p
              className="mt-0.5 truncate"
              style={{
                color: MUTED,
                fontSize: "var(--type-body-sm)",
                lineHeight: "var(--leading-normal)",
              }}
              title={row.mode.name}
            >
              {row.mode.name}
            </p>
          </div>
          <StatusTag status={row.status} />
        </div>

        <div
          className="mt-4 flex min-h-[116px] flex-col justify-between rounded-2xl border p-3.5"
          style={{
            backgroundColor: TILE,
            borderColor: BORDER,
            backgroundImage:
              "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(232,226,213,0.85) 28px)",
          }}
        >
          <div>
            <p
              style={{
                color: TEXT,
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-bold)",
                letterSpacing: "var(--tracking-label)",
                textTransform: "uppercase",
              }}
            >
              Latest journal entry
            </p>
            <p
              className="mt-1 truncate"
              style={{ color: MUTED, fontSize: "var(--type-caption)" }}
              title={row.latestLog?.label ?? undefined}
            >
              {row.latestLog
                ? `${formatLogDate(row.latestLog.date)} · ${row.latestLog.label}`
                : "No inspection recorded yet"}
            </p>
          </div>
          <p
            className="mt-2 min-h-[40px] line-clamp-2"
            style={{
              color: MUTED,
              fontSize: "var(--type-body-sm)",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            {latestNote}
          </p>
        </div>
      </div>

      <div
        className="mt-4 flex items-center justify-between gap-2 rounded-full p-1.5"
        style={{
          backgroundColor: "#F5EFE6",
          border: `1px solid ${BORDER}`,
        }}
      >
        <div className="flex min-w-0 items-center gap-2 pl-1.5">
          <StatusIconBadge
            size="sm"
            backgroundColor={
              row.completedCheckpoints === row.checkpoints.length
                ? "var(--status-success-fg)"
                : RUST
            }
            icon={
              row.completedCheckpoints === row.checkpoints.length ? (
                <CheckCircle
                  size={statusIconBadgeGlyphSize("sm")}
                  color="var(--status-icon-badge-fg)"
                  weight="fill"
                />
              ) : (
                <Notepad
                  size={statusIconBadgeGlyphSize("sm")}
                  color="var(--status-icon-badge-fg)"
                  weight="fill"
                />
              )
            }
          />
          <span
            style={{
              color: TEXT,
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 700,
              lineHeight: "var(--leading-normal)",
            }}
          >
            {row.completedCheckpoints} of {row.checkpoints.length} checks
          </span>
        </div>

        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(row.unit.id);
          }}
          className="cursor-pointer rounded-full shadow-sm transition-colors hover:bg-[#FFF5F2]"
          aria-label={`Open candling log for ${row.unit.name}`}
          style={{
            backgroundColor: "#FFFFFF",
            color: RUST,
            height: "var(--control-height-compact)",
            border: "1px solid rgba(0,0,0,0.08)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-body-sm)",
            fontWeight: "var(--weight-bold)",
            lineHeight: "var(--leading-normal)",
            paddingLeft: 12,
            paddingRight: 10,
          }}
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
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<RowFilter>("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("attention");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // biome-ignore lint/correctness/useExhaustiveDependencies: page reset intentionally runs when filters change
  useEffect(() => {
    setPage(1);
  }, [filter, modeFilter, search, sort, sortAsc]);

  const summaries = useMemo(
    () =>
      units.map((unit) => {
        const mode =
          modes.find((candidate) => candidate.id === unit.modeId) ?? modes[0];
        return getCandlingSummary(unit, mode);
      }),
    [modes, units],
  );

  const counts = useMemo(
    () => ({
      action: summaries.filter(
        (row) => row.status === "overdue" || row.status === "due",
      ).length,
      due: summaries.filter((row) => row.status === "due").length,

      upcoming: summaries.filter((row) => row.status === "upcoming").length,
      complete: summaries.filter((row) => row.status === "complete").length,
    }),
    [summaries],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = summaries.filter((row) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "action" &&
          (row.status === "overdue" || row.status === "due")) ||
        (filter === "upcoming" && row.status === "upcoming") ||
        (filter === "complete" && row.status === "complete");
      const matchesMode = modeFilter === "all" || row.mode.id === modeFilter;
      const matchesSearch =
        !query ||
        row.unit.name.toLowerCase().includes(query) ||
        row.unit.deviceId.toLowerCase().includes(query) ||
        row.mode.name.toLowerCase().includes(query);
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
      let cmp = 0;
      if (sort === "name") {
        cmp = a.unit.name.localeCompare(b.unit.name);
      } else if (sort === "recent") {
        const aDate = a.latestLog ? new Date(a.latestLog.date).getTime() : 0;
        const bDate = b.latestLog ? new Date(b.latestLog.date).getTime() : 0;
        cmp = bDate - aDate || a.unit.name.localeCompare(b.unit.name);
      } else {
        cmp =
          statusRank[a.status] - statusRank[b.status] ||
          (a.nextCheckpoint?.day ?? Number.POSITIVE_INFINITY) -
            (b.nextCheckpoint?.day ?? Number.POSITIVE_INFINITY) ||
          a.unit.name.localeCompare(b.unit.name);
      }
      return sortAsc ? -cmp : cmp;
    });
  }, [filter, modeFilter, search, sort, sortAsc, summaries]);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice(
    (safePage - 1) * rowsPerPage,
    safePage * rowsPerPage,
  );

  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !isMobile || rows.length === 0) return;

    let ticking = false;
    let frameId: number | null = null;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      frameId = requestAnimationFrame(() => {
        ticking = false;
        frameId = null;
        const cards = cardRefs.current;
        if (!cards.length) return;
        const targetY = window.innerHeight * 0.35;
        let closestIdx = 0;
        let minDistance = Infinity;

        cards.forEach((card, idx) => {
          if (!card) return;
          const rect = card.getBoundingClientRect();
          const dist = Math.abs(rect.top - targetY);
          if (dist < minDistance) {
            minDistance = dist;
            closestIdx = idx;
          }
        });

        setActiveCardIndex((prev) => (prev === closestIdx ? prev : closestIdx));
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [isMobile, rows]);
  const scrollToCandling = (index: number) => {
    const el = cardRefs.current[index];
    if (el) {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      el.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
      el.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
      setActiveCardIndex(index);
    }
  };

  return (
    <div className="space-y-6" style={{ color: TEXT }}>
      {/* Row 1: Search + ViewToggle (desktop only) */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: MUTED }}
          />
          <Input
            size="toolbar"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            maxLength={50}
            placeholder="Search incubators..."
            aria-label="Search candling logs"
            className="rounded-xl pl-9"
            style={inputStyle}
          />
        </div>
        <div className="hidden sm:block">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* Row 2 on mobile: Status filter pills with scroll indicator / Row 2 on desktop: FilterBar + Dropdowns */}
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        style={{ marginTop: 16 }}
      >
        <div className="min-w-0 flex-1 sm:flex-initial">
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
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger
              size="toolbar"
              className="min-w-0 flex-1 rounded-xl px-2.5 text-xs sm:text-[13px] sm:w-auto sm:min-w-[140px] sm:flex-initial sm:px-3"
              style={{
                backgroundColor: SURFACE,
                borderColor: CARD_BORDER,
                color: TEXT,
                fontWeight: 500,
              }}
              aria-label="Filter by incubation mode"
            >
              <SelectValue placeholder="All modes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modes</SelectItem>
              {modes.map((mode) => (
                <SelectItem key={mode.id} value={mode.id}>
                  {mode.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sort}
            onValueChange={(value) => setSort(value as SortKey)}
          >
            <SelectTrigger
              size="toolbar"
              className="min-w-0 flex-1 rounded-xl px-2.5 text-xs sm:text-[13px] sm:w-auto sm:min-w-[140px] sm:flex-initial sm:px-3"
              style={{
                backgroundColor: SURFACE,
                borderColor: CARD_BORDER,
                color: TEXT,
                fontWeight: 500,
              }}
              aria-label="Sort candling logs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="attention">Attention</SelectItem>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>

          <button
            type="button"
            onClick={() => setSortAsc(!sortAsc)}
            className="flex h-[var(--control-height-toolbar)] w-[var(--control-height-toolbar)] shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors duration-200 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2"
            style={{
              backgroundColor: SURFACE,
              borderColor: CARD_BORDER,
              color: MUTED,
            }}
            title={sortAsc ? "Sort ascending" : "Sort descending"}
            aria-label={sortAsc ? "Sort ascending" : "Sort descending"}
          >
            {sortAsc ? (
              <ArrowUpNarrowWide size={16} />
            ) : (
              <ArrowDownWideNarrow size={16} />
            )}
          </button>
        </div>
      </div>
      <section aria-label="Candling journal list">
        {rows.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed px-5 py-12 text-center"
            style={{ backgroundColor: SUBTLE, borderColor: BORDER }}
          >
            <p style={{ color: TEXT, fontWeight: "var(--weight-bold)" }}>
              No candling logs match these filters
            </p>
            <p
              className="mt-1"
              style={{ color: MUTED, fontSize: "var(--type-body-sm)" }}
            >
              Try a different chamber, mode, or status.
            </p>
            {(search || filter !== "all" || modeFilter !== "all") && (
              <Button
                type="button"
                variant="outline"
                className="mt-4 rounded-xl"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                  setModeFilter("all");
                }}
                style={{
                  borderColor: BORDER,
                  color: RUST,
                  backgroundColor: SURFACE,
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : view === "grid" ? (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((row, idx) => (
                <div
                  key={row.unit.id}
                  ref={(el) => {
                    cardRefs.current[idx] = el;
                  }}
                  data-candling-idx={idx}
                  className="scroll-mt-24 scroll-mb-[var(--mobile-bottom-nav-clearance)] rounded-2xl"
                >
                  <JournalCard
                    row={row}
                    onOpen={onOpenCandling}
                    highlighted={isMobile && activeCardIndex === idx}
                  />
                </div>
              ))}
            </div>

            {/* Empty spacer on mobile to allow scrolling the last card completely above the mascot FAB */}
            <div className="h-16 md:hidden" aria-hidden="true" />

            {/* Floating Vertical Dot Track on Mobile (shows candling chamber count and scroll position) */}
            {rows.length > 1 && (
            <fieldset
              className="scrollbar-none pointer-events-auto fixed right-1 top-1/2 z-20 m-0 flex max-h-[calc(100dvh-var(--mobile-bottom-nav-clearance)-1rem)] min-w-0 -translate-y-1/2 flex-col items-center gap-1 overflow-y-auto border-0 bg-transparent p-0 max-[20rem]:hidden md:hidden"
              aria-label={`Candling chamber index. Showing ${rows.length} chambers.`}
            >
              {rows.map((row, idx) => {
                const isActive = activeCardIndex === idx;
                return (
                  <button
                    key={row.unit.id}
                    type="button"
                    onClick={() => scrollToCandling(idx)}
                    className="flex h-3 w-2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-none"
                    aria-label={`Scroll to ${row.unit.name} (${row.status}, ${idx + 1} of ${rows.length})`}
                    title={`${row.unit.name}: ${statusMeta[row.status].label}`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <span
                      className="rounded-full transition-all duration-200 motion-reduce:transition-none"
                      style={{
                        width: isActive ? 4 : 2.5,
                        height: isActive ? 12 : 2.5,
                        backgroundColor: isActive
                          ? "var(--brand-primary)"
                          : "rgba(138, 107, 82, 0.4)",
                      }}
                    />
                  </button>
                );
              })}
            </fieldset>
            )}
          </>
        ) : (
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              backgroundColor: SUBTLE,
              borderColor: BORDER,
              border: `1px solid ${BORDER}`,
            }}
          >
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
                <TableCaption className="sr-only">
                  Candling inspection status by incubator chamber
                </TableCaption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead
                      className="sticky top-0 z-10"
                      style={{
                        backgroundColor: SUBTLE,
                        borderBottom: `1px solid ${BORDER}`,
                        color: "var(--text-muted)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        letterSpacing: "var(--tracking-label)",
                        textTransform: "uppercase",
                      }}
                    >
                      CHAMBER
                    </TableHead>
                    <TableHead
                      className="sticky top-0 z-10"
                      style={{
                        backgroundColor: SUBTLE,
                        borderBottom: `1px solid ${BORDER}`,
                        color: "var(--text-muted)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        letterSpacing: "var(--tracking-label)",
                        textTransform: "uppercase",
                      }}
                    >
                      NEXT CHECK
                    </TableHead>
                    <TableHead
                      className="sticky top-0 z-10"
                      style={{
                        backgroundColor: SUBTLE,
                        borderBottom: `1px solid ${BORDER}`,
                        color: "var(--text-muted)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        letterSpacing: "var(--tracking-label)",
                        textTransform: "uppercase",
                      }}
                    >
                      LAST LOGGED
                    </TableHead>
                    <TableHead
                      className="sticky top-0 z-10"
                      style={{
                        backgroundColor: SUBTLE,
                        borderBottom: `1px solid ${BORDER}`,
                        color: "var(--text-muted)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        letterSpacing: "var(--tracking-label)",
                        textTransform: "uppercase",
                      }}
                    >
                      STATUS
                    </TableHead>
                    <TableHead
                      className="sticky top-0 z-10 text-right"
                      style={{
                        backgroundColor: SUBTLE,
                        borderBottom: `1px solid ${BORDER}`,
                        color: "var(--text-muted)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        letterSpacing: "var(--tracking-label)",
                        textTransform: "uppercase",
                      }}
                    >
                      ACTIONS
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row) => {
                    const meta = statusMeta[row.status];
                    return (
                      <TableRow
                        key={row.unit.id}
                        className="hover:bg-[var(--nav-hover-bg)]"
                      >
                        <TableCell
                          style={{ color: TEXT, whiteSpace: "normal" }}
                        >
                          <div className="min-w-[190px]">
                            <p
                              style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "var(--type-heading-sm)",
                                fontWeight: "var(--weight-bold)",
                              }}
                            >
                              {row.unit.name}
                            </p>
                            <p
                              className="mt-0.5"
                              style={{
                                color: MUTED,
                                fontSize: "var(--type-caption)",
                              }}
                            >
                              {row.mode.name}
                            </p>
                            <p
                              className="mt-1"
                              style={{
                                color: MUTED,
                                fontSize: "var(--type-caption)",
                              }}
                            >
                              {row.unit.candlingLog.length}{" "}
                              {row.unit.candlingLog.length === 1
                                ? "inspection"
                                : "inspections"}{" "}
                              logged
                            </p>
                          </div>
                        </TableCell>

                        <TableCell style={{ whiteSpace: "normal" }}>
                          <div className="min-w-[155px]">
                            <p
                              style={{
                                color: TEXT,
                                fontSize: "var(--type-body-sm)",
                                fontWeight: "var(--weight-semibold)",
                              }}
                            >
                              {row.nextCheckpoint?.label ??
                                (row.status === "ended"
                                  ? "Cycle ended"
                                  : "All checkpoints logged")}
                            </p>
                            <p
                              className="mt-0.5"
                              style={{
                                color:
                                  row.status === "overdue" ? meta.fg : MUTED,
                                fontSize: "var(--type-caption)",
                                fontWeight:
                                  row.status === "overdue"
                                    ? "var(--weight-bold)"
                                    : "var(--weight-regular)",
                              }}
                            >
                              {row.nextCheckpoint
                                ? `Day ${row.nextCheckpoint.day} · ${row.nextCheckpoint.dayRange}`
                                : meta.description}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell style={{ whiteSpace: "normal" }}>
                          <div className="min-w-[155px]">
                            <p
                              style={{
                                color: TEXT,
                                fontSize: "var(--type-body-sm)",
                                fontWeight: "var(--weight-semibold)",
                              }}
                            >
                              {row.latestLog
                                ? formatLogDate(row.latestLog.date)
                                : "No inspection yet"}
                            </p>
                            <p
                              className="mt-0.5"
                              style={{
                                color: MUTED,
                                fontSize: "var(--type-caption)",
                              }}
                            >
                              {row.latestLog?.label ??
                                "Start with the first checkpoint"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <StatusTag status={row.status} />
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => onOpenCandling(row.unit.id)}
                            aria-label={`Open candling log for ${row.unit.name}`}
                            style={{
                              borderColor: BORDER,
                              color: RUST,
                              backgroundColor: SURFACE,
                            }}
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
