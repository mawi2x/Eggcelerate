import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { cn } from "./utils";

const BORDER = "var(--border-default)";
const MUTED = "var(--text-secondary)";
const INPUT_STYLE = {
  borderColor: "var(--input-border)",
  backgroundColor: "var(--surface-tile)",
};

interface PaginationBarProps {
  page: number;
  pageSize: number;
  totalItems: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
  /** Render a subset of groups (e.g. meta on top, pager at the bottom). */
  show?: string[];
  /** Mini dot pager (4px/12px) instead of "Page x of y" text; text returns past 7 pages. */
  dots?: boolean;
}

export function PaginationBar({
  page,
  pageSize,
  totalItems,
  itemLabel = "items",
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  className,
  show,
  dots,
}: PaginationBarProps) {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * safePageSize + 1;
  const rangeEnd = Math.min(safePage * safePageSize, totalItems);
  const showPageSize = Boolean(onPageSizeChange && pageSizeOptions?.length);

  return (
    <nav
      aria-label={`${itemLabel} pagination`}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 border-t px-4 py-3 md:justify-between",
        className,
      )}
      style={{ borderColor: BORDER }}
    >
      {(!show || show.includes("info")) && (
        <span
          aria-live="polite"
          className="shrink-0"
          style={{ color: MUTED, fontSize: "var(--type-filter-label)" }}
        >
          Showing {rangeStart} to {rangeEnd} of {totalItems} {itemLabel}
        </span>
      )}

      {dots &&
        (!show || show.includes("dots")) &&
        totalPages > 1 &&
        totalPages <= 7 && (
          <fieldset
            className="m-0 min-w-0 flex flex-1 items-center justify-center gap-1.5 border-0 p-0"
            aria-label="Pages"
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-label={`Go to page ${p}`}
                aria-current={safePage === p ? "page" : undefined}
                className="h-1 cursor-pointer rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{
                  width: safePage === p ? 12 : 4,
                  backgroundColor:
                    safePage === p ? "var(--brand-primary)" : "var(--dot-idle)",
                }}
              />
            ))}
          </fieldset>
        )}
      {showPageSize && (!show || show.includes("pageSize")) && (
        <div className="hidden sm:flex shrink-0 items-center gap-2">
          <span style={{ color: MUTED, fontSize: "var(--type-filter-label)" }}>
            Items per page:
          </span>
          <Select
            value={String(safePageSize)}
            onValueChange={(value) => onPageSizeChange?.(Number(value))}
          >
            <SelectTrigger
              size="default"
              className="h-[var(--control-height-mobile)] w-[72px] rounded-full md:h-8"
              style={INPUT_STYLE}
              aria-label={`Items per page for ${itemLabel}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions?.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(!show || show.includes("pager")) && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="h-[var(--control-height-mobile)] w-[var(--control-height-mobile)] rounded-lg p-0 md:h-8 md:w-8"
            style={{ borderColor: BORDER }}
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <span
            aria-current="page"
            style={{ color: MUTED, fontSize: "var(--type-filter-label)" }}
          >
            Page {safePage} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-[var(--control-height-mobile)] w-[var(--control-height-mobile)] rounded-lg p-0 md:h-8 md:w-8"
            style={{ borderColor: BORDER }}
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            aria-label="Next page"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
    </nav>
  );
}
