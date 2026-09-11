import {
  CalendarDays,
  Copy,
  Download,
  Droplets,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Share2,
  Thermometer,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { computeCandling } from "../../domain/candling";
import type { Mode } from "../../domain/types";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
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
import {
  BORDER,
  CRIT,
  CRIT_BG,
  inputClass,
  inputStyle,
  MUTED,
  PanelHeader,
  RUST,
  TEXT,
} from "./tokens";

interface Props {
  modes: Mode[];
  onUpdateMode: (id: string, patch: Partial<Mode>) => Promise<boolean>;
  onAddMode: (mode: Mode) => Promise<boolean>;
  onDeleteMode: (id: string) => Promise<boolean>;
}

interface ModeDraft {
  name: string;
  tempMin: number;
  tempMax: number;
  humMin: number;
  humMax: number;
  incubationDays: number;
  defaultTurnInterval: number;
}

const emptyDraft: ModeDraft = {
  name: "",
  tempMin: 37.5,
  tempMax: 37.8,
  humMin: 55,
  humMax: 60,
  incubationDays: 21,
  defaultTurnInterval: 4,
};

function modeToDraft(m: Mode): ModeDraft {
  return {
    name: m.name,
    tempMin: m.targetTemp.min,
    tempMax: m.targetTemp.max,
    humMin: m.targetHumidity.min,
    humMax: m.targetHumidity.max,
    incubationDays: m.incubationDays,
    defaultTurnInterval: m.defaultTurnInterval,
  };
}

// Validate an unknown object parsed from an imported file into a Mode shape.
function coerceMode(raw: unknown, idSuffix: string): Mode | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const name = record.name;
  if (typeof name !== "string") return null;
  const t = (record.targetTemp ?? {}) as Record<string, unknown>;
  const h = (record.targetHumidity ?? {}) as Record<string, unknown>;
  const nums = [
    t.min,
    t.max,
    h.min,
    h.max,
    record.incubationDays,
    record.defaultTurnInterval,
  ];
  if (nums.some((n) => typeof n !== "number" || Number.isNaN(n))) return null;
  const tempMin = t.min as number,
    tempMax = t.max as number,
    humMin = h.min as number,
    humMax = h.max as number;
  const days = record.incubationDays as number,
    interval = record.defaultTurnInterval as number;
  // Same biological bounds as the custom-mode form; anything else is rejected.
  if (
    tempMin < 30 ||
    tempMin > 42 ||
    tempMax < 30 ||
    tempMax > 42 ||
    tempMin > tempMax
  )
    return null;
  if (
    humMin < 30 ||
    humMin > 90 ||
    humMax < 30 ||
    humMax > 90 ||
    humMin > humMax
  )
    return null;
  if (!Number.isInteger(days) || days < 7 || days > 45) return null;
  if (!Number.isInteger(interval) || interval < 1 || interval > 24) return null;
  return {
    id: `mode-${Date.now()}-${idSuffix}`,
    name: name.trim().slice(0, 30),
    builtIn: false, // imported modes are always custom
    targetTemp: { min: tempMin, max: tempMax },
    targetHumidity: { min: humMin, max: humMax },
    incubationDays: days,
    defaultTurnInterval: interval,
  };
}

interface Conflict {
  incoming: Mode;
  existingId: string;
  resolution: "overwrite" | "rename";
}

