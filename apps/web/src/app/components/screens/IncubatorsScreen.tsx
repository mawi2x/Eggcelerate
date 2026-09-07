import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Cpu,
  Loader2,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CHAMBER_NAME_MAX } from "../../data/account";
import { CURRENT_TRAY_CAPACITY } from "../../domain/candling";
import {
  calculateHatchabilityRate,
  getKnownFertileEggs,
  validateHarvestCounts,
} from "../../domain/fertility";
import { rangeState, waterState } from "../../domain/incubator";
import type { Incubator, Mode } from "../../domain/types";
import { useCycleHistoryActions } from "../../features/farm/use-farm-data";
import {
  type IncubatorStatusFilter,
  selectFilteredIncubators,
  selectIncubatorStatusFilterCounts,
  selectSortedIncubators,
} from "../../features/incubators/selectors";
import { FieldCounterLabel } from "../FieldCounterLabel";
import { HarvestModal } from "../HarvestModal";
import { IncubatorCard } from "../IncubatorCard";
import { StatusBadge } from "../StatusBadge";
import { readingStateColors } from "../statusPresentation";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { FilterBar } from "../ui/filter-bar";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { useIsMobile } from "../ui/use-mobile";
import { type ViewMode, ViewToggle } from "../ViewToggle";

interface Props {
  units: Incubator[];
  modes: Mode[];
  onOpenUnit: (id: string) => void;
  onAddIncubator: (unit: Incubator) => Promise<boolean>;
  isAddingIncubator: boolean;
}

// Design tokens.
const RUST = "var(--brand-primary)";
const CARD = "var(--surface-subtle)";
const BORDER = "var(--border-default)";
const MUTED = "var(--text-secondary)";
const TEXT = "var(--text-primary)";
const INPUT_BORDER = "var(--input-border)";

type Filter = IncubatorStatusFilter;

const inputStyle = {
  borderColor: INPUT_BORDER,
  backgroundColor: "var(--surface-tile)",
};

// Framed white control matching the toolbar spec.
const sortTriggerStyle = {
  backgroundColor: "var(--surface-card)",
  borderColor: "var(--border-default)",
  color: "var(--brand-primary)",
  fontWeight: "var(--weight-medium)",
};

type SortKey = "progress" | "name";

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "progress", label: "Progress" },
  { key: "name", label: "Name" },
];

