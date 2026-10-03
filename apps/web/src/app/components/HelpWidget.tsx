import { ChevronRight } from "lucide-react";
import { useState } from "react";
import logoApp from "../../imports/logo-app.webp";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { useIsMobile } from "./ui/use-mobile";

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

export function HelpWidget({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isMobile = useIsMobile();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 cursor-pointer items-center justify-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 md:flex"
          style={{
            backgroundColor: "var(--surface-card)",
            border: "var(--border-width-hairline) solid var(--border-help)",
            boxShadow: "var(--shadow-bubble)",
          }}
          aria-label="Open Eggcelerate help"
        >
          <img
            src={logoApp}
            alt=""
            aria-hidden="true"
            className="h-11 w-11 rounded-xl object-cover"
          />
          <span
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[var(--on-brand)]"
            aria-hidden="true"
          >
            ?
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        hideClose
        className="gap-0 rounded-2xl p-0 md:max-w-sm md:p-0"
        style={{
          backgroundColor: "var(--surface-card)",
          borderColor: "var(--border-help)",
        }}
        onCloseAutoFocus={(event) => {
          if (isMobile) {
            event.preventDefault();
            document.getElementById("mobile-more-trigger")?.focus();
          }
        }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-4 py-3"
          style={{
            backgroundColor: "var(--surface-help)",
            borderColor: "var(--border-help-soft)",
          }}
        >
          <div className="min-w-0">
            <DialogTitle className="font-[var(--font-display)] text-[var(--text-primary)]">
              Eggcelerate Help
            </DialogTitle>
            <DialogDescription className="mt-1 text-(length:--type-body-sm)">
              Quick answers for your incubator
            </DialogDescription>
          </div>
          <DialogClose className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg px-3 text-(length:--type-body) font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-help-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            Close
          </DialogClose>
        </div>
        <div className="space-y-4 p-4 text-(length:--type-body) text-[var(--text-secondary)]">
          <p>Choose a question below to find the answer.</p>
          <div className="space-y-2">
            {FAQS.map((faq, index) => (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIndex(selectedIndex === index ? null : index)
                  }
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left font-bold hover:bg-[var(--surface-help)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
                  style={{
                    borderColor: "var(--border-help-row)",
                    color: "var(--text-help)",
                  }}
                  aria-expanded={selectedIndex === index}
                  aria-controls={`help-answer-${index}`}
                >
                  <span>{faq.question}</span>
                  <ChevronRight
                    size={18}
                    aria-hidden="true"
                    className={`shrink-0 text-[var(--brand-primary)] ${selectedIndex === index ? "rotate-90" : ""}`}
                  />
                </button>
                <div
                  id={`help-answer-${index}`}
                  hidden={selectedIndex !== index}
                  className="px-3 py-3 leading-relaxed"
                >
                  {faq.answer}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