export function ModeLibraryPanel({
  modes,
  onUpdateMode,
  onAddMode,
  onDeleteMode,
}: Props) {
  const [view, setView] = useState<ViewMode>("list");
  const isMobile = useIsMobile();
  const [modeSearch, setModeSearch] = useState("");

  const filteredModes = useMemo(() => {
    const q = modeSearch.trim().toLowerCase();
    if (!q) return modes;
    return modes.filter((m) => m.name.toLowerCase().includes(q));
  }, [modes, modeSearch]);

  // Modal state for edit / add.
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<"edit" | "add">("add");
  const [modalId, setModalId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ModeDraft>(emptyDraft);

  // Import conflict resolution.
  const fileRef = useRef<HTMLInputElement>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [pendingClean, setPendingClean] = useState<Mode[]>([]);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Mode | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const openEdit = (m: Mode) => {
    setModalKind("edit");
    setModalId(m.id);
    setDraft(modeToDraft(m));
    setModalOpen(true);
  };

  const openAdd = () => {
    setModalKind("add");
    setModalId(null);
    setDraft(emptyDraft);
    setModalOpen(true);
  };

  // Clone a preset into a fresh custom mode the user can then customize.
  const duplicateMode = async (m: Mode) => {
    setIsMutating(true);
    const saved = await onAddMode({
      id: `mode-${Date.now()}`,
      name: `${m.name} Copy`,
      builtIn: false,
      targetTemp: { ...m.targetTemp },
      targetHumidity: { ...m.targetHumidity },
      incubationDays: m.incubationDays,
      defaultTurnInterval: m.defaultTurnInterval,
    });
    setIsMutating(false);
    if (saved) toast.success(`Duplicated "${m.name}"`);
  };

  // Download a single mode as its own .json file.
  const exportSingle = (m: Mode) => {
    const { id: _omit, builtIn: _b, ...payload } = m;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${m.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported "${m.name}"`);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsMutating(true);
    if (await onDeleteMode(deleteTarget.id)) {
      toast.success(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
    }
    setIsMutating(false);
  };

  const saveModal = async () => {
    if (!draft.name.trim()) {
      toast.error("Please name your Mode.");
      return;
    }
    const {
      tempMin,
      tempMax,
      humMin,
      humMax,
      incubationDays,
      defaultTurnInterval,
    } = draft;
    const inRange = (v: number, lo: number, hi: number) =>
      Number.isFinite(v) && v >= lo && v <= hi;
    if (!inRange(tempMin, 30, 42) || !inRange(tempMax, 30, 42)) {
      toast.error("Temperature must be between 30.0°C and 42.0°C.");
      return;
    }
    if (tempMin > tempMax) {
      toast.error("Temperature min cannot be above max.");
      return;
    }
    if (!inRange(humMin, 30, 90) || !inRange(humMax, 30, 90)) {
      toast.error("Humidity must be between 30% and 90%.");
      return;
    }
    if (humMin > humMax) {
      toast.error("Humidity min cannot be above max.");
      return;
    }
    if (
      !Number.isInteger(incubationDays) ||
      incubationDays < 7 ||
      incubationDays > 45
    ) {
      toast.error("Duration must be a whole number between 7 and 45 days.");
      return;
    }
    if (
      !Number.isInteger(defaultTurnInterval) ||
      defaultTurnInterval < 1 ||
      defaultTurnInterval > 24
    ) {
      toast.error(
        "Turn interval must be a whole number between 1 and 24 hours.",
      );
      return;
    }
    const payload = {
      name: draft.name.trim(),
      targetTemp: { min: tempMin, max: tempMax },
      targetHumidity: { min: humMin, max: humMax },
      incubationDays,
      defaultTurnInterval,
    };
    setIsMutating(true);
    const saved =
      modalKind === "edit" && modalId
        ? await onUpdateMode(modalId, payload)
        : await onAddMode({
            id: `mode-${Date.now()}`,
            builtIn: false,
            ...payload,
          });
    setIsMutating(false);
    if (!saved) return;
    toast.success(
      modalKind === "edit"
        ? `${payload.name} mode updated`
        : `Custom mode "${payload.name}" added`,
    );
    setModalOpen(false);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ modes }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eggcelerate-modes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${modes.length} modes`);
  };

  const handleImportFile = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text()) as unknown;
    } catch {
      toast.error("Could not read that file. The JSON is invalid.");
      return;
    }
    const candidate: unknown = Array.isArray(parsed)
      ? parsed
      : (parsed as { modes?: unknown } | null | undefined)?.modes;
    if (!Array.isArray(candidate)) {
      toast.error("No modes found in that file.");
      return;
    }
    const rawModes: unknown[] = candidate;

    const clean: Mode[] = [];
    const found: Conflict[] = [];
    rawModes.forEach((raw, i) => {
      const m = coerceMode(raw, String(i));
      if (!m) return;
      // Built-in names always import as a separate custom copy (never overwrite a built-in).
      const existingCustom = modes.find(
        (x) => !x.builtIn && x.name.toLowerCase() === m.name.toLowerCase(),
      );
      if (existingCustom) {
        found.push({
          incoming: m,
          existingId: existingCustom.id,
          resolution: "overwrite",
        });
      } else {
        clean.push(m);
      }
    });

    if (clean.length === 0 && found.length === 0) {
      toast.error("No valid modes to import.");
      return;
    }

    if (found.length > 0) {
      setPendingClean(clean);
      setConflicts(found);
      setConflictOpen(true);
    } else {
      setIsMutating(true);
      const results = await Promise.all(clean.map(onAddMode));
      setIsMutating(false);
      const savedCount = results.filter(Boolean).length;
      if (savedCount > 0)
        toast.success(
          `Imported ${savedCount} mode${savedCount === 1 ? "" : "s"}`,
        );
    }
  };

  const applyImport = async () => {
    setIsMutating(true);
    const actions: Promise<boolean>[] = pendingClean.map(onAddMode);
    conflicts.forEach((c) => {
      if (c.resolution === "overwrite") {
        actions.push(
          onUpdateMode(c.existingId, {
            name: c.incoming.name,
            targetTemp: c.incoming.targetTemp,
            targetHumidity: c.incoming.targetHumidity,
            incubationDays: c.incoming.incubationDays,
            defaultTurnInterval: c.incoming.defaultTurnInterval,
          }),
        );
      } else {
        actions.push(
          onAddMode({ ...c.incoming, name: `${c.incoming.name} (imported)` }),
        );
      }
    });
    const results = await Promise.all(actions);
    setIsMutating(false);
    if (results.some((saved) => !saved)) return;
    const total = results.length;
    toast.success(`Imported ${total} mode${total === 1 ? "" : "s"}`);
    setConflictOpen(false);
    setConflicts([]);
    setPendingClean([]);
  };

  // Per-item action buttons, shared between grid cards and list rows.
  const ModeActions = ({ m }: { m: Mode }) => {
    const iconBtn =
      "inline-flex h-11 w-11 md:h-8 md:w-8 cursor-pointer items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-hover-cream)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1";
    return (
      <div className="flex items-center gap-2 md:gap-1.5">
        <button
          type="button"
          onClick={() => openEdit(m)}
          className={iconBtn}
          style={{ borderColor: BORDER, color: TEXT }}
          title={m.builtIn ? "View / customize" : "Edit"}
          aria-label={
            m.builtIn ? `View or customize ${m.name}` : `Edit ${m.name}`
          }
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={() => void duplicateMode(m)}
          disabled={isMutating}
          className={iconBtn}
          style={{ borderColor: BORDER, color: TEXT }}
          title="Duplicate"
          aria-label={`Duplicate ${m.name}`}
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          onClick={() => exportSingle(m)}
          className={iconBtn}
          style={{ borderColor: BORDER, color: TEXT }}
          title="Share / export"
          aria-label={`Share or export ${m.name}`}
        >
          <Share2 size={14} />
        </button>
        {!m.builtIn && (
          <button
            type="button"
            onClick={() => setDeleteTarget(m)}
            className={iconBtn}
            style={{
              borderColor: CRIT_BG,
              color: CRIT,
              backgroundColor: CRIT_BG,
            }}
            title="Delete"
            aria-label={`Delete ${m.name}`}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  };

  const draftField = (
    label: string,
    value: number,
    onChange: (n: number) => void,
    opts: { step?: number; min?: number; max?: number } = {},
  ) => (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        step={opts.step ?? 1}
        min={opts.min}
        max={opts.max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : value);
        }}
        className={`mt-1.5 ${inputClass}`}
        style={inputStyle}
      />
    </div>
  );

  const badge = (m: Mode) =>
    m.builtIn ? (
      <span
        className="shrink-0 rounded-full px-2 py-0.5"
        style={{
          backgroundColor: "var(--wash-brand-12)",
          color: RUST,
          fontFamily: "var(--font-body)",
          fontSize: "var(--type-label)",
          fontWeight: "var(--weight-bold)",
          letterSpacing: "var(--tracking-label)",
          lineHeight: "var(--leading-snug)",
        }}
      >
        Built-in
      </span>
    ) : (
      <span
        className="shrink-0 rounded-full px-2 py-0.5"
        style={{
          backgroundColor: "var(--status-success-bg)",
          color: "var(--status-success-fg)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--type-label)",
          fontWeight: "var(--weight-bold)",
          letterSpacing: "var(--tracking-label)",
          lineHeight: "var(--leading-snug)",
        }}
      >
        Custom
      </span>
    );

  return (
    <div>
      <PanelHeader
        id="settings-panel-modes"
        title="Mode Library"
        description="Incubation presets: temperature, humidity, duration, and how often eggs turn for each species."
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 py-4">
        <div className="relative min-w-0 w-full flex-1 md:min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: MUTED }}
          />
          <Input
            value={modeSearch}
            onChange={(e) => setModeSearch(e.target.value)}
            maxLength={50}
            placeholder="Search modes..."
            aria-label="Search modes"
            className={`${inputClass} pl-9`}
            style={inputStyle}
          />
        </div>
        <div className="hidden md:block">
          <ViewToggle view={view} onChange={setView} />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportFile(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          className="rounded-xl"
          style={{ borderColor: BORDER }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} /> Import
        </Button>
        <Button
          variant="outline"
          className="rounded-xl"
          style={{ borderColor: BORDER }}
          onClick={handleExport}
        >
          <Download size={16} /> Export All
        </Button>
        <Button
          className="rounded-xl"
          style={{ backgroundColor: RUST, color: "var(--on-brand)" }}
          onClick={openAdd}
        >
          <Plus size={17} /> Add Custom Mode
        </Button>
      </div>

      {filteredModes.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-12 text-center"
          style={{
            backgroundColor: "var(--surface-app)",
            border: `var(--border-width-hairline) dashed ${BORDER}`,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-body)",
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-normal)",
              color: TEXT,
            }}
          >
            No modes match "{modeSearch}"
          </p>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-body-sm)",
              fontWeight: "var(--weight-regular)",
              lineHeight: "var(--leading-normal)",
              color: MUTED,
            }}
          >
            Try a different name, or add it as a custom mode.
          </p>
        </div>
      ) : isMobile || view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredModes.map((m) => {
            const candling = computeCandling(m.incubationDays);
            return (
              <div
                key={m.id}
                className="rounded-2xl p-4"
                style={{
                  border: `var(--border-width-hairline) solid ${BORDER}`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3
                    id={`mode-card-${m.id}`}
                    className="min-w-0 break-words"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-body)",
                      fontWeight: "var(--weight-bold)",
                      lineHeight: "var(--leading-normal)",
                      color: TEXT,
                    }}
                  >
                    {m.name}
                  </h3>
                  {badge(m)}
                </div>
                <div
                  className="mt-3 space-y-2"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-body-sm)",
                    fontWeight: "var(--weight-regular)",
                    lineHeight: "var(--leading-normal)",
                    color: TEXT,
                  }}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className="flex items-center gap-1.5"
                      style={{ color: MUTED }}
                    >
                      <Thermometer size={14} /> Temp
                    </span>
                    {m.targetTemp.min} to {m.targetTemp.max}°C
                  </span>
                  <span className="flex items-center justify-between">
                    <span
                      className="flex items-center gap-1.5"
                      style={{ color: MUTED }}
                    >
                      <Droplets size={14} /> Humidity
                    </span>
                    {m.targetHumidity.min} to {m.targetHumidity.max}%
                  </span>
                  <span className="flex items-center justify-between">
                    <span
                      className="flex items-center gap-1.5"
                      style={{ color: MUTED }}
                    >
                      <CalendarDays size={14} /> Duration
                    </span>
                    {m.incubationDays} days
                  </span>
                  <span className="flex items-center justify-between">
                    <span
                      className="flex items-center gap-1.5"
                      style={{ color: MUTED }}
                    >
                      <RotateCw size={14} /> Turn every
                    </span>
                    {m.defaultTurnInterval}h
                  </span>
                </div>
                <p
                  className="mt-2"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-caption)",
                    fontWeight: "var(--weight-regular)",
                    lineHeight: "var(--leading-normal)",
                    color: MUTED,
                  }}
                >
                  Candling days: {candling.map((c) => c.day).join(" / ")}
                </p>
                <div className="mt-4">
                  <ModeActions m={m} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: BORDER }}
        >
          <Table>
            <TableHeader style={{ backgroundColor: "var(--surface-tile)" }}>
              <TableRow>
                {[
                  "MODE NAME",
                  "TEMP RANGE",
                  "HUMIDITY RANGE",
                  "DURATION",
                  "TURN EVERY",
                  "CANDLING DAYS",
                  "ACTIONS",
                ].map((h) => (
                  <TableHead
                    key={h}
                    style={{
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--type-label)",
                      fontWeight: "var(--weight-bold)",
                      letterSpacing: "var(--tracking-label)",
                      lineHeight: "var(--leading-snug)",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredModes.map((m) => {
                const candling = computeCandling(m.incubationDays);
                return (
                  <TableRow key={m.id}>
                    <TableCell
                      aria-label={`Candling days: ${candling
                        .map((c) => c.day)
                        .join(", ")}`}
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-body-sm)",
                        fontWeight: "var(--weight-bold)",
                        lineHeight: "var(--leading-normal)",
                        color: TEXT,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        {badge(m)}
                      </div>
                    </TableCell>
                    <TableCell
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-body-sm)",
                        fontWeight: "var(--weight-regular)",
                        lineHeight: "var(--leading-normal)",
                        color: TEXT,
                      }}
                    >
                      {m.targetTemp.min} to {m.targetTemp.max}°C
                    </TableCell>
                    <TableCell
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-body-sm)",
                        fontWeight: "var(--weight-regular)",
                        lineHeight: "var(--leading-normal)",
                        color: TEXT,
                      }}
                    >
                      {m.targetHumidity.min} to {m.targetHumidity.max}%
                    </TableCell>
                    <TableCell
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-body-sm)",
                        fontWeight: "var(--weight-regular)",
                        lineHeight: "var(--leading-normal)",
                        color: TEXT,
                      }}
                    >
                      {m.incubationDays} days
                    </TableCell>
                    <TableCell
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-body-sm)",
                        fontWeight: "var(--weight-regular)",
                        lineHeight: "var(--leading-normal)",
                        color: TEXT,
                      }}
                    >
                      Every {m.defaultTurnInterval}h
                    </TableCell>
                    <TableCell
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--type-body-sm)",
                        fontWeight: "var(--weight-regular)",
                        lineHeight: "var(--leading-normal)",
                        color: MUTED,
                      }}
                    >
                      {candling.map((c) => c.day).join(" / ")}
                    </TableCell>
                    <TableCell>
                      <ModeActions m={m} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="rounded-xl md:max-w-sm">
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--type-heading-md)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              Delete mode?
            </DialogTitle>
            <DialogDescription>
              "{deleteTarget?.name}" will be permanently removed from your Mode
              library. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={isMutating}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              style={{ backgroundColor: CRIT, color: "var(--on-brand)" }}
              disabled={isMutating}
              aria-busy={isMutating}
              onClick={() => void confirmDelete()}
            >
              <Trash2 size={15} /> {isMutating ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / Add Mode modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="rounded-xl md:max-w-md">
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--type-heading-md)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              {modalKind === "edit" ? "Edit Mode" : "Add custom Mode"}
            </DialogTitle>
            <DialogDescription>
              Candling checkpoints are auto-calculated from the duration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Mode name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                maxLength={30}
                placeholder="Turkey"
                className={`mt-1.5 ${inputClass}`}
                style={inputStyle}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {draftField(
                "Temp min °C",
                draft.tempMin,
                (n) => setDraft({ ...draft, tempMin: n }),
                { step: 0.1, min: 30, max: 42 },
              )}
              {draftField(
                "Temp max °C",
                draft.tempMax,
                (n) => setDraft({ ...draft, tempMax: n }),
                { step: 0.1, min: 30, max: 42 },
              )}
              {draftField(
                "Hum min %",
                draft.humMin,
                (n) => setDraft({ ...draft, humMin: n }),
                { min: 30, max: 90 },
              )}
              {draftField(
                "Hum max %",
                draft.humMax,
                (n) => setDraft({ ...draft, humMax: n }),
                { min: 30, max: 90 },
              )}
              {draftField(
                "Duration (days)",
                draft.incubationDays,
                (n) => setDraft({ ...draft, incubationDays: n }),
                { min: 7, max: 45 },
              )}
              {draftField(
                "Turn every (h)",
                draft.defaultTurnInterval,
                (n) => setDraft({ ...draft, defaultTurnInterval: n }),
                { min: 1, max: 24 },
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={isMutating}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              style={{ backgroundColor: RUST, color: "var(--on-brand)" }}
              disabled={isMutating}
              aria-busy={isMutating}
              onClick={() => void saveModal()}
            >
              {isMutating ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import conflict resolution modal */}
      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent className="rounded-xl md:max-w-lg">
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--type-heading-md)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              Resolve name conflicts
            </DialogTitle>
            <DialogDescription>
              These imported modes share a name with an existing custom mode.
              Choose what to do with each.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {pendingClean.length > 0 && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-body-sm)",
                  fontWeight: "var(--weight-regular)",
                  lineHeight: "var(--leading-normal)",
                  color: MUTED,
                }}
              >
                {pendingClean.length} other mode
                {pendingClean.length === 1 ? "" : "s"} will be imported without
                conflict.
              </p>
            )}
            {conflicts.map((c, idx) => (
              <div
                key={c.incoming.id}
                className="rounded-2xl p-3"
                style={{ backgroundColor: "var(--surface-import)" }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-body)",
                    fontWeight: "var(--weight-bold)",
                    lineHeight: "var(--leading-normal)",
                    color: TEXT,
                  }}
                >
                  {c.incoming.name}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["overwrite", "rename"] as const).map((r) => {
                    const active = c.resolution === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setConflicts((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, resolution: r } : x,
                            ),
                          )
                        }
                        className="min-h-[var(--control-height-default)] cursor-pointer rounded-full px-3 py-1.5 transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 md:min-h-8"
                        style={{
                          backgroundColor: active
                            ? RUST
                            : "var(--surface-card)",
                          color: active
                            ? "var(--on-brand)"
                            : "var(--status-info-fg)",
                          border: `var(--border-width-hairline) solid ${active ? RUST : BORDER}`,
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--type-body-sm)",
                          fontWeight: "var(--weight-semibold)",
                          lineHeight: "var(--leading-normal)",
                        }}
                      >
                        {r === "overwrite"
                          ? "Overwrite existing"
                          : "Keep both (rename)"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={isMutating}
              onClick={() => setConflictOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              style={{ backgroundColor: RUST, color: "var(--on-brand)" }}
              disabled={isMutating}
              aria-busy={isMutating}
              onClick={() => void applyImport()}
            >
              {isMutating ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
