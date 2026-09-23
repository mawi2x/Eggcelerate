import { CheckCircle } from "@phosphor-icons/react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleCheck,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { developmentCheckLabels } from "../../domain/candling";
import { calculateFertilityRate } from "../../domain/fertility";
import type {
  CandlingCheckpoint,
  CandlingLogEntry,
  DevelopmentCheck,
  Incubator,
  Mode,
} from "../../domain/types";
import {
  formatCheckpointTiming,
  selectCandlingFeedNodes,
  selectCandlingTallyValidation,
  selectPendingCheckpoint,
} from "../../features/candling/selectors";
import { CheckIcon } from "../icons/CheckIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { CalendarSheetBody, IncubationCalendar } from "./IncubationCalendar";
import { PhotoLightboxModal } from "./PhotoLightbox";
import { SectionCard, StatusCallout } from "./primitives";
import { Timeline } from "./Timeline";
import {
  CANDLE_SHORT_LABELS,
  type CandleForm,
  emptyForm,
  fmtTimestamp,
  formatNodeDay,
  MAX_PHOTO_BYTES,
  NOTES_MAX,
  type TallyKey,
} from "./types";

// ─── Candling feed journal card ──────────────────────────────────────────────
export function JournalEntryCard({
  entry,
  onAddPhotos,
  onUpdateNote,
  onDeletePhoto,
}: {
  entry: CandlingLogEntry;
  onAddPhotos: (day: number, urls: string[]) => Promise<boolean>;
  onUpdateNote: (day: number, note: string) => Promise<boolean>;
  onDeletePhoto: (day: number, photoIndex: number) => Promise<boolean>;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const [noteDraft, setNoteDraft] = useState(entry.note);
  const [noteEditing, setNoteEditing] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
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
        if (loaded === accepted.length) void onAddPhotos(entry.day, urls);
      };
      reader.readAsDataURL(file);
    });
  };

  const photos = (entry.photos || []).filter(
    (p) => typeof p === "string" && p.trim().length > 0,
  );
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
      <Card
        style={{
          backgroundColor: "var(--surface-subtle)",
          border: `1px solid var(--border-default)`,
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <CardContent style={{ padding: 18 }}>
          <p
            style={{
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-bold)",
              letterSpacing: "var(--tracking-label)",
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            Candling Status
          </p>

          {/* Flat stat chips */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-block whitespace-nowrap"
              style={{
                backgroundColor: "var(--status-success-bg)",
                color: "var(--status-success-fg)",
                padding: "var(--pill-padding)",
                borderRadius: "var(--radius-chip)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-semibold)",
              }}
            >
              {isLaterEntry ? developing : entry.fertile}{" "}
              {isLaterEntry ? "Developing" : "Fertile"}
            </span>
            <span
              className="inline-block whitespace-nowrap"
              style={{
                backgroundColor: "var(--surface-slate)",
                color: "var(--text-slate-soft)",
                padding: "var(--pill-padding)",
                borderRadius: "var(--radius-chip)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-semibold)",
              }}
            >
              {entry.clear} Clear
            </span>
            <span
              className="inline-block whitespace-nowrap"
              style={{
                backgroundColor: "var(--status-warning-bg)",
                color: "var(--status-warning-fg)",
                padding: "var(--pill-padding)",
                borderRadius: "var(--radius-chip)",
                fontSize: "var(--type-caption)",
                fontWeight: "var(--weight-semibold)",
              }}
            >
              {entry.uncertain} Uncertain
            </span>
            {isLaterEntry && (
              <span
                className="inline-block whitespace-nowrap"
                style={{
                  backgroundColor: "var(--status-danger-bg)",
                  color: "var(--status-danger-strong)",
                  padding: "var(--pill-padding)",
                  borderRadius: "var(--radius-chip)",
                  fontSize: "var(--type-caption)",
                  fontWeight: "var(--weight-semibold)",
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
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1"
                  style={{
                    backgroundColor: "var(--surface-card)",
                    border: `1px solid var(--border-default)`,
                    color: "var(--text-strong)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-semibold)",
                  }}
                >
                  <CheckCircle
                    size={14}
                    color={"var(--status-success-fg)"}
                    weight="fill"
                  />{" "}
                  {developmentCheckLabels[c]}
                </span>
              ))}
            </div>
          )}

          {/* Note Section */}
          <span
            className="block"
            style={{
              fontSize: "var(--type-caption)",
              fontWeight: "var(--weight-bold)",
              letterSpacing: "var(--tracking-label)",
              color: "var(--text-primary)",
              marginBottom: 6,
            }}
          >
            Note:
          </span>

          <div className="space-y-3">
            <div className="w-full">
              {noteEditing ? (
                <>
                  <textarea
                    value={noteDraft}
                    onChange={(e) =>
                      setNoteDraft(e.target.value.slice(0, NOTES_MAX))
                    }
                    maxLength={NOTES_MAX}
                    placeholder="Add observations: veining, air cell development, movement"
                    rows={3}
                    className="w-full resize-none rounded-xl px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                    style={{
                      border: `1px solid var(--input-border)`,
                      backgroundColor: "var(--surface-tile)",
                      fontSize: "var(--type-control-value)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      disabled={isSavingNote}
                      onClick={() => {
                        setNoteDraft(entry.note);
                        setNoteEditing(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full"
                      style={{
                        backgroundColor: "var(--brand-primary)",
                        color: "var(--on-brand)",
                      }}
                      disabled={isSavingNote}
                      aria-busy={isSavingNote}
                      onClick={() => {
                        setIsSavingNote(true);
                        void onUpdateNote(entry.day, noteDraft).then(
                          (saved) => {
                            setIsSavingNote(false);
                            if (!saved) return;
                            setNoteEditing(false);
                            toast.success("Note saved");
                          },
                        );
                      }}
                    >
                      {isSavingNote ? "Saving…" : "Save note"}
                    </Button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setNoteEditing(true)}
                  className="w-full rounded-xl px-3.5 py-3 text-left transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{
                    backgroundColor: "var(--surface-note)",
                    border: `1px solid var(--border-default)`,
                    borderLeft: `3px solid var(--brand-primary)`,
                    borderRadius: "var(--radius-dialog)",
                    cursor: "pointer",
                  }}
                  aria-label="Edit inspector notes"
                >
                  {entry.note ? (
                    <span
                      className="block"
                      style={{
                        fontSize: "var(--type-body-sm)",
                        fontStyle: "italic",
                        color: "var(--text-note)",
                        lineHeight: 1.45,
                      }}
                    >
                      {entry.note}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "var(--type-body-sm)",
                        color: "var(--text-secondary)",
                      }}
                    >
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
                  key={url}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLightboxIndex(i);
                  }}
                  className="relative overflow-hidden rounded-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    width: "var(--control-size-photo)",
                    height: "var(--control-size-photo)",
                    border: `1px solid var(--border-default)`,
                    cursor: "pointer",
                  }}
                  aria-label={`View photo ${i + 1}`}
                >
                  <img
                    src={url}
                    alt={`Candling ${i + 1}`}
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
                  style={{
                    width: "var(--control-size-photo)",
                    height: "var(--control-size-photo)",
                    border: `1px solid var(--border-default)`,
                    cursor: "pointer",
                  }}
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
                    style={{
                      backgroundColor: "rgba(0, 0, 0, 0.60)", // photo scrim exception — keep literal
                      fontSize: "var(--type-body-sm)",
                    }}
                  >
                    +{overflowCount}
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="flex flex-col items-center justify-center gap-0.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 transition-colors hover:bg-[var(--surface-paper)]"
                style={{
                  width: "var(--control-size-photo)",
                  height: "var(--control-size-photo)",
                  border: `1.5px dashed var(--border-accent)`,
                  backgroundColor: "var(--surface-card)",
                  cursor: "pointer",
                }}
                aria-label="Add candling photo"
              >
                <Plus size={15} color={"var(--text-secondary)"} />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-semibold)",
                    letterSpacing: "var(--tracking-label)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Photo
                </span>
              </button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => readFiles(e.target.files)}
              />
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

