import { useEffect, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import logoApp from "../../imports/logo-app.png";

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

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  const closePanel = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="fixed bottom-20 right-4 z-[70] lg:bottom-6 lg:right-6">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Eggcelerate help"
          className="absolute bottom-[68px] right-0 flex max-h-[min(520px,70vh)] w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8DED1", boxShadow: "0 18px 45px rgba(45,26,14,0.18)" }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3.5" style={{ backgroundColor: "#FFF8F1", borderBottom: "1px solid #EFE7DC" }}>
            <div className="flex min-w-0 items-center gap-2.5">
              <img src={logoApp} alt="" aria-hidden="true" className="h-9 w-9 rounded-xl object-cover" />
              <div className="min-w-0">
                <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 800 }}>Eggcelerate Help</p>
                <p style={{ color: "var(--text-muted)", fontSize: 11 }}>Quick answers for your incubator</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#F2E8DC] focus-visible:outline-none focus-visible:ring-2"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Close help"
            >
              <X size={17} />
            </button>
          </div>

          <div className="overflow-y-auto p-4">
            <div className="rounded-2xl rounded-tl-md px-3.5 py-3" style={{ backgroundColor: "#F5EFE6", color: "var(--text-secondary)" }}>
              <p style={{ fontSize: 13, lineHeight: 1.45 }}>
                Hi, Farmer! Choose a question below and I’ll help you find the answer.
              </p>
            </div>

            {selectedIndex !== null && (
              <div className="mt-3 space-y-2.5" aria-live="polite">
                <div className="ml-8 rounded-2xl rounded-tr-md px-3.5 py-3" style={{ backgroundColor: "var(--brand-primary)", color: "var(--on-brand)" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>{FAQS[selectedIndex].question}</p>
                </div>
                <div className="mr-5 rounded-2xl rounded-tl-md px-3.5 py-3" style={{ backgroundColor: "#F5EFE6", color: "var(--text-secondary)" }}>
                  <p style={{ fontSize: 12, lineHeight: 1.5 }}>{FAQS[selectedIndex].answer}</p>
                </div>
              </div>
            )}

            <div className="mt-4">
              <p style={{ color: "#8A6B52", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Frequently asked
              </p>
              <div className="mt-2 space-y-2">
                {FAQS.map((faq, index) => (
                  <button
                    key={faq.question}
                    type="button"
                    onClick={() => setSelectedIndex(index)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#FFF8F1] focus-visible:outline-none focus-visible:ring-2"
                    style={{ border: "1px solid #EAE2D8", color: "#3F342C" }}
                    aria-pressed={selectedIndex === index}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35 }}>{faq.question}</span>
                    <ChevronRight size={15} className="shrink-0" style={{ color: "var(--brand-primary)" }} />
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
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-14 w-14 items-center justify-center rounded-2xl transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8DED1", boxShadow: "0 8px 24px rgba(45,26,14,0.18)" }}
        aria-label={open ? "Close Eggcelerate help" : "Open Eggcelerate help"}
        aria-expanded={open}
      >
        <img src={logoApp} alt="" aria-hidden="true" className="h-11 w-11 rounded-xl object-cover" />
        <span
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--on-brand)", border: "2px solid var(--surface-card)", fontSize: 11, fontWeight: 800 }}
          aria-hidden="true"
        >
          ?
        </span>
      </button>
    </div>
  );
}
