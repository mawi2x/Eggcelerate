import { ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import logoApp from "../../imports/logo-app.webp";

const FAQS = [
  {
    question: "What does Needs Attention mean?",
    answer:
      "One or more chamber checks are outside the normal range. Review temperature, humidity, water, power, connectivity, and the next tray-turn time in Live Monitor.",
  },
  {
    question: "When should I candle the eggs?",
    answer:
      "Follow the candling days marked on the chamber timeline. Eggcelerate adjusts these checkpoints to the incubation mode assigned to the chamber.",
  },
  {
    question: "What happens during lockdown?",
    answer:
      "Lockdown is the final stage before hatch. Tray turning stops, humidity should remain stable, and the incubator should stay closed as much as possible.",
  },
  {
    question: "Where can I see past readings?",
    answer:
      "Open Trends for historical temperature, humidity, water, and hatch-performance information. From Live Monitor, select Full trends.",
  },
] as const;

export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Dragging state
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const dragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    initialPosX: number;
    initialPosY: number;
    hasMoved: boolean;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialPosX: 0,
    initialPosY: 0,
    hasMoved: false,
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only drag on primary click / touch
    if (e.button !== 0) return;
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: position.x,
      initialPosY: position.y,
      hasMoved: false,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.hasMoved = true;
    }
    if (dragRef.current.hasMoved) {
      setPosition({
        x: dragRef.current.initialPosX + dx,
        y: dragRef.current.initialPosY + dy,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.isDragging) return;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    const moved = dragRef.current.hasMoved;
    dragRef.current.isDragging = false;
    if (!moved) {
      setOpen((v) => !v);
    }
  };

  const closePanel = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      closePanel();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [open, closePanel]);

  return (
    <div
      className="fixed bottom-[var(--mobile-bottom-nav-clearance)] right-4 z-[70] touch-none select-none md:bottom-6 md:right-6"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
    >
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Eggcelerate help"
          className="touch-auto select-auto absolute bottom-[68px] right-0 flex max-h-[min(520px,70vh)] w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl"
          style={{
            backgroundColor: "var(--surface-card)",
            border: "var(--border-width-hairline) solid var(--border-help)",
            boxShadow: "var(--shadow-float)",
          }}
        >
          <div
            className="flex items-center justify-between gap-3 px-4 py-3.5"
            style={{
              backgroundColor: "var(--surface-help)",
              borderBottom:
                "var(--border-width-hairline) solid var(--border-help-soft)",
            }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <img
                src={logoApp}
                alt=""
                aria-hidden="true"
                className="h-9 w-9 rounded-xl object-cover"
              />
              <div className="min-w-0">
                <p
                  style={{
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--type-body)",
                    fontWeight: "var(--weight-extrabold)",
                    lineHeight: "var(--leading-snug)",
                  }}
                >
                  Eggcelerate Help
                </p>
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "var(--type-label)",
                  }}
                >
                  Quick answers for your incubator
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-help-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Close help"
            >
              <X size={17} />
            </button>
          </div>

          <div className="overflow-y-auto p-4">
            <div
              className="rounded-2xl rounded-tl-md px-3.5 py-3"
              style={{
                backgroundColor: "var(--surface-track)",
                color: "var(--text-secondary)",
              }}
            >
              <p style={{ fontSize: "var(--type-body-sm)", lineHeight: 1.45 }}>
                Hi, Farmer! Choose a question below and I’ll help you find the
                answer.
              </p>
            </div>

            {selectedIndex !== null && (
              <div className="mt-3 space-y-2.5" aria-live="polite">
                <div
                  className="ml-8 rounded-2xl rounded-tr-md px-3.5 py-3"
                  style={{
                    backgroundColor: "var(--brand-primary)",
                    color: "var(--on-brand)",
                  }}
                >
                  <p
                    style={{
                      fontSize: "var(--type-caption)",
                      fontWeight: "var(--weight-bold)",
                      lineHeight: 1.4,
                    }}
                  >
                    {FAQS[selectedIndex].question}
                  </p>
                </div>
                <div
                  className="mr-5 rounded-2xl rounded-tl-md px-3.5 py-3"
                  style={{
                    backgroundColor: "var(--surface-track)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <p
                    style={{ fontSize: "var(--type-caption)", lineHeight: 1.5 }}
                  >
                    {FAQS[selectedIndex].answer}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4">
              <p
                style={{
                  color: "var(--text-taupe)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--type-label)",
                  fontWeight: "var(--weight-extrabold)",
                  letterSpacing: "var(--tracking-label)",
                  lineHeight: "var(--leading-snug)",
                  textTransform: "uppercase",
                }}
              >
                Frequently asked
              </p>
              <div className="mt-2 space-y-2">
                {FAQS.map((faq, index) => (
                  <button
                    key={faq.question}
                    type="button"
                    onClick={() => setSelectedIndex(index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-help)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
                    style={{
                      border:
                        "var(--border-width-hairline) solid var(--border-help-row)",
                      color: "var(--text-help)",
                    }}
                    aria-pressed={selectedIndex === index}
                  >
                    <span
                      style={{
                        fontSize: "var(--type-caption)",
                        fontWeight: "var(--weight-bold)",
                        lineHeight: 1.35,
                      }}
                    >
                      {faq.question}
                    </span>
                    <ChevronRight
                      size={15}
                      className="shrink-0"
                      style={{ color: "var(--brand-primary)" }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          dragRef.current.isDragging = false;
        }}
        className="relative flex h-14 w-14 cursor-grab items-center justify-center rounded-2xl transition-transform hover:-translate-y-0.5 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          backgroundColor: "var(--surface-card)",
          border: "var(--border-width-hairline) solid var(--border-help)",
          boxShadow: "var(--shadow-bubble)",
        }}
        aria-label={open ? "Close Eggcelerate help" : "Open Eggcelerate help"}
        aria-expanded={open}
      >
        <img
          src={logoApp}
          alt=""
          aria-hidden="true"
          className="pointer-events-none h-11 w-11 rounded-xl object-cover"
        />
        <span
          className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1"
          style={{
            backgroundColor: "var(--brand-primary)",
            color: "var(--on-brand)",
            border: "2px solid var(--surface-card)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-label)",
            fontWeight: "var(--weight-extrabold)",
            lineHeight: "var(--leading-snug)",
            letterSpacing: "var(--tracking-label)",
          }}
          aria-hidden="true"
        >
          ?
        </span>
      </button>
    </div>
  );
}
