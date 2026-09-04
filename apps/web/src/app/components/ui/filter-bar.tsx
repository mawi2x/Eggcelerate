import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { cn } from "./utils";

export interface FilterBarOption {
  key: string;
  label: string;
  mobileLabel?: string;
  count?: number;
}
interface FilterBarProps {
  options: FilterBarOption[];
  value: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
  className?: string;
}
export function FilterBar({
  options,
  value,
  onChange,
  ariaLabel = "Filter",
  className,
}: FilterBarProps) {
  const scrollRef = React.useRef<HTMLFieldSetElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Recheck overflow when the option count changes after filtering or data refresh.
  React.useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    const element = scrollRef.current;
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(checkScroll);
    if (element) resizeObserver?.observe(element);

    return () => {
      window.removeEventListener("resize", checkScroll);
      resizeObserver?.disconnect();
    };
  }, [checkScroll, options.length]);

  const scrollBy = (amount: number) => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scrollRef.current?.scrollBy({
      left: amount,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className={cn("relative w-full max-w-full sm:w-auto", className)}>
      {/* Left indicator button & fade — always mounted so focus is never
          destroyed when the edge state changes; hidden edges leave the tab order. */}
      <div
        aria-hidden={!canScrollLeft}
        className={cn(
          "absolute left-0 top-0 bottom-0 z-10 flex items-center pr-3 pl-0.5 bg-gradient-to-r from-[var(--surface-page)] via-[var(--surface-page)] to-transparent sm:hidden",
          !canScrollLeft && "invisible",
        )}
      >
        <button
          type="button"
          tabIndex={canScrollLeft ? 0 : -1}
          onClick={() => scrollBy(-140)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)] shadow-xs hover:text-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
          aria-label="Show previous filters"
        >
          <ChevronLeft size={13} aria-hidden="true" />
        </button>
      </div>

      {/* Scrollable track on mobile, wrap on tablet/desktop */}
      <fieldset
        ref={scrollRef}
        onScroll={checkScroll}
        aria-label={ariaLabel}
        className="scrollbar-none m-0 flex gap-2 overflow-x-auto border-0 p-1 sm:flex-wrap sm:overflow-visible"
      >
        {options.map((opt) => {
          const active = value === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              aria-pressed={active}
              className="min-h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 sm:min-h-[var(--control-height-chip)] sm:shrink"
              style={{
                backgroundColor: active
                  ? "var(--brand-primary)"
                  : "var(--surface-card)",
                color: active ? "var(--on-brand)" : "var(--text-muted)",
                border: `1px solid ${active ? "var(--brand-primary)" : "var(--border-default)"}`,
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-label)",
                fontWeight: "var(--weight-bold)",
                lineHeight: "var(--leading-snug)",
                letterSpacing: "var(--tracking-label)",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {opt.mobileLabel ? (
                <>
                  <span className="sm:hidden">{opt.mobileLabel}</span>
                  <span className="hidden sm:inline">{opt.label}</span>
                </>
              ) : (
                opt.label
              )}
              {typeof opt.count === "number" && (
                <span style={{ opacity: active ? 0.9 : 0.75 }}>
                  {" "}
                  ({opt.count})
                </span>
              )}
            </button>
          );
        })}
      </fieldset>

      {/* Right indicator button & fade — always mounted for the same reason. */}
      <div
        aria-hidden={!canScrollRight}
        className={cn(
          "absolute right-0 top-0 bottom-0 z-10 flex items-center pl-3 pr-0.5 bg-gradient-to-l from-[var(--surface-page)] via-[var(--surface-page)] to-transparent sm:hidden",
          !canScrollRight && "invisible",
        )}
      >
        <button
          type="button"
          tabIndex={canScrollRight ? 0 : -1}
          onClick={() => scrollBy(140)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--brand-primary)] shadow-xs hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
          aria-label="Show more filters"
        >
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
