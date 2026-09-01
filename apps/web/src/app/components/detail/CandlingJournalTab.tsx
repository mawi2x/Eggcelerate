import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  Check, CheckCircle2, Circle, AlertCircle, X,
  Camera, Plus, Trash2, Pencil, ChevronDown, ArrowLeft, ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Incubator, Mode, CandlingLogEntry, CandlingCheckpoint, DevelopmentCheck, developmentCheckLabels,
  calculateFertilityRate,
} from "../../data/mockData";
import {
  CandleForm, TallyKey,
  RUST, RUST_NODE, BG, CARD, SURFACE, BORDER, TEXT, MUTED, INPUT_BORDER, RADIUS, SHADOW,
  OK, WARN, CANDLE_SHORT_LABELS, MAX_PHOTO_BYTES, NOTES_MAX,
  emptyForm, formatNodeDay, fmtTimestamp,
} from "./types";
import { SectionCard, StatusCallout } from "./primitives";
import { PhotoLightboxModal } from "./PhotoLightbox";
import { IncubationCalendar } from "./IncubationCalendar";
import { Timeline } from "./Timeline";

// ─── Candling feed journal card ──────────────────────────────────────────────
export function JournalEntryCard({
  entry,
  onAddPhotos,
  onUpdateNote,
  onDeletePhoto,
}: {
  entry: CandlingLogEntry;
  onAddPhotos: (day: number, urls: string[]) => void;
  onUpdateNote: (day: number, note: string) => void;
  onDeletePhoto: (day: number, photoIndex: number) => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const [noteDraft, setNoteDraft] = useState(entry.note);
  const [noteEditing, setNoteEditing] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const readFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: File[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" is not an image. File skipped.`);
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`"${file.name}" is over 5 MB. File skipped.`);
        return;
      }
      accepted.push(file);
    });
    if (accepted.length === 0) return;
    const urls: string[] = [];
    let loaded = 0;
    accepted.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) urls.push(e.target.result as string);
        loaded++;
        if (loaded === accepted.length) onAddPhotos(entry.day, urls);
      };
      reader.readAsDataURL(file);
    });
  };

  const photos = (entry.photos || []).filter((p) => typeof p === "string" && p.trim().length > 0);
  const hasOverflow = photos.length > 4;
  const visiblePhotos = hasOverflow ? photos.slice(0, 3) : photos.slice(0, 4);
  const overflowCount = photos.length - 3;
  const isLaterEntry =
    entry.checkpointType === "later" ||
    entry.developing !== undefined ||
    entry.stoppedDeveloping !== undefined;
  const developing = entry.developing ?? entry.fertile;
  const stoppedDeveloping = entry.stoppedDeveloping ?? 0;

  return (
    <>
      <Card style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW }}>
        <CardContent style={{ padding: 18 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-primary)", marginBottom: 8 }}>
            Candling Status
          </p>

          {/* Flat stat chips */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-block whitespace-nowrap"
              style={{
                backgroundColor: "#DCFCE7",
                color: "#15803D",
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {isLaterEntry ? developing : entry.fertile} {isLaterEntry ? "Developing" : "Fertile"}
            </span>
            <span
              className="inline-block whitespace-nowrap"
              style={{
                backgroundColor: "#F1F5F9",
                color: "#475569",
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {entry.clear} Clear
            </span>
            <span
              className="inline-block whitespace-nowrap"
              style={{
                backgroundColor: "#FEF3C7",
                color: "#B45309",
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {entry.uncertain} Uncertain
            </span>
            {isLaterEntry && (
              <span
                className="inline-block whitespace-nowrap"
                style={{
                  backgroundColor: "#FEE2E2",
                  color: "#991B1B",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {stoppedDeveloping} Stopped Developing
              </span>
            )}
          </div>

          {/* Development checklist tags */}
          {entry.checks.length > 0 && (
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              {entry.checks.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1"
                  style={{ backgroundColor: "#FFFFFF", border: `1px solid ${BORDER}`, color: "#3D3228", fontSize: 11, fontWeight: 600 }}
                >
                  <Check size={12} color={OK.fg} strokeWidth={3} /> {developmentCheckLabels[c]}
                </span>
              ))}
            </div>
          )}

          {/* Note Section */}
          <span className="block" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-primary)", marginBottom: 6 }}>
            Note:
          </span>

          <div className="space-y-3">
            <div className="w-full">
              {noteEditing ? (
                <>
                  <textarea
                    value={noteDraft}
                    autoFocus
                    onChange={(e) => setNoteDraft(e.target.value.slice(0, NOTES_MAX))}
                    maxLength={NOTES_MAX}
                    placeholder="Add observations: veining, air cell development, movement"
                    rows={3}
                    className="w-full resize-none rounded-xl px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                    style={{ border: `1px solid ${INPUT_BORDER}`, backgroundColor: "#F2EEE5", fontSize: 13, color: TEXT }}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" className="rounded-full" onClick={() => { setNoteDraft(entry.note); setNoteEditing(false); }}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full"
                      style={{ backgroundColor: RUST, color: "#fff" }}
                      onClick={() => {
                        onUpdateNote(entry.day, noteDraft);
                        setNoteEditing(false);
                        toast.success("Note saved");
                      }}
                    >
                      Save note
                    </Button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setNoteEditing(true)}
                  className="w-full rounded-xl px-3.5 py-3 text-left transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{
                    backgroundColor: "#FAF9F6",
                    border: `1px solid ${BORDER}`,
                    borderLeft: `3px solid var(--brand-primary)`,
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                  aria-label="Edit inspector notes"
                >
                  {entry.note ? (
                    <span className="block" style={{ fontSize: 13, fontStyle: "italic", color: "#44403C", lineHeight: 1.45 }}>
                      {entry.note}
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: MUTED }}>
                      + Add note observations…
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Photo Thumbnails Grid */}
            <div className="flex flex-wrap items-center gap-2">
              {visiblePhotos.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLightboxIndex(i);
                  }}
                  className="relative overflow-hidden rounded-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2"
                  style={{ width: 56, height: 56, border: `1px solid ${BORDER}`, cursor: "pointer" }}
                  aria-label={`View photo ${i + 1}`}
                >
                  <img
                    src={url}
                    alt={`Candling photo ${i + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </button>
              ))}

              {hasOverflow && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLightboxIndex(3);
                  }}
                  className="relative overflow-hidden rounded-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2"
                  style={{ width: 56, height: 56, border: `1px solid ${BORDER}`, cursor: "pointer" }}
                  aria-label={`View all ${photos.length} photos`}
                >
                  <img
                    src={photos[3]}
                    alt="Additional candling photos"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center font-bold text-white backdrop-blur-[1px]"
                    style={{ backgroundColor: "rgba(0, 0, 0, 0.60)", fontSize: 13 }}
                  >
                    +{overflowCount}
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="flex flex-col items-center justify-center gap-0.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 transition-colors hover:bg-stone-50"
                style={{ width: 56, height: 56, border: `1.5px dashed #C9B182`, backgroundColor: SURFACE, cursor: "pointer" }}
                aria-label="Add candling photo"
              >
                <Plus size={15} color={MUTED} />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-semibold)",
                    letterSpacing: "var(--tracking-label)",
                    color: MUTED,
                  }}
                >
                  Photo
                </span>
              </button>
              <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => readFiles(e.target.files)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <PhotoLightboxModal
        open={lightboxIndex !== null}
        photos={photos}
        initialIndex={lightboxIndex ?? 0}
        day={entry.day}
        onClose={() => setLightboxIndex(null)}
        onDelete={(idx) => onDeletePhoto(entry.day, idx)}
      />
    </>
  );
}

// ─── LogModal Dialog ────────────────────────────────────────────────────────
type LogStage = 1 | 2 | 3;

const LOG_STAGES: { id: LogStage; label: string; description: string }[] = [
  { id: 1, label: "Checkpoint", description: "Choose the inspection day." },
  { id: 2, label: "Egg counts", description: "Record what you observed." },
  { id: 3, label: "Observations", description: "Add notes, checks, or photos." },
];

export function LogModal({
  open,
  onOpenChange,
  candling,
  candled,
  currentDay,
  totalDays,
  totalEggsSet,
  chamberName,
  modeName,
  initialEntry,
  previousEntry,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candling: { day: number; label: string; dayRange: string }[];
  candled: Record<number, boolean>;
  currentDay: number;
  totalDays: number;
  totalEggsSet: number;
  chamberName: string;
  modeName: string;
  initialEntry?: CandlingLogEntry | null;
  previousEntry?: CandlingLogEntry | null;
  onSubmit: (form: CandleForm) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] overflow-y-auto p-0 shadow-2xl sm:max-w-[600px]"
        style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}
      >
        <LogModalBody
          candling={candling}
          candled={candled}
          currentDay={currentDay}
          totalDays={totalDays}
          totalEggsSet={totalEggsSet}
          chamberName={chamberName}
          modeName={modeName}
          initialEntry={initialEntry}
          previousEntry={previousEntry}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function LogModalBody({
  candling,
  candled,
  currentDay,
  totalDays,
  totalEggsSet,
  chamberName,
  modeName,
  initialEntry,
  previousEntry,
  onSubmit,
  onCancel,
}: {
  candling: { day: number; label: string; dayRange: string }[];
  candled: Record<number, boolean>;
  currentDay: number;
  totalDays: number;
  totalEggsSet: number;
  chamberName: string;
  modeName: string;
  initialEntry?: CandlingLogEntry | null;
  previousEntry?: CandlingLogEntry | null;
  onSubmit: (form: CandleForm) => void;
  onCancel: () => void;
}) {
  const isEditing = !!initialEntry;
  const available = candling.filter((c) => !candled[c.day] || (initialEntry && c.day === initialEntry.day));
  const photoRef = useRef<HTMLInputElement>(null);

  const defaultCustomDay = String(Math.min(totalDays, currentDay > 0 ? currentDay : 8));
  const initialOpt = initialEntry
    ? String(initialEntry.day)
    : available[0]
    ? String(available[0].day)
    : "custom";

  const [selectedOption, setSelectedOption] = useState<string>(
    initialEntry && !candling.some((c) => c.day === initialEntry.day) ? "custom" : initialOpt
  );
  const [customDayRaw, setCustomDayRaw] = useState<string>(
    initialEntry ? String(initialEntry.day) : defaultCustomDay
  );

  const defaultTargetDay = initialEntry
    ? initialEntry.day
    : available[0]?.day ?? Number(defaultCustomDay);

  const initialForm: CandleForm = initialEntry
    ? {
        targetDay: initialEntry.day,
        date: initialEntry.date,
        fertile: initialEntry.fertile,
        clear: initialEntry.clear,
        uncertain: initialEntry.uncertain,
        developing: initialEntry.developing ?? initialEntry.fertile,
        stoppedDeveloping: initialEntry.stoppedDeveloping ?? 0,
        checkpointType: initialEntry.checkpointType ?? (initialEntry.day > (candling[0]?.day ?? 1) ? "later" : "first"),
        note: initialEntry.note,
        photos: initialEntry.photos,
        checks: initialEntry.checks,
      }
    : {
        ...emptyForm(defaultTargetDay, previousEntry ?? undefined),
        checkpointType: defaultTargetDay > (candling[0]?.day ?? 1) ? "later" : "first",
      };

  const [form, setForm] = useState<CandleForm>(initialForm);
  const [dragging, setDragging] = useState(false);
  const [emptyEvidenceWarningOpen, setEmptyEvidenceWarningOpen] = useState(false);
  const [stage, setStage] = useState<LogStage>(isEditing ? 2 : 1);
  const stageHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    stageHeadingRef.current?.focus();
  }, [stage]);

  const customDayNum = Number(customDayRaw);
  const isCustomDayValid =
    selectedOption !== "custom" ||
    (customDayRaw.trim() !== "" &&
      !isNaN(customDayNum) &&
      customDayNum >= 1 &&
      customDayNum <= totalDays);
  const customDayError = selectedOption === "custom" && !isCustomDayValid;

  const firstCheckpointDay = candling[0]?.day ?? 1;
  const isLaterCheckpoint = form.checkpointType === "later" || form.targetDay > firstCheckpointDay;
  const isLockdownCheckpoint = form.targetDay === candling[2]?.day;
  const hasUnresolvedUncertain = isLockdownCheckpoint && form.uncertain > 0;
  const inspected = isLaterCheckpoint
    ? form.developing + form.clear + form.uncertain + form.stoppedDeveloping
    : form.fertile + form.clear + form.uncertain;
  const unaccountedEggs = Math.max(0, totalEggsSet - inspected);
  const isTallyOverCapacity = inspected > totalEggsSet;
  const isZeroTally = inspected === 0;
  const hasEvidence = form.note.trim().length > 0 || form.photos.length > 0;
  const hasIncompleteLockdown = isLockdownCheckpoint && (hasUnresolvedUncertain || unaccountedEggs > 0);

  const isSaveDisabled = isZeroTally || isTallyOverCapacity || customDayError || hasIncompleteLockdown;

  const handleSave = () => {
    if (!hasEvidence) {
      setEmptyEvidenceWarningOpen(true);
      return;
    }
    onSubmit(form);
  };

  const readFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: File[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" is not an image. File skipped.`);
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`"${file.name}" is over 5 MB. File skipped.`);
        return;
      }
      accepted.push(file);
    });
    if (accepted.length === 0) return;
    const urls: string[] = [];
    let loaded = 0;
    accepted.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) urls.push(e.target.result as string);
        loaded++;
        if (loaded === accepted.length) setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    readFiles(e.dataTransfer.files);
  }, []);

  const target = candling.find((c) => c.day === form.targetDay);

  const setCount = (key: TallyKey, raw: string) => {
    const clean = raw.replace(/[^0-9]/g, "").slice(0, 3);
    setForm((f) => ({ ...f, [key]: Math.min(totalEggsSet, Number(clean) || 0) }));
  };

  const tallyFields: { key: TallyKey; label: string; color: string }[] = isLaterCheckpoint
    ? [
        { key: "developing", label: "Developing", color: "#166534" },
        { key: "clear", label: "Clear", color: "#334155" },
        { key: "stoppedDeveloping", label: "Stopped Developing", color: "#991B1B" },
        { key: "uncertain", label: "Uncertain or Not sure", color: "#92400E" },
      ]
    : [
        { key: "fertile", label: "Fertile", color: "#166534" },
        { key: "clear", label: "Clear", color: "#334155" },
        { key: "uncertain", label: "Uncertain", color: "#92400E" },
      ];

  const countRemainingAsUncertain = () => {
    if (unaccountedEggs <= 0) return;
    setForm((current) => ({
      ...current,
      uncertain: Math.min(totalEggsSet, current.uncertain + unaccountedEggs),
    }));
  };

  const canAdvance = stage === 1
    ? !customDayError
    : !isZeroTally && !isTallyOverCapacity && !hasIncompleteLockdown && unaccountedEggs === 0;

  const goToNextStage = () => {
    if (!canAdvance) return;
    setStage((current) => (current < 3 ? (current + 1) as LogStage : current));
  };

  return (
    <>
      <DialogHeader className="px-5 pt-5 text-left">
        <DialogTitle style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-md)", fontWeight: "var(--weight-bold)", lineHeight: "var(--leading-snug)", color: TEXT }}>
          {isEditing ? `Edit Inspection Log: Day ${form.targetDay}` : "Candling Journal"}
        </DialogTitle>
        <DialogDescription className="text-xs font-medium space-y-0.5">
          <span className="block" style={{ color: TEXT }}>{chamberName}</span>
          <span className="block" style={{ color: MUTED }}>{modeName}</span>
        </DialogDescription>
      </DialogHeader>

      <nav className="px-5 pt-1" aria-label="Candling log steps">
        <ol className="grid grid-cols-3 gap-2">
          {LOG_STAGES.map((item) => {
            const active = stage === item.id;
            const completed = stage > item.id;
            return (
              <li key={item.id} aria-current={active ? "step" : undefined}>
                <div
                  className="flex min-h-11 items-center gap-2 rounded-xl border px-2.5 py-2"
                  style={{
                    borderColor: active ? RUST : completed ? OK.fg : BORDER,
                    backgroundColor: active ? `${RUST}12` : completed ? OK.bg : SURFACE,
                  }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: active ? RUST : completed ? OK.fg : "transparent",
                      border: active || completed ? "none" : `1px solid ${BORDER}`,
                      color: active || completed ? "#FFFFFF" : MUTED,
                    }}
                    aria-hidden="true"
                  >
                    {completed ? <Check size={13} strokeWidth={3} /> : item.id}
                  </span>
                  <span className="min-w-0" style={{ color: active ? RUST : TEXT, fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}>
                    {item.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="px-5 pt-1" aria-live="polite">
        <h3
          ref={stageHeadingRef}
          tabIndex={-1}
          className="focus-visible:outline-none"
          style={{ color: TEXT, fontSize: 14, fontWeight: 700 }}
        >
          {stage}. {LOG_STAGES[stage - 1].label}
        </h3>
        <p className="mt-0.5" style={{ color: MUTED, fontSize: 12 }}>
          {LOG_STAGES[stage - 1].description}
        </p>
      </div>

      <div className="space-y-4 px-5 pb-1">
        {stage === 1 && (
        <div>
          <Label style={{ fontSize: 13, color: TEXT }}>Checkpoint</Label>
          {isEditing ? (
            <div
              className="mt-1.5 flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>
                {target?.label ?? `Day ${form.targetDay} Candling`} (Day {form.targetDay})
              </span>
              <span className="rounded-full px-2 py-0.5" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                LOCKED
              </span>
            </div>
          ) : (
            <Select
              value={selectedOption}
              onValueChange={(val) => {
                setSelectedOption(val);
                if (val === "custom") {
                  const day = Number(customDayRaw) || 1;
                  setForm((f) => ({ ...f, targetDay: day }));
                } else {
                  const day = Number(val);
                  setForm((f) => ({ ...f, targetDay: day }));
                }
              }}
            >
              <SelectTrigger className="mt-1.5 rounded-xl" style={{ borderColor: INPUT_BORDER, backgroundColor: SURFACE }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {available.map((c) => (
                  <SelectItem key={c.day} value={String(c.day)}>{c.label} (Day {c.day})</SelectItem>
                ))}
                <SelectItem value="custom">Custom Day...</SelectItem>
              </SelectContent>
            </Select>
          )}

          {!isEditing && selectedOption === "custom" && (
            <div className="mt-3">
              <Label htmlFor="custom-day-input" style={{ fontSize: 13, color: TEXT }}>
                Day Number
              </Label>
              <div className="mt-1.5 flex items-center gap-2">
                <span style={{ fontSize: 14, fontWeight: 600, color: MUTED }}>Day</span>
                <Input
                  id="custom-day-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={customDayRaw}
                  onKeyDown={(e) => {
                    if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
                  }}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                    setCustomDayRaw(sanitized);
                    const val = Number(sanitized) || 0;
                    setForm((f) => ({ ...f, targetDay: val }));
                  }}
                  placeholder="8"
                  className="w-24 rounded-xl"
                  style={{
                    borderColor: customDayError ? "var(--status-danger-fg)" : INPUT_BORDER,
                    backgroundColor: SURFACE,
                    color: TEXT,
                  }}
                />
              </div>
              {customDayError && (
                <p className="mt-1.5 flex items-center gap-1" style={{ fontSize: 12, color: "var(--status-danger-fg)", fontWeight: 600 }}>
                  <AlertCircle size={13} /> Day must be between 1 and {totalDays}
                </p>
              )}
            </div>
          )}

          {!isEditing && selectedOption !== "custom" && target && target.day > currentDay && (
            <p className="mt-1.5 rounded-lg px-2.5 py-1.5" style={{ fontSize: 12, color: WARN.fg, backgroundColor: WARN.bg }}>
              Not yet due. This is Day {target.day}. You can still log it if candling was performed early.
            </p>
          )}
        </div>
        )}

        {/* Tally inputs */}
        {stage === 2 && (
        <div>
          <Label style={{ fontSize: 13, color: TEXT }}>
            {isLaterCheckpoint ? "Development tally" : "Fertility tally"}
          </Label>
          <p className="mt-1" style={{ fontSize: 12, color: MUTED }}>
            {isLaterCheckpoint
              ? "Classify every egg as developing, clear, stopped developing, or uncertain."
              : "Record the first candling result for each egg."}
          </p>
          <div className="mt-3 space-y-2.5" role="group" aria-label="Egg category counts">
            <div
              className="flex items-center justify-between px-3 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: MUTED }}
            >
              <span>Category</span>
              <span>Eggs</span>
            </div>
            {tallyFields.map((f) => (
              <div
                key={f.key}
                className="flex min-h-14 items-center justify-between gap-4 rounded-xl border px-3.5 py-2.5"
                style={{ backgroundColor: SURFACE, borderColor: BORDER }}
              >
                <label
                  htmlFor={`tally-${f.key}`}
                  className="min-w-0 leading-5"
                  style={{ color: f.color, fontSize: 13, fontWeight: 700 }}
                >
                  {f.label}
                </label>
                <Input
                  id={`tally-${f.key}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={form[f.key] === 0 ? "" : String(form[f.key])}
                  onKeyDown={(e) => {
                    if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
                  }}
                  onChange={(e) => setCount(f.key, e.target.value)}
                  placeholder="0"
                  aria-invalid={isTallyOverCapacity ? "true" : undefined}
                  aria-describedby={isTallyOverCapacity ? "tally-count-error" : undefined}
                  className="h-11 w-28 shrink-0 rounded-xl text-center"
                  style={{
                    borderColor: isTallyOverCapacity ? "var(--status-danger-fg)" : INPUT_BORDER,
                    backgroundColor: SURFACE,
                    color: TEXT,
                  }}
                />
              </div>
            ))}
          </div>

          {isTallyOverCapacity ? (
            <StatusCallout
              size="sm"
              tone="danger"
              title="Too many eggs counted."
              description={
                <>
                  Total counted: <strong className="font-bold">{inspected} of {totalEggsSet}</strong>. Reduce one or more categories before continuing.
                </>
              }
              className="mt-3"
            />
          ) : isZeroTally ? (
            <StatusCallout
              size="sm"
              tone="warning"
              title="Enter at least one egg count"
              description="Record the count for fertile, clear, or uncertain eggs to continue."
              className="mt-3"
            />
          ) : hasIncompleteLockdown ? (
            <StatusCallout
              size="sm"
              tone="danger"
              title="Lockdown check incomplete"
              description={
                hasUnresolvedUncertain && unaccountedEggs > 0
                  ? "Resolve uncertain eggs and categorize every egg before the Lockdown check."
                  : hasUnresolvedUncertain
                    ? "Resolve all uncertain eggs before the Lockdown check."
                    : "Categorize every egg before the Lockdown check."
              }
              className="mt-3"
            />
          ) : unaccountedEggs > 0 ? (
            <StatusCallout
              size="sm"
              tone="warning"
              title={`${unaccountedEggs} egg${unaccountedEggs === 1 ? " is" : "s are"} not categorized yet.`}
              description="Add the remaining count before continuing, or mark the remaining eggs as uncertain."
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="w-full cursor-pointer rounded-lg transition-colors hover:bg-[#FFF8E1] active:bg-[#FEF3C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  onClick={countRemainingAsUncertain}
                  style={{ borderColor: WARN.fg, color: WARN.fg, fontSize: 12 }}
                >
                  Count remaining as uncertain
                </Button>
              }
              className="mt-3"
            />
          ) : (
            <StatusCallout
              size="sm"
              tone="success"
              title="All eggs categorized"
              description={
                <>
                  <strong className="font-bold">{inspected} of {totalEggsSet}</strong> eggs accounted for.
                </>
              }
              className="mt-3"
            />
          )}
        </div>
        )}

        {/* Development checks */}
        {stage === 3 && (
        <>
        <div>
          <Label style={{ fontSize: 13, color: TEXT }}>Development observed</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(Object.keys(developmentCheckLabels) as DevelopmentCheck[]).map((c) => {
              const on = form.checks.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, checks: on ? form.checks.filter((x) => x !== c) : [...form.checks, c] })}
                  aria-pressed={on}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{
                    backgroundColor: on ? OK.bg : SURFACE,
                    border: `1px solid ${on ? OK.fg : BORDER}`,
                    color: on ? "#166534" : MUTED,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {on ? <Check size={13} strokeWidth={3} /> : <Circle size={13} />}
                  {developmentCheckLabels[c]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="lf-note" style={{ fontSize: 13, color: TEXT }}>Notes</Label>
          <textarea
            id="lf-note"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Observation notes…"
            rows={3}
            className="mt-1.5 w-full resize-none rounded-xl px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ border: `1px solid ${INPUT_BORDER}`, backgroundColor: SURFACE, fontSize: 14, color: TEXT }}
          />
        </div>

        {/* Photos */}
        <div>
          <Label style={{ fontSize: 13, color: TEXT }}>Photos</Label>
          <div
            onClick={() => photoRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl py-5"
            style={{
              border: `1.5px dashed ${dragging ? RUST : "#C9B182"}`,
              backgroundColor: dragging ? `${RUST}0A` : SURFACE,
              transition: "border-color 0.15s, background-color 0.15s",
            }}
          >
            <Camera size={20} color={dragging ? RUST : "#9E8B72"} />
            <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>Add photos from candling</span>
            <span style={{ color: MUTED, fontSize: 12 }}>Click or drag &amp; drop</span>
          </div>
          <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => readFiles(e.target.files)} />
          {form.photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {form.photos.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="rounded-lg object-cover" style={{ width: 60, height: 60, border: `1px solid ${BORDER}` }} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setForm((f) => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }));
                    }}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-transform active:scale-95"
                    aria-label="Remove photo"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {!hasEvidence && !isSaveDisabled && (
          <StatusCallout
            size="sm"
            tone="info"
            title="No notes or photos attached."
            description="You can still save this inspection with the egg tally only."
            className="mt-3"
          />
        )}

        <StatusCallout
          size="sm"
          tone="success"
          title="All eggs categorized"
          description={
            <>
              <strong className="font-bold">{inspected} of {totalEggsSet}</strong> eggs accounted for.
            </>
          }
          className="mt-2.5"
        />
        </>
        )}
      </div>

      <div
        className="sticky bottom-0 px-5 py-4"
        style={{ backgroundColor: CARD, borderTop: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            className="rounded-full"
            onClick={() => stage === 1 ? onCancel() : setStage((current) => (current - 1) as LogStage)}
          >
            {stage === 1 ? "Cancel" : <><ArrowLeft size={15} /> Back</>}
          </Button>
          {stage < 3 ? (
            <Button
              className="rounded-full"
              style={{ backgroundColor: RUST, color: "#fff", opacity: canAdvance ? 1 : 0.5 }}
              disabled={!canAdvance}
              onClick={goToNextStage}
            >
              Next <ArrowRight size={15} />
            </Button>
          ) : (
            <Button
              className="rounded-full"
              style={{ backgroundColor: RUST, color: "#fff", opacity: isSaveDisabled ? 0.5 : 1 }}
              disabled={isSaveDisabled}
              onClick={handleSave}
            >
              <CheckCircle2 size={15} /> {isEditing ? "Update Inspection" : "Save Inspection"}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={emptyEvidenceWarningOpen} onOpenChange={setEmptyEvidenceWarningOpen}>
        <AlertDialogContent
          className="rounded-2xl border-[var(--border-default)]"
          style={{ backgroundColor: CARD, color: TEXT }}
        >
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle style={{ color: TEXT, fontSize: 18, fontWeight: 700 }}>
              Save without notes or photos?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="mt-2">
                <StatusCallout
                  size="sm"
                  tone="info"
                  title="Tally only inspection"
                  description="No comments or images are attached. This will record the egg tally only. Are you sure you want to save this candling journal?"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" style={{ borderColor: BORDER, color: MUTED }}>
              Go back
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              style={{ backgroundColor: RUST, color: "#FFFFFF" }}
              onClick={() => onSubmit(form)}
            >
              Save inspection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Main CandlingJournalTab Component ───────────────────────────────────────
interface CandlingJournalTabProps {
  unit: Incubator;
  mode: Mode;
  candling: CandlingCheckpoint[];
  effectiveCandled: Record<number, boolean>;
  currentDay: number;
  totalDays: number;
  totalEggsSet: number;
  onUpdate: (patch: Partial<Incubator>) => void;
}

export function CandlingJournalTab({
  unit,
  mode,
  candling,
  effectiveCandled,
  currentDay,
  totalDays,
  totalEggsSet,
  onUpdate,
}: CandlingJournalTabProps) {
  const [showLogForm, setShowLogForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CandlingLogEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<CandlingLogEntry | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(() => new Set());

  const loggedEntries = [...unit.candlingLog].sort((a, b) => b.day - a.day);
  const latestCandlingEntry = loggedEntries[0] ?? null;

  const summaryFertilityRate = latestCandlingEntry
    ? calculateFertilityRate(latestCandlingEntry.fertile, totalEggsSet)
    : null;

  const isLaterSummary =
    latestCandlingEntry &&
    (latestCandlingEntry.checkpointType === "later" ||
      latestCandlingEntry.developing !== undefined ||
      latestCandlingEntry.stoppedDeveloping !== undefined);
  const summaryDeveloping = latestCandlingEntry?.developing ?? latestCandlingEntry?.fertile ?? 0;
  const summaryStopped = latestCandlingEntry?.stoppedDeveloping ?? 0;
  const summaryClear = latestCandlingEntry?.clear ?? 0;
  const summaryUncertain = latestCandlingEntry?.uncertain ?? 0;
  const pendingCheckpoint =
    candling.find((checkpoint) => checkpoint.day <= currentDay && !effectiveCandled[checkpoint.day]) ??
    candling.find((checkpoint) => checkpoint.day > currentDay && !effectiveCandled[checkpoint.day]) ??
    null;
  const checkpointDistance = pendingCheckpoint ? pendingCheckpoint.day - currentDay : null;
  const checkpointTiming = checkpointDistance === null
    ? "All scheduled checks completed"
    : checkpointDistance < 0
      ? `${Math.abs(checkpointDistance)} day${Math.abs(checkpointDistance) === 1 ? "" : "s"} overdue`
      : checkpointDistance === 0
        ? "Due today"
        : `In ${checkpointDistance} day${checkpointDistance === 1 ? "" : "s"}`;
  const openNewInspection = () => {
    setEditingEntry(null);
    setShowLogForm(true);
  };

  const feedNodes: ({ kind: "logged"; day: number; entry: CandlingLogEntry; idx: number } | { kind: "milestone"; day: number; cp: CandlingCheckpoint; idx: number })[] = [];
  const coveredDays = new Set<number>();
  candling.forEach((cp, idx) => {
    const entry = unit.candlingLog.find((e) => e.day === cp.day);
    if (entry) {
      feedNodes.push({ kind: "logged", day: cp.day, entry, idx });
      coveredDays.add(cp.day);
    } else {
      feedNodes.push({ kind: "milestone", day: cp.day, cp, idx });
    }
  });
  unit.candlingLog.forEach((entry) => {
    if (!coveredDays.has(entry.day)) {
      feedNodes.push({ kind: "logged", day: entry.day, entry, idx: -1 });
    }
  });
  feedNodes.sort((a, b) => a.day - b.day);

  const deleteJournalEntry = (day: number) => {
    onUpdate({
      candled: { ...unit.candled, [day]: false },
      candlingLog: unit.candlingLog.filter((e) => e.day !== day),
    });
    toast.success(`Day ${day} journal entry deleted`);
  };

  const submitInspection = (form: CandleForm) => {
    const counts = {
      fertile: Math.max(0, Math.floor(Number(form.fertile) || 0)),
      clear: Math.max(0, Math.floor(Number(form.clear) || 0)),
      uncertain: Math.max(0, Math.floor(Number(form.uncertain) || 0)),
      developing: Math.max(0, Math.floor(Number(form.developing) || 0)),
      stoppedDeveloping: Math.max(0, Math.floor(Number(form.stoppedDeveloping) || 0)),
    };
    const checkpointType = form.targetDay > (candling[0]?.day ?? 1) ? "later" : "first";
    const inspected = checkpointType === "later"
      ? counts.developing + counts.clear + counts.uncertain + counts.stoppedDeveloping
      : counts.fertile + counts.clear + counts.uncertain;

    if (!Number.isInteger(form.targetDay) || form.targetDay < 1 || form.targetDay > totalDays) {
      toast.error(`Inspection day must be between Day 1 and Day ${totalDays}.`);
      return;
    }
    if (inspected < 1) {
      toast.error("Enter at least one egg count before saving the inspection.");
      return;
    }
    if (inspected > totalEggsSet) {
      toast.error(`The egg counts cannot exceed ${totalEggsSet} eggs loaded.`);
      return;
    }
    if (form.targetDay === candling[2]?.day && (counts.uncertain > 0 || inspected < totalEggsSet)) {
      toast.error(
        counts.uncertain > 0
          ? "Resolve all uncertain eggs before saving the Lockdown check."
          : `Categorize all ${totalEggsSet} eggs before saving the Lockdown check.`
      );
      return;
    }

    const c = candling.find((cp) => cp.day === form.targetDay);
    const label = c
      ? c.label
      : form.targetDay === candling[0]?.day
      ? "1st Candling"
      : form.targetDay === candling[1]?.day
      ? "2nd Candling"
      : form.targetDay === candling[2]?.day
      ? "Lockdown Check"
      : `Day ${form.targetDay} Candling`;

    const baselineFertile = editingEntry?.fertile
      ?? unit.fertileEggs
      ?? (counts.fertile > 0 ? counts.fertile : counts.developing);

    const entry: CandlingLogEntry = {
      day: form.targetDay,
      label,
      date: editingEntry?.date ?? new Date().toISOString().split("T")[0],
      fertile: checkpointType === "later" ? baselineFertile : counts.fertile,
      clear: counts.clear,
      uncertain: counts.uncertain,
      note: form.note.trim(),
      photos: form.photos,
      checks: form.checks,
      checkpointType,
      ...(checkpointType === "later"
        ? { developing: counts.developing, stoppedDeveloping: counts.stoppedDeveloping }
        : {}),
    };

    onUpdate({
      candled: { ...unit.candled, [form.targetDay]: true },
      fertileEggs: checkpointType === "first"
        ? counts.fertile
        : unit.fertileEggs ?? (baselineFertile || undefined),
      candlingLog: [entry, ...unit.candlingLog.filter((e) => e.day !== form.targetDay)],
    });

    const wasEditing = !!editingEntry;
    setShowLogForm(false);
    setEditingEntry(null);
    toast.success(wasEditing ? `Day ${entry.day} inspection updated` : `${label} saved`, {
      description: checkpointType === "later"
        ? `${entry.developing ?? 0} developing. ${entry.stoppedDeveloping ?? 0} stopped developing. ${entry.clear} clear.`
        : `${entry.fertile} fertile. ${entry.clear} clear. ${entry.uncertain} uncertain.`,
    });
  };

  const addPhotosToEntry = (day: number, urls: string[]) =>
    onUpdate({ candlingLog: unit.candlingLog.map((e) => (e.day === day ? { ...e, photos: [...e.photos, ...urls] } : e)) });

  const deletePhotoFromEntry = (day: number, photoIndex: number) =>
    onUpdate({
      candlingLog: unit.candlingLog.map((e) =>
        e.day === day ? { ...e, photos: e.photos.filter((_, idx) => idx !== photoIndex) } : e
      ),
    });

  const updateEntryNote = (day: number, note: string) =>
    onUpdate({ candlingLog: unit.candlingLog.map((e) => (e.day === day ? { ...e, note } : e)) });

  const rustBtn = { backgroundColor: RUST, color: "#fff" };

  return (
    <div className="space-y-5">
      {/* Combined Hero: Incubation Timeline + Candling Progress */}
      <SectionCard title="Incubation Timeline">
        <Timeline
          currentDay={currentDay}
          totalDays={totalDays}
          candling={candling}
          candled={effectiveCandled}
        />
        <div className="my-4" style={{ height: 1, backgroundColor: BORDER }} />
        {latestCandlingEntry ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-label)", fontWeight: "var(--weight-extrabold)", letterSpacing: "var(--tracking-label)", lineHeight: "var(--leading-snug)", color: RUST, textTransform: "uppercase" }}>
                  Latest inspection
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginTop: 2 }}>
                  Day {latestCandlingEntry.day} · {latestCandlingEntry.label}
                </p>
                <p style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>
                  Recorded {fmtTimestamp(latestCandlingEntry.date)}
                </p>
              </div>
              <div
                className="rounded-xl px-3.5 py-2 text-right"
                style={{ backgroundColor: "#F5EFE6", border: `1px solid ${BORDER}` }}
              >
                <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-label)", fontWeight: "var(--weight-extrabold)", letterSpacing: "var(--tracking-label)", lineHeight: "var(--leading-snug)", color: MUTED, textTransform: "uppercase" }}>
                  Initial fertility
                </p>
                <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginTop: 1 }}>
                  {latestCandlingEntry.fertile} of {totalEggsSet} eggs
                  <span style={{ marginLeft: 6, fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)", fontWeight: "var(--weight-extrabold)", lineHeight: "var(--leading-tight)", color: RUST }}>
                    {summaryFertilityRate !== null ? `${summaryFertilityRate}%` : "N/A"}
                  </span>
                </p>
              </div>
            </div>

            {/* High-contrast stat tiles with big numbers */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {isLaterSummary ? (
                <>
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                    <span style={{ color: "#15803D", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Developing</span>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-page-title)", fontWeight: "var(--weight-extrabold)", lineHeight: "var(--leading-tight)", color: "#15803D", marginTop: 2 }}>{summaryDeveloping}</p>
                    <p style={{ color: "#166534", fontSize: 11, marginTop: 2 }}>Developing embryos</p>
                  </div>
                  <div
                    className="rounded-xl p-2.5"
                    style={{
                      backgroundColor: summaryStopped > 0 ? "#FEF2F2" : "#F8FAF9",
                      border: `1px solid ${summaryStopped > 0 ? "#FECACA" : "#DCE7E2"}`,
                    }}
                  >
                    <span style={{ color: summaryStopped > 0 ? "#B91C1C" : "#64748B", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Stopped developing</span>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-page-title)", fontWeight: "var(--weight-extrabold)", lineHeight: "var(--leading-tight)", color: summaryStopped > 0 ? "#B91C1C" : "#475569", marginTop: 2 }}>{summaryStopped}</p>
                    <p style={{ color: summaryStopped > 0 ? "#991B1B" : "#64748B", fontSize: 11, marginTop: 2 }}>
                      {summaryStopped > 0 ? "Review journal" : "None observed"}
                    </p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <span style={{ color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Clear</span>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-page-title)", fontWeight: "var(--weight-extrabold)", lineHeight: "var(--leading-tight)", color: "#334155", marginTop: 2 }}>{summaryClear}</p>
                    <p style={{ color: "#64748B", fontSize: 11, marginTop: 2 }}>Likely infertile</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                    <span style={{ color: "#B45309", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Uncertain</span>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-page-title)", fontWeight: "var(--weight-extrabold)", lineHeight: "var(--leading-tight)", color: "#B45309", marginTop: 2 }}>{summaryUncertain}</p>
                    <p style={{ color: "#92400E", fontSize: 11, marginTop: 2 }}>
                      {summaryUncertain > 0 ? (pendingCheckpoint ? `Recheck Day ${pendingCheckpoint.day}` : "Resolve before finish") : "None to recheck"}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                    <span style={{ color: "#15803D", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Fertile</span>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-page-title)", fontWeight: "var(--weight-extrabold)", lineHeight: "var(--leading-tight)", color: "#15803D", marginTop: 2 }}>{latestCandlingEntry.fertile}</p>
                    <p style={{ color: "#166534", fontSize: 11, marginTop: 2 }}>Development observed</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <span style={{ color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Clear</span>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-page-title)", fontWeight: "var(--weight-extrabold)", lineHeight: "var(--leading-tight)", color: "#334155", marginTop: 2 }}>{latestCandlingEntry.clear}</p>
                    <p style={{ color: "#64748B", fontSize: 11, marginTop: 2 }}>Likely infertile</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                    <span style={{ color: "#B45309", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Uncertain</span>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-page-title)", fontWeight: "var(--weight-extrabold)", lineHeight: "var(--leading-tight)", color: "#B45309", marginTop: 2 }}>{latestCandlingEntry.uncertain}</p>
                    <p style={{ color: "#92400E", fontSize: 11, marginTop: 2 }}>
                      {latestCandlingEntry.uncertain > 0 ? (pendingCheckpoint ? `Recheck Day ${pendingCheckpoint.day}` : "Resolve before finish") : "None to recheck"}
                    </p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: "#F5EFE6", border: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Total Loaded</span>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-page-title)", fontWeight: "var(--weight-extrabold)", lineHeight: "var(--leading-tight)", color: TEXT, marginTop: 2 }}>{totalEggsSet}</p>
                    <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>Eggs in tray</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: BORDER }}>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-label)", fontWeight: "var(--weight-extrabold)", letterSpacing: "var(--tracking-label)", lineHeight: "var(--leading-snug)", color: MUTED, textTransform: "uppercase" }}>
                  {pendingCheckpoint ? "Next checkpoint" : "Candling schedule"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
                    {pendingCheckpoint ? `${pendingCheckpoint.label} · Day ${pendingCheckpoint.day}` : "All scheduled checks completed"}
                  </span>
                  {pendingCheckpoint && checkpointDistance !== null && (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5"
                      style={{
                        backgroundColor: checkpointDistance < 0 ? "var(--status-danger-bg)" : checkpointDistance === 0 ? "var(--status-warning-bg)" : "var(--surface-muted)",
                        color: checkpointDistance < 0 ? "var(--status-danger-fg)" : checkpointDistance === 0 ? "var(--status-warning-fg)" : "var(--text-secondary)",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {checkpointTiming}
                    </span>
                  )}
                </div>
              </div>
              <Button onClick={openNewInspection} className="w-full rounded-full sm:w-auto" style={{ ...rustBtn, fontSize: 13 }}>
                <Plus size={14} /> Log Inspection
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-label)", fontWeight: "var(--weight-extrabold)", letterSpacing: "var(--tracking-label)", lineHeight: "var(--leading-snug)", color: MUTED, textTransform: "uppercase" }}>
                {pendingCheckpoint ? "Next checkpoint" : "Candling schedule"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
                  {pendingCheckpoint ? `${pendingCheckpoint.label} · Day ${pendingCheckpoint.day}` : "Candling checks scheduled"}
                </span>
                {pendingCheckpoint && checkpointDistance !== null && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5"
                    style={{
                      backgroundColor: checkpointDistance < 0 ? "var(--status-danger-bg)" : checkpointDistance === 0 ? "var(--status-warning-bg)" : "var(--surface-muted)",
                      color: checkpointDistance < 0 ? "var(--status-danger-fg)" : checkpointDistance === 0 ? "var(--status-warning-fg)" : "var(--text-secondary)",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {checkpointTiming}
                  </span>
                )}
              </div>
            </div>
            <Button onClick={openNewInspection} className="w-full rounded-full sm:w-auto" style={{ ...rustBtn, fontSize: 13, fontWeight: 700 }}>
              <Plus size={14} /> Log Inspection
            </Button>
          </div>
        )}
      </SectionCard>

      <LogModal
        open={showLogForm}
        onOpenChange={(open) => {
          setShowLogForm(open);
          if (!open) setEditingEntry(null);
        }}
        candling={candling}
        candled={effectiveCandled}
        currentDay={currentDay}
        totalDays={totalDays}
        totalEggsSet={totalEggsSet}
        chamberName={unit.name}
        modeName={mode.name}
        initialEntry={editingEntry}
        previousEntry={latestCandlingEntry}
        onSubmit={submitInspection}
      />

      {/* 2-column: 60% inspection history / 40% summary */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* LEFT — inspection history feed */}
        <div className="space-y-4 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <p style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
              Candling Journal
            </p>
          </div>

          <div className="relative pt-[24px]">
            <div className="absolute top-0 bottom-0 left-0 flex flex-col items-center" style={{ width: 40 }}>
              <span
                className="absolute font-bold"
                style={{
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-muted)",
                  lineHeight: "1",
                  zIndex: 20,
                  whiteSpace: "nowrap",
                }}
              >
                DAY
              </span>
              <div className="w-0.5 flex-1" style={{ marginTop: 24, backgroundColor: "var(--border-subtle)" }} />
            </div>

            <ul className="space-y-5">
              {feedNodes.map((n) =>
                n.kind === "logged" ? (
                  <li key={`log-${n.day}`} className="group relative flex items-start">
                    <div className="shrink-0 flex justify-center relative z-10" style={{ width: 40 }}>
                      <span
                        className="flex items-center justify-center rounded-full"
                        style={{
                          width: 32,
                          height: 32,
                          backgroundColor: RUST_NODE,
                          color: "#FFFFFF",
                          fontSize: 13,
                          fontWeight: 700,
                          boxShadow: `0 0 0 3px ${BG}`,
                        }}
                      >
                        {formatNodeDay(n.day)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 pl-3">
                      <div className="flex flex-wrap items-center justify-between gap-2" style={{ minHeight: 32 }}>
                        <button
                          type="button"
                          onClick={() => setExpandedDays((days) => {
                            const next = new Set(days);
                            if (next.has(n.day)) next.delete(n.day);
                            else next.add(n.day);
                            return next;
                          })}
                          className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
                          style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}
                          aria-expanded={expandedDays.has(n.day)}
                          aria-controls={`journal-entry-${n.day}`}
                          aria-label={`${expandedDays.has(n.day) ? "Hide" : "Show"} details for Day ${n.entry.day}`}
                        >
                          <span>{n.idx >= 0 ? (CANDLE_SHORT_LABELS[n.idx] ?? n.entry.label) : n.entry.label}</span>
                          <CheckCircle2 size={18} fill="var(--status-success-fg)" color="var(--on-brand)" strokeWidth={2.5} />
                          <ChevronDown
                            size={17}
                            className={`ml-0.5 text-[var(--text-muted)] transition-transform duration-200 ${expandedDays.has(n.day) ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </button>
                        <div className="flex items-center gap-1.5">
                          <span className="whitespace-nowrap mr-3" style={{ fontSize: 13, color: "#6E6259" }}>
                            {fmtTimestamp(n.entry.date)}
                          </span>
                          <button
                            onClick={() => {
                              setEditingEntry(n.entry);
                              setShowLogForm(true);
                            }}
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-[#A8A29E] transition-colors hover:bg-[#FFF5F2] hover:text-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                            aria-label={`Edit entry for Day ${n.entry.day}`}
                            title="Edit Inspection"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setEntryToDelete(n.entry)}
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-[#A8A29E] transition-colors hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                            aria-label={`Delete entry for Day ${n.entry.day}`}
                            title="Delete Journal Entry"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div
                        id={`journal-entry-${n.day}`}
                        className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
                          expandedDays.has(n.day)
                            ? "visible mt-3 grid-rows-[1fr] opacity-100"
                            : "invisible grid-rows-[0fr] opacity-0 group-hover:visible group-hover:mt-3 group-hover:grid-rows-[1fr] group-hover:opacity-100"
                        }`}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <JournalEntryCard
                            entry={n.entry}
                            onAddPhotos={addPhotosToEntry}
                            onUpdateNote={updateEntryNote}
                            onDeletePhoto={deletePhotoFromEntry}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                ) : (() => {
                  const isDue = n.cp.day <= currentDay;
                  return (
                    <li key={`cp-${n.day}`} className="relative flex items-center min-h-[32px]">
                      <div className="shrink-0 flex justify-center relative z-10" style={{ width: 40 }}>
                        <span
                          className="flex items-center justify-center rounded-full"
                          style={{
                            width: 32,
                            height: 32,
                            backgroundColor: "#FFFFFF",
                            border: isDue ? "2px solid var(--status-warning-fg)" : "2px solid var(--border-subtle)",
                            color: isDue ? "var(--status-warning-fg)" : "var(--text-muted)",
                            fontSize: 13,
                            fontWeight: 700,
                            boxShadow: `0 0 0 3px ${BG}`,
                          }}
                        >
                          {formatNodeDay(n.day)}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 pl-3">
                        {isDue ? (
                          <p className="flex flex-wrap items-center gap-1.5" style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                            {CANDLE_SHORT_LABELS[n.idx] ?? n.cp.label}
                            <AlertCircle
                              size={16}
                              color="var(--status-warning-fg)"
                              strokeWidth={2}
                              aria-label="Inspection due"
                            />
                          </p>
                        ) : (
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                            {CANDLE_SHORT_LABELS[n.idx] ?? n.cp.label}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })()
              )}
            </ul>

            {loggedEntries.length === 0 && (
              <div className="ml-[52px] mt-6 max-w-lg">
                <StatusCallout
                  size="sm"
                  tone="warning"
                  title="No inspection recorded yet"
                  description="Check the eggs, then click “Log Inspection” above to record your count. Notes and photos are optional."
                />
              </div>
            )}

            {/* Delete Confirmation Modal */}
            <Dialog open={entryToDelete !== null} onOpenChange={(open) => !open && setEntryToDelete(null)}>
              <DialogContent
                className="max-w-[400px] w-[90vw] p-6 rounded-2xl bg-[var(--surface-card)] shadow-xl border border-[var(--border-subtle)] [&>[data-slot=dialog-close]]:hidden"
                style={{ borderRadius: 16 }}
              >
                <DialogHeader className="gap-2 text-left">
                  <DialogTitle style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                    Delete Journal Entry?
                  </DialogTitle>
                  <DialogDescription style={{ fontSize: 13, color: "#525252", lineHeight: 1.5 }}>
                    Are you sure you want to delete this inspection log for Day {entryToDelete?.day}? This will recalculate the cycle summary and cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 flex items-center justify-end gap-2.5">
                  <Button
                    variant="outline"
                    onClick={() => setEntryToDelete(null)}
                    className="rounded-xl border-[var(--border-subtle)] text-[#44403C] hover:bg-stone-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (entryToDelete) {
                        deleteJournalEntry(entryToDelete.day);
                        setEntryToDelete(null);
                      }
                    }}
                    className="rounded-xl text-white font-medium transition-colors"
                    style={{ backgroundColor: "var(--status-danger-fg)" }}
                  >
                    Delete Entry
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* RIGHT — Incubation Calendar */}
        <div className="space-y-5 lg:col-span-2">
          <IncubationCalendar
            currentDay={currentDay}
            totalDays={totalDays}
            candling={candling}
          />
        </div>
      </div>
    </div>
  );
}