// Compact mobile labels so all three development checks fit one row on phones.
const SHORT_CHECK_LABELS = {
  veining: "Veining",
  airCell: "Air Cell",
  movement: "Movement",
};
const LOG_STAGES: { id: LogStage; label: string; description: string }[] = [
  { id: 1, label: "Checkpoint", description: "Choose the inspection day." },
  { id: 2, label: "Egg counts", description: "Record what you observed." },
  {
    id: 3,
    label: "Observations",
    description: "Add notes, checks, or photos.",
  },
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
  onSubmit: (form: CandleForm) => Promise<boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid max-h-[75dvh] min-h-[75dvh] grid-rows-[0.7fr_2fr_0.3fr] gap-2 overflow-y-auto p-0 shadow-2xl md:min-w-[var(--dialog-width-narrow)] md:max-w-[var(--dialog-width-wide)]"
        style={{
          backgroundColor: "var(--surface-subtle)",
          border: `1px solid var(--border-default)`,
          borderRadius: "var(--radius-card)",
        }}
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
  onSubmit: (form: CandleForm) => Promise<boolean>;
  onCancel: () => void;
}) {
  const isEditing = !!initialEntry;
  const available = candling.filter(
    (c) => !candled[c.day] || (initialEntry && c.day === initialEntry.day),
  );
  const photoRef = useRef<HTMLInputElement>(null);

  const defaultCustomDay = String(
    Math.min(totalDays, currentDay > 0 ? currentDay : 8),
  );
  const initialOpt = initialEntry
    ? String(initialEntry.day)
    : available[0]
      ? String(available[0].day)
      : "custom";

  const [selectedOption, setSelectedOption] = useState<string>(
    initialEntry && !candling.some((c) => c.day === initialEntry.day)
      ? "custom"
      : initialOpt,
  );
  const [customDayRaw, setCustomDayRaw] = useState<string>(
    initialEntry ? String(initialEntry.day) : defaultCustomDay,
  );

  const defaultTargetDay = initialEntry
    ? initialEntry.day
    : (available[0]?.day ?? Number(defaultCustomDay));

  const initialForm: CandleForm = initialEntry
    ? {
        targetDay: initialEntry.day,
        date: initialEntry.date,
        fertile: initialEntry.fertile,
        clear: initialEntry.clear,
        uncertain: initialEntry.uncertain,
        developing: initialEntry.developing ?? initialEntry.fertile,
        stoppedDeveloping: initialEntry.stoppedDeveloping ?? 0,
        checkpointType:
          initialEntry.checkpointType ??
          (initialEntry.day > (candling[0]?.day ?? 1) ? "later" : "first"),
        note: initialEntry.note,
        photos: initialEntry.photos,
        checks: initialEntry.checks,
      }
    : {
        ...emptyForm(defaultTargetDay, previousEntry ?? undefined),
        checkpointType:
          defaultTargetDay > (candling[0]?.day ?? 1) ? "later" : "first",
      };

  const [form, setForm] = useState<CandleForm>(initialForm);
  const [dragging, setDragging] = useState(false);
  const [emptyEvidenceWarningOpen, setEmptyEvidenceWarningOpen] =
    useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stage, setStage] = useState<LogStage>(isEditing ? 2 : 1);
  const stageHeadingRef = useRef<HTMLHeadingElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const checkBodyScroll = useCallback(() => {
    const el = scrollBodyRef.current;
    if (el)
      setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: changing wizard stages replaces the scroll content and requires measuring again
  useEffect(() => {
    checkBodyScroll();
    window.addEventListener("resize", checkBodyScroll);
    const el = scrollBodyRef.current;
    el?.addEventListener("scroll", checkBodyScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", checkBodyScroll);
      el?.removeEventListener("scroll", checkBodyScroll);
    };
  }, [checkBodyScroll, stage]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stage intentionally re-runs focus on step change
  useEffect(() => {
    stageHeadingRef.current?.focus();
  }, [stage]);

  const customDayNum = Number(customDayRaw);
  const isCustomDayValid =
    selectedOption !== "custom" ||
    (customDayRaw.trim() !== "" &&
      !Number.isNaN(customDayNum) &&
      customDayNum >= 1 &&
      customDayNum <= totalDays);
  const customDayError = selectedOption === "custom" && !isCustomDayValid;

  const firstCheckpointDay = candling[0]?.day ?? 1;
  const isLaterCheckpoint =
    form.checkpointType === "later" || form.targetDay > firstCheckpointDay;
  const isLockdownCheckpoint = form.targetDay === candling[2]?.day;
  const {
    inspected,
    unaccountedEggs,
    isTallyOverCapacity,
    isZeroTally,
    hasUnresolvedUncertain,
    hasIncompleteLockdown,
    isSaveDisabled,
  } = selectCandlingTallyValidation(form, {
    isLaterCheckpoint,
    isLockdownCheckpoint,
    totalEggsSet,
    customDayError,
  });
  const hasEvidence = form.note.trim().length > 0 || form.photos.length > 0;

  const submit = async () => {
    setIsSaving(true);
    await onSubmit(form);
    setIsSaving(false);
  };

  const handleSave = () => {
    if (!hasEvidence) {
      setEmptyEvidenceWarningOpen(true);
      return;
    }
    void submit();
  };

  const readFiles = useCallback((files: FileList | null) => {
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
        if (loaded === accepted.length)
          setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      readFiles(e.dataTransfer.files);
    },
    [readFiles],
  );

  const target = candling.find((c) => c.day === form.targetDay);

  const setCount = (key: TallyKey, raw: string) => {
    const clean = raw.replace(/[^0-9]/g, "").slice(0, 3);
    setForm((f) => ({
      ...f,
      [key]: Math.min(totalEggsSet, Number(clean) || 0),
    }));
  };

  const tallyFields: { key: TallyKey; label: string; color: string }[] =
    isLaterCheckpoint
      ? [
          {
            key: "developing",
            label: "Developing",
            color: "var(--status-success-deep)",
          },
          { key: "clear", label: "Clear", color: "var(--text-slate)" },
          {
            key: "stoppedDeveloping",
            label: "Stopped Developing",
            color: "var(--status-danger-strong)",
          },
          {
            key: "uncertain",
            label: "Uncertain or Not sure",
            color: "var(--text-amber-deep)",
          },
        ]
      : [
          {
            key: "fertile",
            label: "Fertile",
            color: "var(--status-success-deep)",
          },
          { key: "clear", label: "Clear", color: "var(--text-slate)" },
          {
            key: "uncertain",
            label: "Uncertain",
            color: "var(--text-amber-deep)",
          },
        ];

  const countRemainingAsUncertain = () => {
    if (unaccountedEggs <= 0) return;
    setForm((current) => ({
      ...current,
      uncertain: Math.min(totalEggsSet, current.uncertain + unaccountedEggs),
    }));
  };

  const canAdvance =
    stage === 1
      ? !customDayError
      : !isZeroTally &&
        !isTallyOverCapacity &&
        !hasIncompleteLockdown &&
        unaccountedEggs === 0;

  const goToNextStage = () => {
    if (!canAdvance) return;
    setStage((current) =>
      current < 3 ? ((current + 1) as LogStage) : current,
    );
  };

  return (
    <>
      <div>
        <DialogHeader className="gap-1 px-5 pt-5 text-left">
          <DialogTitle
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--type-heading-md)",
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-snug)",
              color: "var(--text-primary)",
            }}
          >
            {isEditing
              ? `Edit Inspection Log: Day ${form.targetDay}`
              : "Candling Journal"}
          </DialogTitle>
          <DialogDescription
            className="font-medium space-y-0.5"
            style={{ fontSize: "var(--type-caption)" }}
          >
            <span
              className="block"
              style={{
                color: "var(--text-primary)",
                fontWeight: "var(--weight-bold)",
              }}
            >
              {chamberName}
            </span>
            <span className="block" style={{ color: "var(--text-secondary)" }}>
              {modeName}
            </span>
          </DialogDescription>
        </DialogHeader>

        <nav className="px-5 pt-1" aria-label="Candling log steps">
          <ol className="flex flex-wrap gap-2">
            {LOG_STAGES.map((item) => {
              const active = stage === item.id;
              const completed = stage > item.id;
              return (
                <li
                  key={item.id}
                  aria-current={active ? "step" : undefined}
                  className="min-w-0 flex-1"
                >
                  <div
                    className="flex h-full min-h-11 items-center gap-1.5 rounded-xl border px-2 py-2 md:gap-2 md:px-2.5"
                    style={{
                      borderColor: active
                        ? "var(--brand-primary)"
                        : completed
                          ? "var(--status-success-fg)"
                          : "var(--border-default)",
                      backgroundColor: active
                        ? "color-mix(in srgb, var(--brand-primary) 7%, transparent)"
                        : completed
                          ? "var(--status-success-bg)"
                          : "var(--surface-card)",
                    }}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold md:h-6 md:w-6"
                      style={{
                        backgroundColor: active
                          ? "var(--brand-primary)"
                          : completed
                            ? "var(--status-success-fg)"
                            : "transparent",
                        border:
                          active || completed
                            ? "none"
                            : `1px solid var(--border-default)`,
                        color:
                          active || completed
                            ? "var(--surface-card)"
                            : "var(--text-secondary)",
                      }}
                      aria-hidden="true"
                    >
                      {completed ? <CheckIcon size={13} /> : item.id}
                    </span>
                    <span
                      className="min-w-0"
                      style={{
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        lineHeight: 1.2,
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <div ref={scrollBodyRef} className="min-h-0 overflow-y-auto">
        <div className="px-5" aria-live="polite">
          <h3
            ref={stageHeadingRef}
            tabIndex={-1}
            className="focus-visible:outline-none"
            style={{
              color: "var(--text-primary)",
              fontSize: "var(--type-body-sm)",
              fontWeight: "var(--weight-bold)",
            }}
          >
            {stage}. {LOG_STAGES[stage - 1].label}
          </h3>
          <p
            className="mt-0.5"
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--type-caption)",
            }}
          >
            {LOG_STAGES[stage - 1].description}
          </p>
        </div>

        <div className="space-y-4 px-5 pb-1">
          {stage === 1 && (
            <div>
              <Label
                style={{
                  fontSize: "var(--type-body-sm)",
                  color: "var(--text-primary)",
                }}
              >
                Checkpoint
              </Label>
              {isEditing ? (
                <div
                  className="mt-1.5 flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{
                    border: `1px solid var(--border-default)`,
                    backgroundColor: "var(--surface-card)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--type-body)",
                      fontWeight: "var(--weight-semibold)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {target?.label ?? `Day ${form.targetDay} Candling`} (Day{" "}
                    {form.targetDay})
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5"
                    style={{
                      fontSize: "var(--type-label)",
                      fontWeight: "var(--weight-bold)",
                      backgroundColor: "var(--border-subtle)",
                      color: "var(--text-muted)",
                    }}
                  >
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
                  <SelectTrigger
                    size="filter"
                    className="mt-1.5 h-[var(--control-height-mobile)] rounded-xl md:h-[var(--control-height-default)]"
                    style={{
                      borderColor: "var(--input-border)",
                      backgroundColor: "var(--surface-card)",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((c) => (
                      <SelectItem key={c.day} value={String(c.day)}>
                        {c.label} (Day {c.day})
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom Day...</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {!isEditing && selectedOption === "custom" && (
                <div className="mt-3">
                  <Label
                    htmlFor="custom-day-input"
                    style={{
                      fontSize: "var(--type-body-sm)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Day Number
                  </Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      style={{
                        fontSize: "var(--type-body)",
                        fontWeight: "var(--weight-semibold)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Day
                    </span>
                    <Input
                      id="custom-day-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={customDayRaw}
                      onKeyDown={(e) => {
                        if (["e", "E", "+", "-", "."].includes(e.key))
                          e.preventDefault();
                      }}
                      onChange={(e) => {
                        const sanitized = e.target.value
                          .replace(/[^0-9]/g, "")
                          .slice(0, 2);
                        setCustomDayRaw(sanitized);
                        const val = Number(sanitized) || 0;
                        setForm((f) => ({ ...f, targetDay: val }));
                      }}
                      placeholder="8"
                      className="w-24 rounded-xl"
                      style={{
                        borderColor: customDayError
                          ? "var(--status-danger-fg)"
                          : "var(--input-border)",
                        backgroundColor: "var(--surface-card)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                  {customDayError && (
                    <p
                      className="mt-1.5 flex items-center gap-1"
                      style={{
                        fontSize: "var(--type-body-sm)",
                        color: "var(--status-danger-fg)",
                        fontWeight: "var(--weight-semibold)",
                      }}
                    >
                      <AlertCircle size={13} /> Day must be between 1 and{" "}
                      {totalDays}
                    </p>
                  )}
                </div>
              )}

              {!isEditing &&
                selectedOption !== "custom" &&
                target &&
                target.day > currentDay && (
                  <StatusCallout
                    size="sm"
                    tone="warning"
                    title="Not yet due"
                    description={
                      <>
                        This is <strong>Day {target.day}</strong>. You can still
                        log it if candling was performed early.
                      </>
                    }
                    className="mt-1.5"
                  />
                )}
            </div>
          )}

          {/* Tally inputs */}
          {stage === 2 && (
            <div>
              <Label
                style={{
                  fontSize: "var(--type-body-sm)",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--text-primary)",
                }}
              >
                {isLaterCheckpoint ? "Development tally" : "Fertility tally"}
              </Label>
              <p
                className="mt-1"
                style={{
                  fontSize: "var(--type-caption)",
                  color: "var(--text-secondary)",
                }}
              >
                {isLaterCheckpoint
                  ? "Classify every egg as developing, clear, stopped developing, or uncertain."
                  : "Record the first candling result for each egg."}
              </p>
              <fieldset
                className="mt-3 space-y-1.5"
                style={{ border: 0, padding: 0, margin: 0, marginTop: 12 }}
                aria-label="Egg category counts"
              >
                <div
                  className="flex items-center justify-between px-3 text-(length:--type-filter-label) font-bold uppercase tracking-[var(--tracking-label)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span>Category</span>
                  <span>Eggs</span>
                </div>
                {tallyFields.map((f) => (
                  <div
                    key={f.key}
                    className="flex items-center justify-between gap-4 rounded-xl border px-3.5 py-1.5"
                    style={{
                      backgroundColor: "var(--surface-card)",
                      borderColor: "var(--border-default)",
                    }}
                  >
                    <label
                      htmlFor={`tally-${f.key}`}
                      className="min-w-0 leading-5"
                      style={{
                        color: f.color,
                        fontSize: "var(--type-caption)",
                        fontWeight: "var(--weight-bold)",
                      }}
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
                        if (["e", "E", "+", "-", "."].includes(e.key))
                          e.preventDefault();
                      }}
                      onChange={(e) => setCount(f.key, e.target.value)}
                      placeholder="0"
                      aria-invalid={isTallyOverCapacity ? "true" : undefined}
                      aria-describedby={
                        isTallyOverCapacity ? "tally-count-error" : undefined
                      }
                      className="h-8 w-28 shrink-0 rounded-xl text-center"
                      style={{
                        borderColor: isTallyOverCapacity
                          ? "var(--status-danger-fg)"
                          : "var(--input-border)",
                        backgroundColor: "var(--surface-card)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                ))}
              </fieldset>

              {isTallyOverCapacity ? (
                <StatusCallout
                  size="sm"
                  tone="danger"
                  title="Too many eggs counted."
                  description={
                    <>
                      Total counted:{" "}
                      <strong className="font-bold">
                        {inspected} of {totalEggsSet}
                      </strong>
                      . Reduce one or more categories before continuing.
                    </>
                  }
                  className="mt-3"
                />
              ) : isZeroTally ? (
                <StatusCallout
                  size="sm"
                  dense
                  title="Enter at least one egg count"
                  tone="warning"
                  description="Count fertile, clear, and uncertain eggs to continue."
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
                      className="w-full cursor-pointer rounded-lg transition-colors hover:bg-[var(--surface-honey)] active:bg-[var(--status-warning-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                      onClick={countRemainingAsUncertain}
                      style={{
                        borderColor: "var(--status-warning-fg)",
                        color: "var(--status-warning-fg)",
                        fontSize: "var(--type-filter-label)",
                      }}
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
                      <strong className="font-bold">
                        {inspected} of {totalEggsSet}
                      </strong>{" "}
                      eggs accounted for.
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
                <Label
                  style={{
                    fontSize: "var(--type-body-sm)",
                    color: "var(--text-primary)",
                  }}
                >
                  Development observed
                </Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(
                    Object.keys(developmentCheckLabels) as DevelopmentCheck[]
                  ).map((c) => {
                    const on = form.checks.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            checks: on
                              ? form.checks.filter((x) => x !== c)
                              : [...form.checks, c],
                          })
                        }
                        aria-pressed={on}
                        aria-label={developmentCheckLabels[c]}
                        className="inline-flex min-h-[var(--control-height-default)] items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 md:min-h-8"
                        style={{
                          backgroundColor: on
                            ? "var(--status-success-bg)"
                            : "var(--surface-card)",
                          border: `1px solid ${on ? "var(--status-success-fg)" : "var(--border-default)"}`,
                          color: on
                            ? "var(--status-success-deep)"
                            : "var(--text-secondary)",
                          fontSize: "var(--type-body-sm)",
                          fontWeight: "var(--weight-semibold)",
                          cursor: "pointer",
                        }}
                      >
                        {on ? <CheckIcon size={13} /> : <Circle size={13} />}
                        <span aria-hidden="true" className="md:hidden">
                          {SHORT_CHECK_LABELS[c]}
                        </span>
                        <span aria-hidden="true" className="hidden md:inline">
                          {developmentCheckLabels[c]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label
                  htmlFor="lf-note"
                  style={{
                    fontSize: "var(--type-body-sm)",
                    color: "var(--text-primary)",
                  }}
                >
                  Notes
                </Label>
                <textarea
                  id="lf-note"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Observation notes…"
                  rows={3}
                  className="mt-1.5 w-full resize-none rounded-xl px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{
                    border: `1px solid var(--input-border)`,
                    backgroundColor: "var(--surface-card)",
                    fontSize: "var(--type-control-value)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Photos */}
              <div>
                <Label
                  style={{
                    fontSize: "var(--type-body-sm)",
                    color: "var(--text-primary)",
                  }}
                >
                  Photos
                </Label>
                <button
                  type="button"
                  aria-label="Add candling photos"
                  onClick={() => photoRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className="mt-1.5 flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
                  style={{
                    border: `1.5px dashed ${dragging ? "var(--brand-primary)" : "var(--border-accent)"}`,
                    backgroundColor: dragging
                      ? "color-mix(in srgb, var(--brand-primary) 4%, transparent)"
                      : "var(--surface-card)",
                    transition: "var(--transition-interactive)",
                  }}
                >
                  <Camera
                    size={20}
                    color={
                      dragging ? "var(--brand-primary)" : "var(--icon-earth)"
                    }
                  />
                  <span
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "var(--type-body-sm)",
                      fontWeight: "var(--weight-semibold)",
                    }}
                  >
                    Add photos from candling
                  </span>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "var(--type-caption)",
                    }}
                  >
                    Click or drag &amp; drop
                  </span>
                </button>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => readFiles(e.target.files)}
                />
                {form.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.photos.map((url, i) => (
                      <div key={url} className="relative group">
                        <img
                          src={url}
                          alt=""
                          className="rounded-lg object-cover"
                          style={{
                            width: 60,
                            height: 60,
                            border: `1px solid var(--border-default)`,
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm((f) => ({
                              ...f,
                              photos: f.photos.filter((_, idx) => idx !== i),
                            }));
                          }}
                          className="absolute -top-2 -right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 md:h-7 md:w-7"
                          aria-label="Remove photo"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition-transform hover:bg-red-700 active:scale-95">
                            <X size={11} />
                          </span>
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
                    <strong className="font-bold">
                      {inspected} of {totalEggsSet}
                    </strong>{" "}
                    eggs accounted for.
                  </>
                }
                className="mt-2.5"
              />
            </>
          )}
        </div>
      </div>

      <div
        className="relative sticky bottom-0 mt-auto px-5 py-4"
        style={{
          backgroundColor: "var(--surface-subtle)",
          borderTop: `1px solid var(--border-default)`,
        }}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-[var(--surface-subtle)] to-transparent transition-opacity duration-200 ${canScrollDown ? "opacity-100" : "opacity-0"}`}
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            className="rounded-full text-(length:--type-caption)"
            onClick={() =>
              stage === 1
                ? onCancel()
                : setStage((current) => (current - 1) as LogStage)
            }
          >
            {stage === 1 ? (
              "Cancel"
            ) : (
              <>
                <ArrowLeft size={15} /> Back
              </>
            )}
          </Button>
          {stage < 3 ? (
            <Button
              className="rounded-full text-(length:--type-caption)"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--on-brand)",
                opacity: canAdvance ? 1 : 0.5,
              }}
              disabled={!canAdvance}
              onClick={goToNextStage}
            >
              Next <ArrowRight size={15} />
            </Button>
          ) : (
            <Button
              className="rounded-full text-(length:--type-caption)"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--on-brand)",
                opacity: isSaveDisabled ? 0.5 : 1,
              }}
              disabled={isSaveDisabled || isSaving}
              aria-busy={isSaving}
              onClick={handleSave}
            >
              <CheckCircle2 size={15} />{" "}
              {isSaving
                ? "Saving…"
                : isEditing
                  ? "Update Inspection"
                  : "Save Inspection"}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog
        open={emptyEvidenceWarningOpen}
        onOpenChange={setEmptyEvidenceWarningOpen}
      >
        <AlertDialogContent
          className="rounded-2xl border-[var(--border-default)]"
          style={{
            backgroundColor: "var(--surface-subtle)",
            color: "var(--text-primary)",
          }}
        >
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle
              style={{
                color: "var(--text-primary)",
                fontSize: "var(--type-heading-md)",
                fontWeight: "var(--weight-bold)",
              }}
            >
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
            <AlertDialogCancel
              className="rounded-full"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                height: 34,
                fontSize: "var(--type-body)",
              }}
            >
              Go back
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--surface-card)",
                height: 34,
                fontSize: "var(--type-body)",
              }}
              disabled={isSaving}
              aria-busy={isSaving}
              onClick={(event) => {
                event.preventDefault();
                setEmptyEvidenceWarningOpen(false);
                void submit();
              }}
            >
              Save inspection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface SummaryTileDatum {
  label: string;
  value: ReactNode;
  surface: string;
  border: string;
  fg: string;
  labelFg: string;
  displayFont?: boolean;
}

/** Shared 4-tile summary grid; later/first/empty variants differ only in data. */
function SummaryTiles({
  tiles,
  gridClassName,
}: {
  tiles: SummaryTileDatum[];
  gridClassName: string;
}) {
  return (
    <div className={gridClassName}>
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex h-[58px] flex-col justify-center rounded-lg p-2 md:block md:h-auto md:min-w-0 md:p-2.5"
          style={{
            backgroundColor: tile.surface,
            border: `1px solid ${tile.border}`,
          }}
        >
          <span
            style={{
              color: tile.labelFg,
              fontSize: "var(--type-label)",
              fontWeight: "var(--weight-bold)",
              textTransform: "uppercase",
              display: "block",
            }}
          >
            {tile.label}
          </span>
          <div className="mt-1.5 flex items-center gap-1.5 md:mt-2">
            <span
              aria-hidden="true"
              className="h-5 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: tile.fg }}
            />
            <p
              style={{
                ...(tile.displayFont
                  ? { fontFamily: "var(--font-display)" }
                  : null),
                fontSize: "var(--type-heading-md)",
                fontWeight: "var(--weight-extrabold)",
                lineHeight: "var(--leading-tight)",
                color: tile.fg,
                marginTop: 2,
              }}
            >
              {tile.value}
            </p>
          </div>
        </div>
      ))}
    </div>
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
  onUpdate: (patch: Partial<Incubator>) => Promise<boolean>;
  isUpdating: boolean;
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
  isUpdating,
}: CandlingJournalTabProps) {
  const [showLogForm, setShowLogForm] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const calScrollRef = useRef<HTMLDivElement>(null);
  const [editingEntry, setEditingEntry] = useState<CandlingLogEntry | null>(
    null,
  );
  const [entryToDelete, setEntryToDelete] = useState<CandlingLogEntry | null>(
    null,
  );
  const [expandedDays, setExpandedDays] = useState<Set<number>>(
    () => new Set(),
  );

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
  const summaryDeveloping =
    latestCandlingEntry?.developing ?? latestCandlingEntry?.fertile ?? 0;
  const summaryStopped = latestCandlingEntry?.stoppedDeveloping ?? 0;
  const summaryClear = latestCandlingEntry?.clear ?? 0;
  const summaryUncertain = latestCandlingEntry?.uncertain ?? 0;
  const stoppedActive = summaryStopped > 0;
  const laterTiles: SummaryTileDatum[] = [
    {
      label: "Developing",
      value: summaryDeveloping,
      surface: "var(--surface-mint)",
      border: "var(--border-mint)",
      fg: "var(--status-success-fg)",
      labelFg: "var(--status-success-fg)",
      displayFont: true,
    },
    {
      label: "Stopped",
      value: summaryStopped,
      surface: stoppedActive ? "var(--surface-blush)" : "var(--surface-mist)",
      border: stoppedActive ? "var(--border-blush)" : "var(--border-mist)",
      fg: stoppedActive ? "var(--status-danger-fg)" : "var(--text-slate-cool)",
      labelFg: stoppedActive
        ? "var(--status-danger-fg)"
        : "var(--text-slate-cool)",
      displayFont: true,
    },
    {
      label: "Clear",
      value: summaryClear,
      surface: "var(--surface-slate-light)",
      border: "var(--border-slate-light)",
      fg: "var(--text-slate)",
      labelFg: "var(--text-slate-soft)",
      displayFont: true,
    },
    {
      label: "Uncertain",
      value: summaryUncertain,
      surface: "var(--surface-warn-tile)",
      border: "var(--border-amber-soft)",
      fg: "var(--status-warning-fg)",
      labelFg: "var(--status-warning-fg)",
      displayFont: true,
    },
  ];
  const firstTiles: SummaryTileDatum[] = [
    {
      label: "Fertile",
      value: latestCandlingEntry?.fertile ?? "–",
      surface: "var(--surface-mint)",
      border: "var(--border-mint)",
      fg: "var(--status-success-fg)",
      labelFg: "var(--status-success-fg)",
    },
    {
      label: "Clear",
      value: latestCandlingEntry?.clear ?? "–",
      surface: "var(--surface-slate-light)",
      border: "var(--border-slate-light)",
      fg: "var(--text-slate)",
      labelFg: "var(--text-slate-soft)",
    },
    {
      label: "Uncertain",
      value: latestCandlingEntry?.uncertain ?? "–",
      surface: "var(--surface-warn-tile)",
      border: "var(--border-amber-soft)",
      fg: "var(--status-warning-fg)",
      labelFg: "var(--status-warning-fg)",
    },
    {
      label: "Total Loaded",
      value: totalEggsSet,
      surface: "var(--surface-track)",
      border: "var(--border-subtle)",
      fg: "var(--text-primary)",
      labelFg: "var(--text-muted)",
      displayFont: true,
    },
  ];
  const emptyTiles: SummaryTileDatum[] = [
    {
      label: "Developing",
      value: "–",
      surface: "var(--surface-mint)",
      border: "var(--border-mint)",
      fg: "var(--status-success-fg)",
      labelFg: "var(--status-success-fg)",
      displayFont: true,
    },
    {
      label: "Stopped",
      value: "–",
      surface: "var(--surface-mist)",
      border: "var(--border-mist)",
      fg: "var(--text-slate-cool)",
      labelFg: "var(--text-slate-cool)",
      displayFont: true,
    },
    {
      label: "Clear",
      value: "–",
      surface: "var(--surface-slate-light)",
      border: "var(--border-slate-light)",
      fg: "var(--text-slate)",
      labelFg: "var(--text-slate-soft)",
      displayFont: true,
    },
    {
      label: "Uncertain",
      value: "–",
      surface: "var(--surface-warn-tile)",
      border: "var(--border-amber-soft)",
      fg: "var(--status-warning-fg)",
      labelFg: "var(--status-warning-fg)",
      displayFont: true,
    },
  ];
  const pendingCheckpoint = selectPendingCheckpoint(
    candling,
    effectiveCandled,
    currentDay,
  );
  const checkpointDistance = pendingCheckpoint
    ? pendingCheckpoint.day - currentDay
    : null;
  const checkpointTiming = formatCheckpointTiming(
    pendingCheckpoint,
    currentDay,
  );
  const canLog =
    unit.cyclePhase !== "ready" && unit.cyclePhase !== "stopped_early";
  const openNewInspection = () => {
    if (!canLog) return;
    setEditingEntry(null);
    setShowLogForm(true);
  };

  const feedNodes = selectCandlingFeedNodes(candling, unit.candlingLog);

  const deleteJournalEntry = async (day: number) => {
    const saved = await onUpdate({
      candled: { ...unit.candled, [day]: false },
      candlingLog: unit.candlingLog.filter((e) => e.day !== day),
    });
    if (!saved) return false;
    toast.success(`Day ${day} journal entry deleted`);
    return true;
  };

  const submitInspection = async (form: CandleForm) => {
    const counts = {
      fertile: Math.max(0, Math.floor(Number(form.fertile) || 0)),
      clear: Math.max(0, Math.floor(Number(form.clear) || 0)),
      uncertain: Math.max(0, Math.floor(Number(form.uncertain) || 0)),
      developing: Math.max(0, Math.floor(Number(form.developing) || 0)),
      stoppedDeveloping: Math.max(
        0,
        Math.floor(Number(form.stoppedDeveloping) || 0),
      ),
    };
    const checkpointType =
      form.targetDay > (candling[0]?.day ?? 1) ? "later" : "first";
    const inspected =
      checkpointType === "later"
        ? counts.developing +
          counts.clear +
          counts.uncertain +
          counts.stoppedDeveloping
        : counts.fertile + counts.clear + counts.uncertain;

    if (
      !Number.isInteger(form.targetDay) ||
      form.targetDay < 1 ||
      form.targetDay > totalDays
    ) {
      toast.error(`Inspection day must be between Day 1 and Day ${totalDays}.`);
      return false;
    }
    if (inspected < 1) {
      toast.error("Enter at least one egg count before saving the inspection.");
      return false;
    }
    if (inspected > totalEggsSet) {
      toast.error(`The egg counts cannot exceed ${totalEggsSet} eggs loaded.`);
      return false;
    }
    if (
      form.targetDay === candling[2]?.day &&
      (counts.uncertain > 0 || inspected < totalEggsSet)
    ) {
      toast.error(
        counts.uncertain > 0
          ? "Resolve all uncertain eggs before saving the Lockdown check."
          : `Categorize all ${totalEggsSet} eggs before saving the Lockdown check.`,
      );
      return false;
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

    const baselineFertile =
      editingEntry?.fertile ??
      unit.fertileEggs ??
      (counts.fertile > 0 ? counts.fertile : counts.developing);

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
        ? {
            developing: counts.developing,
            stoppedDeveloping: counts.stoppedDeveloping,
          }
        : {}),
    };

    const saved = await onUpdate({
      candled: { ...unit.candled, [form.targetDay]: true },
      fertileEggs:
        checkpointType === "first"
          ? counts.fertile
          : (unit.fertileEggs ?? (baselineFertile || undefined)),
      candlingLog: [
        entry,
        ...unit.candlingLog.filter((e) => e.day !== form.targetDay),
      ],
    });
    if (!saved) return false;

    const wasEditing = !!editingEntry;
    setShowLogForm(false);
    setEditingEntry(null);
    toast.success(
      wasEditing ? `Day ${entry.day} inspection updated` : `${label} saved`,
      {
        description:
          checkpointType === "later"
            ? `${entry.developing ?? 0} developing. ${entry.stoppedDeveloping ?? 0} stopped developing. ${entry.clear} clear.`
            : `${entry.fertile} fertile. ${entry.clear} clear. ${entry.uncertain} uncertain.`,
      },
    );
    return true;
  };

  const addPhotosToEntry = (day: number, urls: string[]) =>
    onUpdate({
      candlingLog: unit.candlingLog.map((e) =>
        e.day === day ? { ...e, photos: [...e.photos, ...urls] } : e,
      ),
    });

  const deletePhotoFromEntry = (day: number, photoIndex: number) =>
    onUpdate({
      candlingLog: unit.candlingLog.map((e) =>
        e.day === day
          ? { ...e, photos: e.photos.filter((_, idx) => idx !== photoIndex) }
          : e,
      ),
    });

  const updateEntryNote = (day: number, note: string) =>
    onUpdate({
      candlingLog: unit.candlingLog.map((e) =>
        e.day === day ? { ...e, note } : e,
      ),
    });

  const rustBtn = {
    backgroundColor: "var(--brand-primary)",
    color: "var(--on-brand)",
  };

  return (
    <div className="space-y-3 md:space-y-5">
      {/* Combined Hero: Incubation Timeline + Candling Progress */}
      <SectionCard title="Incubation Timeline" density="compact" divider>
        <Timeline
          currentDay={currentDay}
          totalDays={totalDays}
          candling={candling}
          candled={effectiveCandled}
          labelSize={9}
        />
        <div
          className="my-4"
          style={{ height: 1, backgroundColor: "var(--border-default)" }}
        />
        {latestCandlingEntry ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 md:grid md:grid-cols-2 md:content-start md:items-stretch">
                <div className="md:col-span-2 md:min-w-0">
                  <p
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--type-label)",
                      fontWeight: "var(--weight-extrabold)",
                      letterSpacing: "var(--tracking-label)",
                      lineHeight: "var(--leading-snug)",
                      color: "var(--brand-primary)",
                      textTransform: "uppercase",
                    }}
                  >
                    Latest inspection
                  </p>
                  <p
                    style={{
                      fontSize: "var(--type-body)",
                      fontWeight: "var(--weight-bold)",
                      color: "var(--text-primary)",
                      marginTop: 2,
                    }}
                  >
                    Day {latestCandlingEntry.day}, {latestCandlingEntry.label}
                  </p>
                  <p
                    style={{
                      fontSize: "var(--type-caption)",
                      color: "var(--text-secondary)",
                      marginTop: 1,
                    }}
                  >
                    Recorded {fmtTimestamp(latestCandlingEntry.date)}
                  </p>
                </div>
                <div
                  className="flex h-[58px] flex-col justify-center rounded-lg px-3.5 py-3 text-left md:block md:h-auto md:min-w-0 md:p-3.5"
                  style={{
                    backgroundColor: "var(--surface-track)",
                    border: `1px solid var(--border-default)`,
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--type-label)",
                      fontWeight: "var(--weight-extrabold)",
                      letterSpacing: "var(--tracking-label)",
                      lineHeight: "var(--leading-snug)",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                    }}
                  >
                    Initial fertility
                  </p>
                  <p
                    style={{
                      fontSize: "var(--type-body-sm)",
                      fontWeight: "var(--weight-bold)",
                      color: "var(--text-primary)",
                      marginTop: 2,
                    }}
                  >
                    {latestCandlingEntry.fertile} of {totalEggsSet} eggs
                    <span
                      style={{
                        marginLeft: 6,
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--type-heading-sm)",
                        fontWeight: "var(--weight-extrabold)",
                        lineHeight: "var(--leading-tight)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      {summaryFertilityRate !== null
                        ? `${summaryFertilityRate}%`
                        : "N/A"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-extrabold)",
                    letterSpacing: "var(--tracking-label)",
                    lineHeight: "var(--leading-snug)",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  Egg Development
                </p>
                {/* High-contrast stat tiles with big numbers */}
                <SummaryTiles
                  gridClassName="grid grid-cols-4 gap-2 md:grid-cols-2"
                  tiles={isLaterSummary ? laterTiles : firstTiles}
                />
              </div>
            </div>

            <div
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t pt-4"
              style={{ borderColor: "var(--border-default)" }}
            >
              <div className="col-start-1 flex flex-wrap items-center gap-2">
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-extrabold)",
                    letterSpacing: "var(--tracking-label)",
                    lineHeight: "var(--leading-snug)",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  {pendingCheckpoint ? "Next checkpoint" : "Candling schedule"}
                </p>
                {pendingCheckpoint && checkpointDistance !== null && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5"
                    style={{
                      backgroundColor:
                        checkpointDistance < 0
                          ? "var(--status-danger-bg)"
                          : checkpointDistance === 0
                            ? "var(--status-warning-bg)"
                            : "var(--surface-muted)",
                      color:
                        checkpointDistance < 0
                          ? "var(--status-danger-fg)"
                          : checkpointDistance === 0
                            ? "var(--status-warning-fg)"
                            : "var(--text-secondary)",
                      fontSize: "var(--type-label)",
                      fontWeight: "var(--weight-bold)",
                      letterSpacing: "var(--tracking-label)",
                    }}
                  >
                    {checkpointTiming}
                  </span>
                )}
              </div>
              {canLog && (
                <Button
                  onClick={openNewInspection}
                  aria-label="Log inspection"
                  className="col-start-2 row-span-2 h-[var(--control-height-default)] shrink-0 items-center justify-self-end gap-1 self-center rounded-full px-6 text-(length:--type-filter-label) font-bold md:h-[var(--control-height-toolbar)] md:text-sm md:font-medium"
                  style={{ ...rustBtn }}
                >
                  <Plus size={14} /> Log
                </Button>
              )}
              <div className="col-start-1 mt-1">
                <span
                  style={{
                    fontSize: "var(--type-body)",
                    fontWeight: "var(--weight-bold)",
                    color: "var(--text-primary)",
                  }}
                >
                  {pendingCheckpoint
                    ? `${pendingCheckpoint.label} on Day ${pendingCheckpoint.day}`
                    : "All scheduled checks completed"}
                </span>
              </div>
              {!canLog && (
                <p
                  className="col-span-2 w-full md:text-right"
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "var(--type-caption)",
                  }}
                >
                  Start an incubation cycle to log inspections.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--type-label)",
                  fontWeight: "var(--weight-extrabold)",
                  letterSpacing: "var(--tracking-label)",
                  lineHeight: "var(--leading-snug)",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                }}
              >
                Egg Development
              </p>
              <SummaryTiles
                gridClassName="grid grid-cols-4 gap-2 md:grid-cols-4"
                tiles={emptyTiles}
              />
            </div>
            <div
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t pt-4"
              style={{ borderColor: "var(--border-default)" }}
            >
              <div className="col-start-1 flex flex-wrap items-center gap-2">
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-extrabold)",
                    letterSpacing: "var(--tracking-label)",
                    lineHeight: "var(--leading-snug)",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  {pendingCheckpoint ? "Next checkpoint" : "Candling schedule"}
                </p>
                {pendingCheckpoint && checkpointDistance !== null && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5"
                    style={{
                      backgroundColor:
                        checkpointDistance < 0
                          ? "var(--status-danger-bg)"
                          : checkpointDistance === 0
                            ? "var(--status-warning-bg)"
                            : "var(--surface-muted)",
                      color:
                        checkpointDistance < 0
                          ? "var(--status-danger-fg)"
                          : checkpointDistance === 0
                            ? "var(--status-warning-fg)"
                            : "var(--text-secondary)",
                      fontSize: "var(--type-label)",
                      fontWeight: "var(--weight-bold)",
                      letterSpacing: "var(--tracking-label)",
                    }}
                  >
                    {checkpointTiming}
                  </span>
                )}
              </div>
              {canLog && (
                <Button
                  onClick={openNewInspection}
                  disabled={isUpdating}
                  aria-label="Log inspection"
                  className="col-start-2 row-span-2 h-[var(--control-height-default)] shrink-0 items-center justify-self-end gap-1 self-center rounded-full px-6 text-(length:--type-filter-label) font-bold md:h-[var(--control-height-toolbar)] md:text-sm md:font-medium"
                  style={{ ...rustBtn }}
                >
                  <Plus size={14} /> Log
                </Button>
              )}
              <div className="col-start-1 mt-1">
                <span
                  style={{
                    fontSize: "var(--type-body)",
                    fontWeight: "var(--weight-bold)",
                    color: "var(--text-primary)",
                  }}
                >
                  {pendingCheckpoint
                    ? `${pendingCheckpoint.label} on Day ${pendingCheckpoint.day}`
                    : "Candling checks scheduled"}
                </span>
              </div>
              {!canLog && (
                <p
                  className="col-span-2 w-full md:text-right"
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "var(--type-caption)",
                  }}
                >
                  Start an incubation cycle to log inspections.
                </p>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <LogModal
        open={showLogForm && (canLog || editingEntry !== null)}
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* LEFT — inspection history feed */}
        <div className="space-y-4 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <p
              style={{
                fontSize: "calc(var(--type-heading-md) - 2px)",
                fontWeight: "var(--weight-bold)",
                color: "var(--text-primary)",
              }}
            >
              Candling Journal
            </p>
            <button
              type="button"
              onClick={() => setCalOpen(true)}
              aria-label="Open calendar"
              title="Open calendar"
              className="inline-flex h-[58px] w-[58px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--brand-primary)] shadow-sm transition-colors hover:bg-[var(--surface-action-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 lg:hidden"
            >
              <CalendarDays size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="relative pt-[24px]">
            <div className="relative">
              <div
                className="absolute top-0 bottom-0 left-0 flex flex-col items-center"
                style={{ width: 40 }}
              >
                <span
                  className="absolute font-bold"
                  style={{
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: "var(--type-label)",
                    fontWeight: "var(--weight-bold)",
                    textTransform: "uppercase",
                    letterSpacing: "var(--tracking-label)",
                    color: "var(--text-muted)",
                    lineHeight: "1",
                    zIndex: "var(--z-overlay)",
                    whiteSpace: "nowrap",
                  }}
                >
                  DAY
                </span>
                <div
                  className="w-0.5 flex-1"
                  style={{
                    marginTop: 24,
                    backgroundColor: "var(--border-subtle)",
                  }}
                />
              </div>

              <ul className="space-y-5">
                {feedNodes.map((n) =>
                  n.kind === "logged" ? (
                    <li
                      key={`log-${n.day}`}
                      className="group relative flex items-start"
                    >
                      <div
                        className={
                          expandedDays.has(n.day)
                            ? "shrink-0 relative z-10 flex justify-center self-start"
                            : "shrink-0 relative z-10 flex justify-center self-center"
                        }
                        style={{ width: 40 }}
                      >
                        <span
                          className="flex items-center justify-center rounded-full"
                          style={{
                            width: "var(--control-size-xs)",
                            height: "var(--control-size-xs)",
                            backgroundColor: "var(--brand-primary)",
                            color: "var(--surface-card)",
                            fontSize: "var(--type-body-sm)",
                            fontWeight: "var(--weight-bold)",
                            boxShadow: `0 0 0 3px var(--surface-app)`,
                          }}
                        >
                          {formatNodeDay(n.day)}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 pl-3">
                        <div
                          className="flex items-center justify-between gap-2"
                          style={{ minHeight: "var(--control-height-compact)" }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDays((days) => {
                                const next = new Set(days);
                                if (next.has(n.day)) next.delete(n.day);
                                else next.add(n.day);
                                return next;
                              })
                            }
                            className="flex min-h-[var(--control-height-default)] min-w-0 cursor-pointer flex-wrap items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 md:min-h-8"
                            style={{
                              fontSize: "calc(var(--type-filter-label) - 1px)",
                              fontWeight: "var(--weight-bold)",
                              color: "var(--text-primary)",
                            }}
                            aria-expanded={expandedDays.has(n.day)}
                            aria-controls={`journal-entry-${n.day}`}
                            aria-label={`${expandedDays.has(n.day) ? "Hide" : "Show"} details for Day ${n.entry.day}`}
                          >
                            <span>
                              {n.idx >= 0
                                ? (CANDLE_SHORT_LABELS[n.idx] ?? n.entry.label)
                                : n.entry.label}
                            </span>
                            <CircleCheck
                              size={14}
                              strokeWidth={2.5}
                              className="shrink-0 text-[var(--status-success-fg)]"
                              aria-hidden="true"
                            />
                            <ChevronDown
                              size={16}
                              className={`ml-0.5 text-[var(--text-muted)] transition-transform duration-200 ${expandedDays.has(n.day) ? "rotate-180" : ""}`}
                              aria-hidden="true"
                            />
                          </button>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span
                              className="mr-3 text-right"
                              style={{
                                fontSize: "var(--type-label)",
                                color: "var(--text-farm)",
                              }}
                            >
                              {fmtTimestamp(n.entry.date)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEntry(n.entry);
                                setShowLogForm(true);
                              }}
                              className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-action-hover)] hover:text-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 md:h-8 md:w-8"
                              aria-label={`Edit entry for Day ${n.entry.day}`}
                              title="Edit Inspection"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEntryToDelete(n.entry)}
                              className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 md:h-8 md:w-8"
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
                  ) : (
                    (() => {
                      const isDue = n.cp.day <= currentDay;
                      return (
                        <li
                          key={`cp-${n.day}`}
                          className="relative flex items-center min-h-[var(--control-height-compact)]"
                        >
                          <div
                            className="shrink-0 flex justify-center relative z-10"
                            style={{ width: 40 }}
                          >
                            <span
                              className="flex items-center justify-center rounded-full"
                              style={{
                                width: "var(--control-size-xs)",
                                height: "var(--control-size-xs)",
                                backgroundColor: "var(--surface-card)",
                                border: isDue
                                  ? "2px solid var(--status-warning-fg)"
                                  : "2px solid var(--border-subtle)",
                                color: isDue
                                  ? "var(--status-warning-fg)"
                                  : "var(--text-muted)",
                                fontSize: "var(--type-body-sm)",
                                fontWeight: "var(--weight-bold)",
                                boxShadow: `0 0 0 3px var(--surface-app)`,
                              }}
                            >
                              {formatNodeDay(n.day)}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0 pl-3">
                            {isDue ? (
                              <p
                                className="flex flex-wrap items-center gap-1.5"
                                style={{
                                  fontSize: "var(--type-body-sm)",
                                  fontWeight: "var(--weight-bold)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                {CANDLE_SHORT_LABELS[n.idx] ?? n.cp.label}
                                <AlertCircle
                                  size={15}
                                  color="var(--status-warning-fg)"
                                  strokeWidth={2}
                                  aria-label="Inspection due"
                                />
                              </p>
                            ) : (
                              <p
                                style={{
                                  fontSize: "var(--type-body-sm)",
                                  fontWeight: "var(--weight-semibold)",
                                  color: "var(--text-muted)",
                                }}
                              >
                                {CANDLE_SHORT_LABELS[n.idx] ?? n.cp.label}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })()
                  ),
                )}
              </ul>
            </div>

            {loggedEntries.length === 0 && (
              <div className="mx-auto mt-6 max-w-lg">
                <StatusCallout
                  size="sm"
                  tone="warning"
                  title="No inspection recorded yet"
                  description="Check the eggs, then click “Log Inspection” above to record your count. Notes and photos are optional."
                />
              </div>
            )}

            {/* Delete Confirmation Modal */}
            <AlertDialog
              open={entryToDelete !== null}
              onOpenChange={(open) => {
                if (!isUpdating && !open) setEntryToDelete(null);
              }}
            >
              <AlertDialogContent
                className="rounded-2xl border-[var(--border-default)]"
                style={{
                  backgroundColor: "var(--surface-subtle)",
                  color: "var(--text-primary)",
                }}
              >
                <AlertDialogHeader className="text-left">
                  <AlertDialogTitle
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "var(--type-heading-md)",
                      fontWeight: "var(--weight-bold)",
                    }}
                  >
                    Delete Journal Entry?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="mt-2">
                      <StatusCallout
                        size="sm"
                        tone="danger"
                        title="Delete entry"
                        description={`Are you sure you want to delete this inspection log for Day ${entryToDelete?.day}? This will recalculate the cycle summary and cannot be undone.`}
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    className="rounded-full"
                    style={{
                      borderColor: "var(--border-default)",
                      color: "var(--text-secondary)",
                      height: 34,
                      fontSize: "var(--type-body)",
                    }}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-full"
                    style={{
                      backgroundColor: "var(--status-danger-fg)",
                      color: "var(--surface-card)",
                      height: 34,
                      fontSize: "var(--type-body)",
                    }}
                    disabled={isUpdating}
                    aria-busy={isUpdating}
                    onClick={(event) => {
                      event.preventDefault();
                      if (entryToDelete) {
                        void deleteJournalEntry(entryToDelete.day).then(
                          (deleted) => {
                            if (deleted) setEntryToDelete(null);
                          },
                        );
                      }
                    }}
                  >
                    {isUpdating ? "Deleting…" : "Delete Entry"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* RIGHT — Incubation Calendar */}
        <div className="hidden space-y-5 lg:col-span-2 lg:block">
          <IncubationCalendar
            currentDay={currentDay}
            totalDays={totalDays}
            candling={candling}
          />
        </div>
        <Dialog open={calOpen} onOpenChange={setCalOpen}>
          <DialogContent
            ref={calScrollRef}
            className="max-h-[85dvh] w-[90vw] overflow-y-auto rounded-2xl border-0 bg-[var(--surface-card)] p-4 shadow-xl md:border md:border-[var(--border-subtle)]"
          >
            <DialogTitle className="sr-only">Incubation calendar</DialogTitle>
            <CalendarSheetBody
              currentDay={currentDay}
              totalDays={totalDays}
              candling={candling}
              onPageChange={() => {
                calScrollRef.current?.scrollTo({ top: 0 });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
