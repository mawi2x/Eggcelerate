import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Cpu, Search, ChevronLeft, ChevronRight, ArrowUpNarrowWide, ArrowDownWideNarrow, Loader2, TriangleAlert } from "lucide-react";
import { IncubatorCard } from "../IncubatorCard";
import { HarvestModal } from "../HarvestModal";
import { StatusBadge } from "../StatusBadge";
import { ViewToggle, ViewMode } from "../ViewToggle";
import { FieldCounterLabel } from "../FieldCounterLabel";
import { CHAMBER_NAME_MAX } from "../../data/account";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import {
  Incubator, Mode, UnitStatus, rangeState, waterState, readingStateColors, daysUntilHatch,
  nominalEggCapacity, recordHarvest, resetChamberToReady,
} from "../../data/mockData";

interface Props {
  units: Incubator[];
  modes: Mode[];
  onOpenUnit: (id: string) => void;
  onAddIncubator: (unit: Incubator) => void;
  onUpdateUnit: (id: string, patch: Partial<Incubator>) => void;
}

// Design tokens.
const RUST = "#A84323";
const CARD = "#F9F6F0";
const BORDER = "#E8E2D5";
const MUTED = "#5A4838";
const TEXT = "#1A1A1A";
const INPUT_BORDER = "#D8D0C0";

type Filter = "all" | UnitStatus;

// Device IDs that exist but are simulated as offline/unreachable.
const OFFLINE_DEVICE_IDS = ["EGG-0000", "EGG-9999"];

const inputStyle = { borderColor: INPUT_BORDER, backgroundColor: "#F2EEE5" };

// Framed white control matching the toolbar spec.
const sortTriggerStyle = {
  height: 38,
  backgroundColor: "#FFFFFF",
  borderColor: "#EAE7E1",
  color: "#1A1A1A",
  fontSize: 13,
  fontWeight: 500,
};

type SortKey = "progress" | "name";

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "progress", label: "Progress" },
  { key: "name", label: "Name" },
];

