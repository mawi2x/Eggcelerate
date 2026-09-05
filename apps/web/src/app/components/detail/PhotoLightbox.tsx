import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize,
  Maximize2,
  Minimize2,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { cn } from "../ui/utils";

const ZOOM_MIN = 25;
const ZOOM_MAX = 400;
const ZOOM_STEP = 25;

const VIEWER_SHELL_CLASS =
  "border-none p-0 overflow-hidden shadow-2xl bg-[var(--overlay-bg)]/95 backdrop-blur-xl text-white transition-all duration-300";
const VIEWER_SHELL_FULLSCREEN =
  "h-[88vh] grid-rows-[auto_1fr] gap-0 rounded-2xl";
const VIEWER_SHELL_NORMAL = "w-[92vw] rounded-3xl";
const VIEWER_VIEWPORT_CLASS =
  "relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden transition-all select-none";
const VIEWER_VIEWPORT_FULLSCREEN = "h-full w-full";
const VIEWER_VIEWPORT_NORMAL =
  "h-auto w-full min-h-[400px] max-h-[82vh] p-4 sm:p-6 bg-black/40";
const VIEWER_IMAGE_FULLSCREEN = "absolute left-1/2 top-1/2 block";
const VIEWER_IMAGE_NORMAL =
  "mx-auto block h-auto w-auto max-h-[65vh] max-w-full rounded-2xl shadow-2xl";

interface PhotoLightboxModalProps {
  open: boolean;
  photos: string[];
  initialIndex: number;
  day: number;
  onClose: () => void;
  onDelete: (idx: number) => void;
}

