import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { SegmentedControl, SegmentedControlItem } from "./segmented-control";
import { cn } from "./utils";

export interface FilterBarOption {
  key: string;
  label: string;
  mobileLabel?: string;
  compactMobileLabel?: string;
  count?: number;
  icon?: React.ReactNode;
}

interface FilterBarProps {
  options: FilterBarOption[];
  value: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
  className?: string;
  variant?: "chips" | "segmented";
  equalWidthOnMobile?: boolean;
  fitToScreenOnMobile?: boolean;
  textTransform?: "none" | "uppercase";
}

function FilterOptionContent({
  option,
  active,
}: {
  option: FilterBarOption;
  active: boolean;
}) {
  const hasResponsiveLabel = Boolean(
    option.mobileLabel || option.compactMobileLabel,
  );

  return (
    <>
      {option.icon && (
        <span className="flex shrink-0" aria-hidden="true">
          {option.icon}
        </span>
      )}
      {hasResponsiveLabel ? (
        <>
          <span
            className={cn(
              "md:hidden",
              option.compactMobileLabel && "max-[22.5rem]:hidden",
            )}
          >
            {option.mobileLabel ?? option.label}
          </span>
          {option.compactMobileLabel && (
            <span className="hidden max-[22.5rem]:inline md:hidden">
              {option.compactMobileLabel}
            </span>
          )}
          <span className="hidden md:inline">{option.label}</span>
        </>
      ) : (
        option.label
      )}
      {typeof option.count === "number" && (
        <span
          className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-(length:--type-filter-label) font-bold"
          style={{
            backgroundColor: active
              ? "var(--brand-primary)"
              : "var(--surface-stone)",
            color: active ? "var(--on-brand)" : "var(--text-farm)",
          }}
        >
          {option.count}
        </span>
      )}
    </>
  );
}

export function FilterBar({
  options,
  value,
  onChange,
  ariaLabel = "Filter",
  className,
  variant = "chips",
  equalWidthOnMobile = false,
  fitToScreenOnMobile = false,
  textTransform = "uppercase",
}: FilterBarProps) {
  const isSegmented = variant === "segmented";
  const fitsMobile = fitToScreenOnMobile || equalWidthOnMobile;
  const scrollRef = React.useRef<HTMLFieldSetElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    setCanScrollLeft(element.scrollLeft > 4);
    setCanScrollRight(
      element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
    );
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: option count changes scroll width even when the container size is unchanged
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
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollRef.current?.scrollBy({
      left: amount,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  const optionButtons = options.map((option) => {
    const active = value === option.key;
    const accessibleLabel = `${option.label}${typeof option.count === "number" ? ` (${option.count})` : ""}`;

    if (isSegmented) {
      const equalTrackClass = fitToScreenOnMobile
        ? "min-w-0 flex-1 md:flex-none md:min-w-max"
        : equalWidthOnMobile
          ? "min-w-[var(--control-width-filter-pill-mobile)] md:min-w-max"
          : "shrink-0";

      return (
        <SegmentedControlItem
          key={option.key}
          flush
          size="default"
          active={active}
          aria-pressed={active}
          aria-label={accessibleLabel}
          onClick={() => onChange(option.key)}
          className={cn(equalTrackClass, fitsMobile && "px-2 md:px-4")}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--type-filter-label)",
            fontWeight: "var(--weight-bold)",
            lineHeight: "var(--leading-snug)",
            letterSpacing: "var(--tracking-label)",
            textTransform,
          }}
        >
          <FilterOptionContent option={option} active={active} />
        </SegmentedControlItem>
      );
    }

    const equalWidthClass = equalWidthOnMobile
      ? "min-w-[var(--control-width-filter-pill-mobile)] md:min-w-max"
      : undefined;

    return (
      <button
        key={option.key}
        type="button"
        onClick={() => onChange(option.key)}
        aria-pressed={active}
        aria-label={accessibleLabel}
        className={cn(
          "min-h-[var(--control-height-chip-touch)] shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 md:min-h-[var(--control-height-chip)] md:shrink",
          equalWidthClass,
        )}
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
          textTransform,
        }}
      >
        <FilterOptionContent option={option} active={active} />
      </button>
    );
  });

  // Fit-to-screen rows never need paging. Equal-width rows intentionally keep
  // their scroll affordance when the fixed pills exceed the viewport.
  const arrowsEnabled = !fitToScreenOnMobile;

  return (
    <div className={cn("relative w-full max-w-full md:w-auto", className)}>
      <div
        aria-hidden={!arrowsEnabled || !canScrollLeft}
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-10 flex h-[var(--control-height-filter-row)] items-center bg-gradient-to-r from-[var(--surface-page)] via-[var(--surface-page)] to-transparent pr-3 pl-0.5 transition-opacity duration-200 md:hidden",
          arrowsEnabled && canScrollLeft
            ? "visible opacity-100"
            : "invisible opacity-0",
        )}
      >
        <button
          type="button"
          tabIndex={arrowsEnabled && canScrollLeft ? 0 : -1}
          onClick={() => scrollBy(-140)}
          className="pointer-events-auto flex h-11 w-11 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-start text-[var(--text-secondary)] opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          aria-label="Show previous filters"
        >
          <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      <fieldset
        ref={scrollRef}
        onScroll={checkScroll}
        aria-label={ariaLabel}
        className={cn(
          "scrollbar-none m-0 flex min-w-0 w-full max-w-full overflow-x-auto border-0",
          isSegmented
            ? "items-center gap-0 p-0 md:overflow-visible md:scroll-p-0"
            : "gap-2 p-1 scroll-pr-12 md:flex-wrap md:overflow-visible md:scroll-p-0",
        )}
      >
        {isSegmented ? (
          <SegmentedControl
            role="presentation"
            flush
            className={cn(
              "w-max shrink-0",
              fitToScreenOnMobile && "w-full min-w-0 md:w-max md:min-w-max",
            )}
          >
            {optionButtons}
          </SegmentedControl>
        ) : (
          optionButtons
        )}
        <span
          aria-hidden="true"
          className={cn("w-11 shrink-0 md:hidden", !arrowsEnabled && "hidden")}
        />
      </fieldset>

      <div
        aria-hidden={!arrowsEnabled || !canScrollRight}
        className={cn(
          "pointer-events-none absolute right-0 top-0 z-10 flex h-[var(--control-height-filter-row)] items-center bg-gradient-to-l from-[var(--surface-page)] via-[var(--surface-page)] to-transparent pl-3 pr-0.5 transition-opacity duration-200 md:hidden",
          arrowsEnabled && canScrollRight
            ? "visible opacity-100"
            : "invisible opacity-0",
        )}
      >
        <button
          type="button"
          tabIndex={arrowsEnabled && canScrollRight ? 0 : -1}
          onClick={() => scrollBy(140)}
          className="pointer-events-auto flex h-11 w-11 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-end text-[var(--brand-primary)] opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          aria-label="Show more filters"
        >
          <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