export function IncubatorsScreen({
  units,
  modes,
  onOpenUnit,
  onAddIncubator,
  isAddingIncubator,
}: Props) {
  const isMobile = useIsMobile();
  const { completeCycle } = useCycleHistoryActions();
  // Chamber search is local to this page's controls row.
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("grid");
  const [filter, setFilter] = useState<Filter>("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("progress");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [harvestUnit, setHarvestUnit] = useState<Incubator | null>(null);

  const handleHarvestSave = async (
    unit: Incubator,
    hatched: number,
    _unhatched: number,
  ) => {
    const mode = modes.find((m) => m.id === unit.modeId) ?? modes[0];
    const totalEggs =
      unit.totalEggsLoaded && unit.totalEggsLoaded > 0
        ? unit.totalEggsLoaded
        : CURRENT_TRAY_CAPACITY;
    const fertileEggs = getKnownFertileEggs(unit);
    const hatchedEggs = Math.floor(Number(hatched) || 0);
    const validationError = validateHarvestCounts({
      totalEggs,
      fertileEggs,
      hatchedEggs,
    });
    if (validationError) {
      toast.error(validationError);
      return false;
    }
    const saved = await completeCycle({
      incubatorId: unit.id,
      chamber: unit.name,
      modeName: mode.name,
      cycleDays: Math.max(unit.dayOfIncubation, 1),
      totalEggs,
      fertileEggs,
      hatchedEggs,
    });
    if (!saved) return false;
    const rate = calculateHatchabilityRate(hatchedEggs, fertileEggs);
    setHarvestUnit(null);
    toast.success(`${unit.name}: harvest logged`, {
      description:
        rate === null
          ? "Hatchability is not available because no fertility record was saved. Incubator reset to Ready."
          : `${rate}% hatchability saved to history. Incubator reset to Ready.`,
    });
    return true;
  };

  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<
    null | "invalid" | "offline"
  >(null);
  const modeOf = (id: string) => modes.find((m) => m.id === id) ?? modes[0];

  const counts = useMemo(
    () => selectIncubatorStatusFilterCounts(units),
    [units],
  );

  const filtered = useMemo(
    () =>
      selectFilteredIncubators(units, modes, {
        search,
        status: filter,
        modeId: modeFilter,
      }),
    [units, search, filter, modeFilter, modes],
  );
  const sorted = useMemo(
    () =>
      selectSortedIncubators(filtered, modes, {
        sort,
        sortAsc,
        prioritizeIssues: filter === "issues",
      }),
    [filtered, filter, sort, sortAsc, modes],
  );
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !isMobile || sorted.length === 0)
      return;

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
  }, [isMobile, sorted]);
  const scrollToChamber = (index: number) => {
    const el = cardRefs.current[index];
    if (el) {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      el.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
      el.querySelector<HTMLElement>('[role="button"]')?.focus({
        preventScroll: true,
      });
      setActiveCardIndex(index);
    }
  };

  const filterPills: {
    key: Filter;
    label: string;
    count: number;
  }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "optimal", label: "Normal", count: counts.optimal },
    { key: "issues", label: "Alerts", count: counts.issues },
  ];

  // Pagination for the list view.
  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * rowsPerPage;
  const paged = sorted.slice(start, start + rowsPerPage);

  const resetForm = () => {
    setDeviceId("");
    setName("");
  };

  const handleAdd = async () => {
    const trimmedDeviceId = deviceId.trim();
    const trimmedName = name.trim();
    if (!trimmedDeviceId || !trimmedName) {
      toast.error("Please enter a Device ID and Chamber Name.");
      return;
    }
    if (!/^[A-Za-z0-9-]{3,20}$/.test(trimmedDeviceId)) {
      toast.error(
        "Device ID must be 3 to 20 characters using letters, numbers, or dashes. Example: EGG-1015.",
      );
      return;
    }
    if (
      units.some(
        (u) => u.deviceId.toLowerCase() === trimmedDeviceId.toLowerCase(),
      )
    ) {
      toast.error(
        `Device ${trimmedDeviceId} is already paired to another chamber.`,
      );
      return;
    }
    setConnectError(null);
    setConnecting(true);
    const id = trimmedDeviceId.trim().toUpperCase();
    if (!/^EGG-\d{4}$/.test(id)) {
      setConnectError("invalid");
      setConnecting(false);
      return;
    }
    const mode = modes[0] ?? modeOf("broiler");
    const nowIso = new Date().toISOString();
    const connected = await onAddIncubator({
      id: `chamber-${Date.now()}`,
      name: trimmedName,
      deviceId: id,
      modeId: mode.id,
      dayOfIncubation: 0,
      temp: (mode.targetTemp.min + mode.targetTemp.max) / 2,
      humidity: Math.round(
        (mode.targetHumidity.min + mode.targetHumidity.max) / 2,
      ),
      waterOk: true,
      tempTrend: 0,
      humidityTrend: 0,
      powerSource: "grid",
      batteryPct: 100,
      status: "optimal",
      cyclePhase: "ready",
      conditionSeverity: "info",
      connectionState: "connected",
      lastTurned: nowIso,
      nextTurn: new Date(
        Date.now() + mode.defaultTurnInterval * 3_600_000,
      ).toISOString(),
      turnInterval: mode.defaultTurnInterval,
      autoTurn: true,
      paired: true,
      candled: {},
      candlingLog: [],
    });
    if (!connected) {
      setConnecting(false);
      return;
    }
    toast.success(`Connected to Chamber ${trimmedName} successfully.`);
    resetForm();
    setConnecting(false);
    setOpen(false);
  };

  return (
    <div className="space-y-2 md:space-y-6" style={{ color: TEXT }}>
      {/* Row 1: Search + ViewToggle (desktop) + Add Button */}
      <div className="flex items-center gap-2.5 md:gap-3">
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
            aria-label="Search incubators"
            className="h-[34px] rounded-xl pl-9 md:h-[var(--control-height-toolbar)]"
            style={{ ...inputStyle, fontSize: "var(--type-filter-value)" }}
          />
        </div>
        <div className="hidden md:block">
          <ViewToggle view={view} onChange={setView} />
        </div>
        <Button
          size="toolbar"
          onClick={() => {
            setConnectError(null);
            setOpen(true);
          }}
          className="h-[34px] shrink-0 rounded-xl px-3 transition-colors duration-200 hover:!bg-[var(--brand-primary-hover)] focus-visible:outline-none md:h-[var(--control-height-toolbar)] md:px-5"
          style={{
            backgroundColor: RUST,
            color: "var(--on-brand)",
            fontSize: "var(--type-filter-value)",
          }}
          aria-label="Add incubator"
        >
          <Plus size={18} />
          <span className="md:hidden">Add</span>
          <span className="hidden md:inline">Add Incubator</span>
        </Button>
      </div>

      {/* Row 2 on mobile: Status filter pills with scroll indicator / Row 2 on desktop: FilterBar + Dropdowns */}
      <div className="flex flex-col gap-2 md:gap-3 md:!mt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 lg:flex-initial">
          <FilterBar
            ariaLabel="Incubator status filter"
            variant="segmented"
            fitToScreenOnMobile
            value={filter}
            onChange={(key) => {
              setFilter(key as typeof filter);
              setPage(1);
            }}
            options={filterPills.map((p) => ({
              key: p.key,
              label: p.label,
              count: p.count,
            }))}
            className="md:!w-full lg:!w-auto"
          />
        </div>

        <div className="flex w-full items-center justify-end gap-2 lg:w-auto">
          {/* Incubation Mode Select */}
          <Select
            value={modeFilter}
            onValueChange={(v) => {
              setModeFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger
              size="filter"
              className="h-[34px] min-w-0 flex-1 rounded-full px-3.5 md:w-auto md:min-w-[130px] md:flex-initial md:rounded-xl md:px-3.5"
              style={{
                ...sortTriggerStyle,
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

          {/* Sort Key Select */}
          <Select
            value={sort}
            onValueChange={(v) => {
              setSort(v as SortKey);
              setPage(1);
            }}
          >
            <SelectTrigger
              size="filter"
              className="h-[34px] min-w-0 flex-1 rounded-full px-3.5 md:w-auto md:min-w-[130px] md:flex-initial md:rounded-xl md:px-3.5"
              style={{
                ...sortTriggerStyle,
              }}
              aria-label="Sort chambers"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort Direction Toggle */}
          <button
            type="button"
            onClick={() => {
              setSortAsc((v) => !v);
              setPage(1);
            }}
            className="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors duration-200 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 md:h-[var(--control-height-toolbar)] md:w-[var(--control-height-toolbar)] md:rounded-xl"
            style={{
              backgroundColor: "var(--surface-card)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
            title={sortAsc ? "Sort ascending" : "Sort descending"}
            aria-label={`Sort direction: ${sortAsc ? "ascending" : "descending"}`}
          >
            {sortAsc ? (
              <ArrowUpNarrowWide size={16} className="md:size-[18px]" />
            ) : (
              <ArrowDownWideNarrow size={16} className="md:size-[18px]" />
            )}
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-12 text-center"
          style={{ backgroundColor: CARD, border: `1px dashed ${BORDER}` }}
        >
          <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-page-title)", lineHeight: "var(--leading-snug)", fontWeight: "var(--weight-bold)", color: TEXT }}>
            No chambers match your filters
          </p>
          <p
            style={{
              color: MUTED,
              fontSize: "var(--type-body-sm)",
              marginTop: 4,
            }}
          >
            Try a different search term or filter.
          </p>
          {(search || filter !== "all" || modeFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilter("all");
                setModeFilter("all");
              }}
              className="mt-3 min-h-[var(--control-height-default)] cursor-pointer rounded-xl px-3 py-1.5 transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 md:min-h-8"
              style={{
                color: RUST,
                fontWeight: "var(--weight-semibold)",
                fontSize: "var(--type-body-sm)",
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : view === "grid" ? (
        <>
          {/* Reserve a small mobile gutter so the fixed chamber index never
              sits on top of the card edge. */}
          <div className="grid grid-cols-1 gap-2 md:gap-5 lg:grid-cols-2 xl:grid-cols-3 pr-4 md:pr-0">
            {sorted.map((unit, idx) => (
              <div
                key={unit.id}
                ref={(el) => {
                  cardRefs.current[idx] = el;
                }}
                data-chamber-idx={idx}
                className="scroll-mt-24 scroll-mb-[var(--mobile-bottom-nav-clearance)] rounded-2xl"
              >
                <IncubatorCard
                  unit={unit}
                  mode={modeOf(unit.modeId)}
                  onOpen={onOpenUnit}
                  cta="Configure"
                  onHarvest={(u) => setHarvestUnit(u)}
                  highlighted={isMobile && activeCardIndex === idx}
                />
              </div>
            ))}
          </div>

          {/* Empty spacer on mobile to allow scrolling the last card completely above the mascot FAB */}
          <div className="h-16 md:hidden" aria-hidden="true" />

          {/* Floating Vertical Dot Track on Mobile (shows incubator count and scroll position) */}
          {sorted.length > 1 && (
            <div
              className="scrollbar-none pointer-events-auto fixed right-1.5 top-1/2 z-20 m-0 flex h-fit max-h-[calc(100dvh-var(--mobile-bottom-nav-clearance)-1rem)] w-3 min-w-0 -translate-y-1/2 flex-col items-center gap-1 overflow-y-auto bg-transparent max-[20rem]:hidden md:hidden"
              role="group"
              aria-label={`Chamber list index. Showing ${sorted.length} chambers.`}
            >
              {sorted.map((unit, idx) => {
                const isActive = activeCardIndex === idx;
                return (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => scrollToChamber(idx)}
                    className="flex h-3 w-2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
                    aria-label={`Scroll to ${unit.name} (${idx + 1} of ${sorted.length})`}
                    title={`${unit.name} (${idx + 1} of ${sorted.length})`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <span
                      className="rounded-full transition-all duration-200 motion-reduce:transition-none"
                      style={{
                        width: isActive ? 4 : 2.5,
                        height: isActive ? 12 : 2.5,
                        backgroundColor: isActive
                          ? "var(--brand-primary)"
                          : "var(--wash-checkbox)",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div
          className="overflow-hidden rounded-2xl"
          style={{ border: `1px solid ${BORDER}`, backgroundColor: CARD }}
        >
          <PaginationBar
            className="border-b border-t-0"
            page={clampedPage}
            pageSize={rowsPerPage}
            totalItems={sorted.length}
            itemLabel="incubators"
            pageSizeOptions={[10, 20, 50]}
            onPageSizeChange={(value) => {
              setRowsPerPage(value);
              setPage(1);
            }}
            onPageChange={setPage}
          />
          <div className="h-[560px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["CHAMBER", "MODE", "DAY"].map((h) => (
                    <TableHead
                      key={h}
                      className="sticky top-0 z-10"
                      style={{
                        backgroundColor: CARD,
                        borderBottom: `1px solid ${BORDER}`,
                        color: "var(--text-muted)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        letterSpacing: "var(--tracking-label)",
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </TableHead>
                  ))}
                  {["TEMP", "HUMIDITY", "WATER"].map((h) => (
                    <TableHead
                      key={h}
                      className="sticky top-0 z-10 text-right"
                      style={{
                        backgroundColor: CARD,
                        borderBottom: `1px solid ${BORDER}`,
                        color: "var(--text-muted)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        letterSpacing: "var(--tracking-label)",
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </TableHead>
                  ))}
                  {["STATUS", "ACTIONS"].map((h) => (
                    <TableHead
                      key={h}
                      className="sticky top-0 z-10"
                      style={{
                        backgroundColor: CARD,
                        borderBottom: `1px solid ${BORDER}`,
                        color: "var(--text-muted)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        letterSpacing: "var(--tracking-label)",
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((unit) => {
                  const mode = modeOf(unit.modeId);
                  const tempSt = rangeState(unit.temp, mode.targetTemp);
                  const humSt = rangeState(unit.humidity, mode.targetHumidity);
                  const waterSt = waterState(unit.waterOk);
                  return (
                    <TableRow
                      key={unit.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`View incubator ${unit.name} — click to open details`}
                      onClick={() => onOpenUnit(unit.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenUnit(unit.id);
                        }
                      }}
                      className="group cursor-pointer transition-colors duration-200 hover:bg-[var(--nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                    >
                      <TableCell
                        style={{
                          fontWeight: "var(--weight-bold)",
                          color: TEXT,
                        }}
                      >
                        {unit.name}
                      </TableCell>
                      <TableCell>
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor: "var(--wash-brand-soft)",
                            color: RUST,
                            fontWeight: "var(--weight-bold)",
                            fontSize: "var(--type-caption)",
                          }}
                        >
                          {mode.name}
                        </span>
                      </TableCell>
                      <TableCell style={{ color: MUTED }}>
                        {unit.dayOfIncubation} of {mode.incubationDays}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        style={{
                          color: readingStateColors[tempSt],
                          fontWeight: "var(--weight-bold)",
                        }}
                      >
                        {unit.temp}°C
                      </TableCell>
                      <TableCell
                        className="text-right"
                        style={{
                          color: readingStateColors[humSt],
                          fontWeight: "var(--weight-bold)",
                        }}
                      >
                        {unit.humidity}%
                      </TableCell>
                      <TableCell
                        className="text-right"
                        style={{
                          color: readingStateColors[waterSt],
                          fontWeight: "var(--weight-bold)",
                        }}
                      >
                        {unit.waterOk ? "Normal" : "Low"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={unit.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          style={{ borderColor: BORDER, color: RUST }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenUnit(unit.id);
                          }}
                        >
                          Configure
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

      {/* Add incubator dialog */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!connecting) {
            setOpen(o);
            if (!o) setConnectError(null);
          }
        }}
      >
        <DialogContent className="rounded-2xl md:max-w-md">
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--type-heading-md)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              Add Incubator
            </DialogTitle>
            <DialogDescription>
              Enter the Device ID generated on your physical incubator screen
              and name this chamber.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {connectError && (
              <div
                className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
                style={{
                  backgroundColor: "var(--status-danger-bg)",
                  border: "1px solid var(--border-blush)",
                }}
                role="alert"
              >
                <TriangleAlert
                  size={16}
                  color="var(--status-danger-fg)"
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <p
                    style={{
                      fontSize: "var(--type-body-sm)",
                      fontWeight: "var(--weight-bold)",
                      color: "var(--status-danger-fg)",
                    }}
                  >
                    Connection Failed
                  </p>
                  <p
                    style={{
                      fontSize: "var(--type-caption)",
                      color: "var(--status-danger-fg)",
                      lineHeight: 1.45,
                      marginTop: 2,
                    }}
                  >
                    {connectError === "invalid"
                      ? `Could not find an incubator with Device ID '${deviceId.trim()}'. Please check the display screen on your incubator and try again.`
                      : `Device '${deviceId.trim()}' is offline. Please make sure your incubator is powered on and connected to WiFi.`}
                  </p>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="deviceId">Device ID</Label>
              <div className="relative mt-1.5">
                <Cpu
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: MUTED }}
                />
                <Input
                  id="deviceId"
                  value={deviceId}
                  onChange={(e) => {
                    setDeviceId(
                      e.target.value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 20),
                    );
                    if (connectError) setConnectError(null);
                  }}
                  maxLength={20}
                  disabled={connecting}
                  placeholder="EGG-1015"
                  className="rounded-xl pl-9"
                  style={{
                    ...inputStyle,
                    borderColor: connectError
                      ? "var(--status-danger-fg)"
                      : inputStyle.borderColor,
                  }}
                  aria-invalid={!!connectError}
                />
              </div>
              {connecting && (
                <p
                  className="mt-2 flex items-center gap-1.5"
                  style={{
                    fontSize: "var(--type-caption)",
                    color: "var(--brand-primary-hover)",
                    fontWeight: "var(--weight-semibold)",
                  }}
                >
                  <Loader2 size={13} className="animate-spin" /> Verifying
                  hardware ID and establishing connection...
                </p>
              )}
            </div>
            <div>
              <FieldCounterLabel
                htmlFor="name"
                label="Chamber Name"
                value={name}
                max={CHAMBER_NAME_MAX}
              />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={CHAMBER_NAME_MAX}
                disabled={connecting}
                placeholder="Chamber Thirteen"
                className="mt-1.5 rounded-xl"
                style={inputStyle}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={connecting || isAddingIncubator}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              disabled={connecting || isAddingIncubator}
              aria-busy={connecting || isAddingIncubator}
              onClick={() => void handleAdd()}
              style={{ backgroundColor: RUST, color: "var(--on-brand)" }}
            >
              {connecting || isAddingIncubator ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Connecting to
                  Incubator...
                </>
              ) : connectError ? (
                "Retry Connection"
              ) : (
                "Connect Incubator"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final harvest & reset modal */}
      <HarvestModal
        open={harvestUnit !== null}
        onOpenChange={(o) => {
          if (!o) setHarvestUnit(null);
        }}
        chamberName={harvestUnit?.name ?? ""}
        totalEggsLoaded={
          harvestUnit
            ? harvestUnit.totalEggsLoaded && harvestUnit.totalEggsLoaded > 0
              ? harvestUnit.totalEggsLoaded
              : CURRENT_TRAY_CAPACITY
            : 0
        }
        fertileEggs={harvestUnit ? getKnownFertileEggs(harvestUnit) : null}
        onSave={(hatched, unhatched) =>
          harvestUnit
            ? handleHarvestSave(harvestUnit, hatched, unhatched)
            : Promise.resolve(false)
        }
      />
    </div>
  );
}