export function PhotoLightboxModal({
  open,
  photos = [],
  initialIndex,
  day,
  onClose,
  onDelete,
}: PhotoLightboxModalProps) {
  const safePhotos = (photos || []).filter(
    (p) => typeof p === "string" && p.trim().length > 0,
  );
  const total = safePhotos.length;
  const safeInitial =
    total > 0 ? Math.min(Math.max(0, initialIndex), total - 1) : 0;
  const [currentIndex, setCurrentIndex] = useState(safeInitial);
  const [fullscreen, setFullscreen] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Zoom state — 0 means "fit to screen", otherwise a percentage in [25, 400].
  const [zoom, setZoom] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const displayRef = useRef<HTMLDivElement>(null);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  // biome-ignore lint/correctness/useExhaustiveDependencies: open intentionally resets viewer when dialog opens/closes
  useEffect(() => {
    const s = total > 0 ? Math.min(Math.max(0, initialIndex), total - 1) : 0;
    setCurrentIndex(s);
    setFullscreen(false);
    setImgError(false);
    setZoom(0);
    setPan({ x: 0, y: 0 });
    setNatural({ w: 0, h: 0 });
  }, [initialIndex, open, total]);

  const safeIndex =
    total > 0 ? Math.min(Math.max(0, currentIndex), total - 1) : 0;
  const currentPhoto = safePhotos[safeIndex];

  // Keep the usable viewer size measured so the fit scale stays accurate.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fullscreen intentionally re-measures when layout changes
  useEffect(() => {
    const el = displayRef.current;
    if (!el || !open) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setViewSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, fullscreen]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset intentionally runs when displayed photo changes
  useEffect(() => {
    setImgError(false);
    setZoom(0);
    setPan({ x: 0, y: 0 });
    setNatural({ w: 0, h: 0 });
  }, [currentPhoto, safeIndex]);

  // Scale that fits the whole photo inside the viewer, preserving aspect ratio.
  const fitScale = useMemo(() => {
    if (viewSize.w <= 0 || viewSize.h <= 0 || natural.w <= 0 || natural.h <= 0)
      return 1;
    return Math.min(viewSize.w / natural.w, viewSize.h / natural.h);
  }, [viewSize, natural]);

  const scale = zoom === 0 ? fitScale : zoom / 100;
  const canPan =
    scale * natural.w > viewSize.w + 1 || scale * natural.h > viewSize.h + 1;

  const clampPan = useCallback(
    (x: number, y: number) => {
      const ox = Math.max(0, (scale * natural.w - viewSize.w) / 2);
      const oy = Math.max(0, (scale * natural.h - viewSize.h) / 2);
      return {
        x: Math.min(ox, Math.max(-ox, x)),
        y: Math.min(oy, Math.max(-oy, y)),
      };
    },
    [scale, natural, viewSize],
  );

  // Keep the pan inside bounds whenever the zoom level changes.
  useEffect(() => {
    setPan((p) => clampPan(p.x, p.y));
  }, [clampPan]);

  const fromFit = useCallback(
    (z: number) =>
      z === 0 ? Math.round((fitScale * 100) / ZOOM_STEP) * ZOOM_STEP : z,
    [fitScale],
  );

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, fromFit(z) + ZOOM_STEP));
  }, [fromFit]);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, fromFit(z) - ZOOM_STEP));
  }, [fromFit]);

  const resetView = useCallback(() => {
    setZoom(0);
    setPan({ x: 0, y: 0 });
  }, []);

  // Mouse wheel zooms over the image area while fullscreen.
  useEffect(() => {
    const el = displayRef.current;
    if (!el || !open || !fullscreen) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, fullscreen, zoomIn, zoomOut]);

  const toggleFullscreen = () => {
    setFullscreen((f) => !f);
    setZoom(0);
    setPan({ x: 0, y: 0 });
  };

  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    setImgError(false);
    setCurrentIndex((i) => (i - 1 + total) % total);
  }, [total]);

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    setImgError(false);
    setCurrentIndex((i) => (i + 1) % total);
  }, [total]);

  const handleDownload = () => {
    if (!currentPhoto) return;
    const a = document.createElement("a");
    a.href = currentPhoto;
    a.download = `candling-day-${day}-photo-${safeIndex + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Photo downloaded");
  };

  const handleDeleteCurrent = () => {
    onDelete(safeIndex);
    if (total <= 1) {
      onClose();
    } else {
      setCurrentIndex((i) => (i >= total - 1 ? total - 2 : i));
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!canPan) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!dragging) return;
    setPan(
      clampPan(
        dragStart.current.px + (e.clientX - dragStart.current.x),
        dragStart.current.py + (e.clientY - dragStart.current.y),
      ),
    );
  };

  const onPointerEnd = () => setDragging(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-" || e.key === "_") zoomOut();
      if (e.key === "0") resetView();
      if (e.key === "Escape") {
        if (fullscreen) {
          setFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    open,
    fullscreen,
    handlePrev,
    handleNext,
    zoomIn,
    zoomOut,
    resetView,
    onClose,
  ]);

  if (!open || total === 0 || !currentPhoto) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        hideClose
        size={fullscreen ? "fullscreen" : "large"}
        className={cn(
          VIEWER_SHELL_CLASS,
          fullscreen ? VIEWER_SHELL_FULLSCREEN : VIEWER_SHELL_NORMAL,
        )}
        style={{
          border: "var(--border-width-hairline) solid var(--overlay-border)",
        }}
      >
        <DialogTitle className="sr-only">Candling Photo Viewer</DialogTitle>
        <DialogDescription className="sr-only">
          High resolution photo preview with download and navigation
        </DialogDescription>

        {/* Top Header Bar with Single Unified Close Button */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 select-none sm:flex-nowrap sm:px-6 sm:py-4">
          <span className="shrink-0 text-sm font-semibold text-[var(--overlay-fg)]">
            Photo {safeIndex + 1} of {total}
          </span>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-11 w-11 min-h-11 min-w-11 rounded-full p-0 text-[var(--overlay-fg)] hover:bg-white/10 hover:text-white sm:h-8 sm:w-auto sm:min-h-0 sm:min-w-0 sm:px-3"
              onClick={toggleFullscreen}
              title={
                fullscreen ? "Exit Fullscreen (Esc)" : "Enlarge / Fullscreen"
              }
              aria-label={fullscreen ? "Exit fullscreen" : "Enlarge photo"}
            >
              {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span className="hidden sm:inline">
                {fullscreen ? "Exit Fullscreen" : "Enlarge"}
              </span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-11 w-11 min-h-11 min-w-11 rounded-full p-0 text-[var(--overlay-fg)] hover:bg-white/10 hover:text-white sm:h-8 sm:w-auto sm:min-h-0 sm:min-w-0 sm:px-3"
              onClick={handleDownload}
              title="Download photo"
              aria-label="Download photo"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-11 w-11 min-h-11 min-w-11 rounded-full p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300 sm:h-8 sm:w-auto sm:min-h-0 sm:min-w-0 sm:px-3"
              onClick={handleDeleteCurrent}
              title="Delete photo"
              aria-label="Delete photo"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Delete</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="ml-0 flex h-11 w-11 min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full p-0 text-stone-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 sm:ml-2 sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 sm:p-1.5"
              aria-label="Close photo viewer"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main High-Resolution Photo Display Area */}
        <div
          ref={displayRef}
          className={cn(
            VIEWER_VIEWPORT_CLASS,
            fullscreen ? VIEWER_VIEWPORT_FULLSCREEN : VIEWER_VIEWPORT_NORMAL,
          )}
        >
          {total > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-4 sm:left-6 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
              aria-label="Previous photo"
              title="Previous photo (←)"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {!imgError && currentPhoto ? (
            <img
              src={currentPhoto}
              alt={`Candling inspection ${safeIndex + 1}`}
              draggable={false}
              onLoad={(e) =>
                setNatural({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
              onError={() => setImgError(true)}
              onPointerDown={fullscreen ? onPointerDown : undefined}
              onPointerMove={fullscreen ? onPointerMove : undefined}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              className={cn(
                fullscreen ? VIEWER_IMAGE_FULLSCREEN : VIEWER_IMAGE_NORMAL,
              )}
              style={
                fullscreen
                  ? {
                      transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                      cursor: dragging
                        ? "grabbing"
                        : canPan
                          ? "grab"
                          : "default",
                      transition: dragging
                        ? "none"
                        : "transform 0.15s ease-out",
                      touchAction: "none",
                    }
                  : undefined
              }
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-white/5 border border-white/10 text-stone-300">
              <Camera
                size={48}
                className="mb-3 text-[var(--overlay-muted)] opacity-70"
              />
              <p className="text-(length:--type-heading-sm) font-semibold text-[var(--overlay-fg)]">
                Image could not be loaded
              </p>
              <p className="text-xs text-[var(--overlay-muted)] mt-1">
                The photo format or source is unavailable
              </p>
            </div>
          )}

          {total > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-4 sm:right-6 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
              aria-label="Next photo"
              title="Next photo (→)"
            >
              <ChevronRight size={24} />
            </button>
          )}

          {/* Zoom controls — bottom-right, fullscreen only */}
          {fullscreen && (
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-full bg-black/60 py-1.5 pl-2 pr-1.5 backdrop-blur select-none">
              <button
                type="button"
                onClick={zoomOut}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--overlay-fg)] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 sm:h-8 sm:w-8"
                aria-label="Zoom out"
                title="Zoom out (-)"
              >
                <ZoomOut size={16} />
              </button>
              <span className="min-w-[54px] text-center text-xs font-semibold text-[var(--overlay-fg)] tabular-nums">
                {zoom === 0 ? "Fit" : `${zoom}%`}
              </span>
              <button
                type="button"
                onClick={zoomIn}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--overlay-fg)] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 sm:h-8 sm:w-8"
                aria-label="Zoom in"
                title="Zoom in (+)"
              >
                <ZoomIn size={16} />
              </button>
              <span className="mx-1 h-4 w-px bg-white/20" aria-hidden />
              <button
                type="button"
                onClick={resetView}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--overlay-fg)] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 sm:h-8 sm:w-8"
                aria-label="Fit to screen"
                title="Fit to screen (0)"
              >
                <Maximize size={15} />
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