export function IncubatorsScreen({ units, modes, onOpenUnit, onAddIncubator, onUpdateUnit }: Props) {
  // Chamber search is local to this page's controls row.
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("grid");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("progress");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [harvestUnit, setHarvestUnit] = useState<Incubator | null>(null);

  const handleHarvestSave = (unit: Incubator, hatched: number, unhatched: number) => {
    const mode = modes.find((m) => m.id === unit.modeId) ?? modes[0];
    const totalEggs = unit.totalEggsLoaded && unit.totalEggsLoaded > 0
      ? unit.totalEggsLoaded
      : nominalEggCapacity(unit.modeId);
    const hatchedEggs = Math.floor(Number(hatched) || 0);
    if (hatchedEggs < 0 || hatchedEggs > totalEggs) {
      toast.error(`Hatched eggs must be between 0 and ${totalEggs}.`);
      return;
    }
    const rate = recordHarvest({
      chamber: unit.name,
      modeName: mode.name,
      cycleDays: Math.max(unit.dayOfIncubation, mode.incubationDays),
      totalEggs,
      hatchedEggs,
    });
    onUpdateUnit(unit.id, resetChamberToReady(unit));
    setHarvestUnit(null);
    toast.success(`${unit.name}: harvest logged`, {
      description: `${rate}% hatch rate saved to history — chamber reset to Ready.`,
    });
  };

  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<null | "invalid" | "offline">(null);
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (connectTimer.current) clearTimeout(connectTimer.current); }, []);

  const modeOf = (id: string) => modes.find((m) => m.id === id) ?? modes[0];

  const counts = useMemo(() => ({
    all: units.length,
    optimal: units.filter((u) => u.status === "optimal").length,
    warning: units.filter((u) => u.status === "warning").length,
    alert: units.filter((u) => u.status === "alert").length,
  }), [units]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((u) => {
      if (filter !== "all" && u.status !== filter) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || modeOf(u.modeId).name.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, search, filter, modes]);

  const sorted = useMemo(() => {
    const remaining = (u: Incubator) => {
      const m = modeOf(u.modeId);
      return daysUntilHatch(u.dayOfIncubation, m.incubationDays);
    };
    const pct = (u: Incubator) => {
      const days = modeOf(u.modeId).incubationDays;
      return days > 0 ? Math.min(1, Math.max(0, u.dayOfIncubation / days)) : 0;
    };
    const byName = (a: Incubator, b: Incubator) => a.name.localeCompare(b.name);

    // Copy first — `filtered` is derived state and must not be mutated in place.
    return [...filtered].sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sort) {
        case "progress":
          // Ascending = nearest to hatching first; ties break on the further-along cycle.
          return dir * (remaining(a) - remaining(b) || pct(b) - pct(a)) || byName(a, b);
        case "name":
          return dir * byName(a, b);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, sortAsc, modes]);

  const filterPills: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "ALL", count: counts.all },
    { key: "optimal", label: "OPTIMAL", count: counts.optimal },
    { key: "warning", label: "NEEDS ATTENTION", count: counts.warning },
    { key: "alert", label: "ALERT", count: counts.alert },
  ];

  // Pagination for the list view.
  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * rowsPerPage;
  const paged = sorted.slice(start, start + rowsPerPage);

  const resetForm = () => { setDeviceId(""); setName(""); };

  const handleAdd = () => {
    const trimmedDeviceId = deviceId.trim();
    const trimmedName = name.trim();
    if (!trimmedDeviceId || !trimmedName) {
      toast.error("Please enter a Device ID and Chamber Name.");
      return;
    }
    if (!/^[A-Za-z0-9-]{3,20}$/.test(trimmedDeviceId)) {
      toast.error("Device ID must be 3–20 characters using letters, numbers or dashes (e.g. EGG-1015).");
      return;
    }
    if (units.some((u) => u.deviceId.toLowerCase() === trimmedDeviceId.toLowerCase())) {
      toast.error(`Device ${trimmedDeviceId} is already paired to another chamber.`);
      return;
    }
    // Simulated hardware handshake — 2.5s, then verify the ID is reachable.
    setConnectError(null);
    setConnecting(true);
    connectTimer.current = setTimeout(() => {
      const id = trimmedDeviceId.trim().toUpperCase();
      if (OFFLINE_DEVICE_IDS.includes(id)) {
        setConnectError("offline");
        setConnecting(false);
        return;
      }
      if (!/^EGG-\d{4}$/.test(id)) {
        setConnectError("invalid");
        setConnecting(false);
        return;
      }
      const mode = modes[0] ?? modeOf("broiler");
      const nowIso = new Date().toISOString();
      onAddIncubator({
        id: `chamber-${Date.now()}`,
        name: trimmedName,
        deviceId: id,
        modeId: mode.id,
        dayOfIncubation: 0,
        temp: (mode.targetTemp.min + mode.targetTemp.max) / 2,
        humidity: Math.round((mode.targetHumidity.min + mode.targetHumidity.max) / 2),
        waterOk: true,
        tempTrend: 0,
        humidityTrend: 0,
        powerSource: "grid",
        batteryPct: 100,
        status: "optimal",
        lastTurned: nowIso,
        nextTurn: new Date(Date.now() + mode.defaultTurnInterval * 3_600_000).toISOString(),
        turnInterval: mode.defaultTurnInterval,
        autoTurn: true,
        paired: true,
        candled: {},
        candlingLog: [],
      });
      toast.success(`Connected to Chamber ${trimmedName} successfully.`);
      resetForm();
      setConnecting(false);
      setOpen(false);
    }, 2500);
  };

  return (
    <div className="space-y-6" style={{ color: TEXT }}>
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            maxLength={50}
            placeholder="Search incubators..."
            aria-label="Search incubators"
            className="rounded-xl pl-9"
            style={inputStyle}
          />
        </div>
        <ViewToggle view={view} onChange={setView} />
        <Button
          onClick={() => { setConnectError(null); setOpen(true); }}
          className="rounded-xl px-5"
          style={{ backgroundColor: RUST, color: "#fff", minHeight: 40 }}
        >
          <Plus size={18} /> Add Incubator
        </Button>
      </div>

      {/* Filter pills on the left, hatch timeline sort on the right */}
      <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: 20 }}>
      <div className="flex flex-wrap gap-2">
        {filterPills.map((p) => {
          const active = filter === p.key;
          return (
            <button
              key={p.key}
              onClick={() => { setFilter(p.key); setPage(1); }}
              className="rounded-full px-3.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                backgroundColor: active ? RUST : CARD,
                color: active ? "#fff" : "#78716C",
                border: `1px solid ${active ? RUST : BORDER}`,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {p.label} ({p.count})
            </button>
          );
        })}
      </div>

        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => { setSort(v as SortKey); setPage(1); }}>
            <SelectTrigger
              className="w-auto min-w-[140px] rounded-xl"
              style={sortTriggerStyle}
              aria-label="Sort chambers"
            >
              <span className="whitespace-nowrap">Sort: {sortOptions.find((o) => o.key === sort)?.label}</span>
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((o) => (
                <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Flips the current sort between ascending and descending. */}
          <button
            onClick={() => { setSortAsc((v) => !v); setPage(1); }}
            className="flex shrink-0 items-center justify-center transition-colors hover:bg-[#FAF7F2] focus-visible:outline-none focus-visible:ring-2"
            style={{ width: 32, height: 32, backgroundColor: "#FFFFFF", border: "1px solid #EAE7E1", borderRadius: 8, color: "#1A1A1A" }}
            title={sortAsc ? "Ascending" : "Descending"}
            aria-label={`Sort direction: ${sortAsc ? "ascending" : "descending"}`}
          >
            {sortAsc ? <ArrowUpNarrowWide size={16} /> : <ArrowDownWideNarrow size={16} />}
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl px-5 py-12 text-center" style={{ backgroundColor: CARD, border: `1px dashed ${BORDER}` }}>
          <p style={{ fontWeight: 700, color: TEXT }}>No chambers match your filters</p>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>Try a different search term or filter.</p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-3 rounded-xl px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ color: RUST, fontWeight: 600, fontSize: 13 }}
            >
              Clear search
            </button>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((unit) => (
            <IncubatorCard
              key={unit.id}
              unit={unit}
              mode={modeOf(unit.modeId)}
              onOpen={onOpenUnit}
              cta="Configure"
              onHarvest={(u) => setHarvestUnit(u)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${BORDER}`, backgroundColor: CARD }}>
          <div className="h-[560px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["CHAMBER", "MODE", "DAY"].map((h) => (
                    <TableHead key={h} className="sticky top-0 z-10" style={{ backgroundColor: CARD, borderBottom: `1px solid ${BORDER}`, color: "#78716C", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</TableHead>
                  ))}
                  {["TEMP", "HUMIDITY", "WATER"].map((h) => (
                    <TableHead key={h} className="sticky top-0 z-10 text-right" style={{ backgroundColor: CARD, borderBottom: `1px solid ${BORDER}`, color: "#78716C", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</TableHead>
                  ))}
                  {["STATUS", "ACTIONS"].map((h) => (
                    <TableHead key={h} className="sticky top-0 z-10" style={{ backgroundColor: CARD, borderBottom: `1px solid ${BORDER}`, color: "#78716C", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</TableHead>
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
                      onClick={() => onOpenUnit(unit.id)}
                      className="cursor-pointer transition-colors hover:bg-amber-50/60"
                    >
                      <TableCell style={{ fontWeight: 700, color: TEXT }}>{unit.name}</TableCell>
                      <TableCell>
                        <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(173,58,29,0.12)", color: RUST, fontWeight: 700, fontSize: 12 }}>
                          {mode.name}
                        </span>
                      </TableCell>
                      <TableCell style={{ color: MUTED }}>{unit.dayOfIncubation} of {mode.incubationDays}</TableCell>
                      <TableCell className="text-right" style={{ color: readingStateColors[tempSt], fontWeight: 700 }}>{unit.temp}°C</TableCell>
                      <TableCell className="text-right" style={{ color: readingStateColors[humSt], fontWeight: 700 }}>{unit.humidity}%</TableCell>
                      <TableCell className="text-right" style={{ color: readingStateColors[waterSt], fontWeight: 700 }}>{unit.waterOk ? "Normal" : "Low"}</TableCell>
                      <TableCell><StatusBadge status={unit.status} /></TableCell>
                      <TableCell>
                        <Button
                          size="sm" variant="outline" className="rounded-xl"
                          style={{ borderColor: BORDER, color: RUST }}
                          onClick={(e) => { e.stopPropagation(); onOpenUnit(unit.id); }}
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

          {/* Pagination bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <span style={{ color: MUTED, fontSize: 13 }}>
              Showing {sorted.length === 0 ? 0 : start + 1}–{Math.min(start + rowsPerPage, sorted.length)} of {sorted.length} chambers
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span style={{ color: MUTED, fontSize: 13 }}>Rows per page:</span>
                <Select value={String(rowsPerPage)} onValueChange={(v) => { setRowsPerPage(Number(v)); setPage(1); }}>
                  <SelectTrigger className="h-8 w-[72px] rounded-lg" style={inputStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="rounded-lg" style={{ borderColor: BORDER }}
                  disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                  <ChevronLeft size={16} />
                </Button>
                <span style={{ color: MUTED, fontSize: 13 }}>Page {clampedPage} / {totalPages}</span>
                <Button size="sm" variant="outline" className="rounded-lg" style={{ borderColor: BORDER }}
                  disabled={clampedPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add incubator dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!connecting) { setOpen(o); if (!o) setConnectError(null); } }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Baloo 2, sans-serif" }}>Add Incubator</DialogTitle>
            <DialogDescription>Enter the Device ID generated on your physical incubator screen and name this chamber.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {connectError && (
              <div
                className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
                style={{ backgroundColor: "#FEE2E2", border: "1px solid #FECACA" }}
                role="alert"
              >
                <TriangleAlert size={16} color="#DC2626" className="mt-0.5 shrink-0" />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C" }}>Connection Failed</p>
                  <p style={{ fontSize: 12, color: "#B91C1C", lineHeight: 1.45, marginTop: 2 }}>
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
                <Cpu size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                <Input id="deviceId" value={deviceId}
                  onChange={(e) => { setDeviceId(e.target.value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 20)); if (connectError) setConnectError(null); }}
                  maxLength={20}
                  disabled={connecting}
                  placeholder="EGG-1015"
                  className="rounded-xl pl-9"
                  style={{ ...inputStyle, borderColor: connectError ? "#DC2626" : inputStyle.borderColor }}
                  aria-invalid={!!connectError}
                />
              </div>
              {connecting && (
                <p className="mt-2 flex items-center gap-1.5" style={{ fontSize: 12, color: "#8B3A1C", fontWeight: 600 }}>
                  <Loader2 size={13} className="animate-spin" /> Verifying hardware ID and establishing connection...
                </p>
              )}
            </div>
            <div>
              <FieldCounterLabel htmlFor="name" label="Chamber Name" value={name} max={CHAMBER_NAME_MAX} />
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
            <Button variant="outline" className="rounded-xl" disabled={connecting} onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="rounded-xl"
              disabled={connecting}
              onClick={handleAdd}
              style={{ backgroundColor: RUST, color: "#fff" }}
            >
              {connecting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Connecting to Incubator...
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
        onOpenChange={(o) => { if (!o) setHarvestUnit(null); }}
        chamberName={harvestUnit?.name ?? ""}
        totalEggsLoaded={harvestUnit
          ? (harvestUnit.totalEggsLoaded && harvestUnit.totalEggsLoaded > 0
            ? harvestUnit.totalEggsLoaded
            : nominalEggCapacity(harvestUnit.modeId))
          : 0}
        onSave={(hatched, unhatched) => {
          if (harvestUnit) handleHarvestSave(harvestUnit, hatched, unhatched);
        }}
      />
    </div>
  );
}
