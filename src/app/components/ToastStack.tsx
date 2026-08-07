import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Info } from "lucide-react";

// Dark charcoal surface from the toast spec.
const TOAST_BG = "#1A1510";
const SAGE = "#93B58C";
const NEUTRAL = "#C9BEB0";

export interface ToastItem {
  id: number;
  message: string;
  kind: "enabled" | "disabled";
}

const LIFETIME_MS = 2600;

/**
 * Bottom-right toast stack. Returns a `push` callback that queues a toast and
 * auto-dismisses it; toasts can also be dismissed by clicking them.
 */
export function useToastStack() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (message: string, kind: ToastItem["kind"]) => {
      const id = nextId.current++;
      // Keep the stack shallow so it never covers the sticky save bar.
      setToasts((prev) => [...prev.slice(-2), { id, message, kind }]);
      timers.current[id] = setTimeout(() => dismiss(id), LIFETIME_MS);
    },
    [dismiss],
  );

  // Clear pending timers if the screen unmounts mid-animation.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      Object.values(pending).forEach(clearTimeout);
    };
  }, []);

  return { toasts, push, dismiss };
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const accent = t.kind === "enabled" ? SAGE : NEUTRAL;
        return (
          <button
            key={t.id}
            onClick={() => onDismiss(t.id)}
            className="pointer-events-auto flex max-w-[320px] items-center gap-2.5 rounded-xl px-4 py-3 text-left transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            style={{
              backgroundColor: TOAST_BG,
              boxShadow: "0 8px 16px rgba(26,21,16,0.32)",
              animation: "eggcelerate-toast-in 220ms ease-out",
            }}
            aria-label={`Dismiss notification: ${t.message}`}
          >
            <span className="flex shrink-0 items-center justify-center" style={{ color: accent }}>
              {t.kind === "enabled" ? <Check size={17} strokeWidth={3} /> : <Info size={17} />}
            </span>
            <span style={{ color: "#F5F0E8", fontSize: 13, fontWeight: 600 }}>{t.message}</span>
          </button>
        );
      })}
      <style>{`
        @keyframes eggcelerate-toast-in {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
