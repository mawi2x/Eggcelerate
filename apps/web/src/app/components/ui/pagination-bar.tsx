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
      <span
        aria-live="polite"
        className="shrink-0"
        style={{ color: MUTED, fontSize: "var(--type-filter-label)" }}
      >
        Showing {rangeStart} to {rangeEnd} of {totalItems} {itemLabel}
      </span>

      {showPageSize && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
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

      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-[var(--control-height-mobile)] w-[var(--control-height-mobile)] rounded-lg p-0 md:h-8 md:w-8"
          style={{ borderColor: BORDER }}
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Button>
        <span style={{ color: MUTED, fontSize: "var(--type-filter-label)" }}>
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
    </nav>
  );
}
