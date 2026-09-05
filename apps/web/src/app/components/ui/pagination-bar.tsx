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
        "flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      style={{ borderColor: BORDER }}
    >
      <span
        aria-live="polite"
        style={{ color: MUTED, fontSize: "var(--type-body-sm)" }}
      >
        Showing {rangeStart} to {rangeEnd} of {totalItems} {itemLabel}
      </span>

      <div className="flex flex-wrap items-center gap-4">
        {showPageSize && (
          <div className="flex items-center gap-2">
            <span style={{ color: MUTED, fontSize: "var(--type-body-sm)" }}>
              Items per page:
            </span>
            <Select
              value={String(safePageSize)}
              onValueChange={(value) => onPageSizeChange?.(Number(value))}
            >
              <SelectTrigger
                className="h-8 w-[72px] rounded-lg"
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

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            style={{ borderColor: BORDER }}
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <span style={{ color: MUTED, fontSize: "var(--type-body-sm)" }}>
            Page {safePage} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            style={{ borderColor: BORDER }}
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            aria-label="Next page"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
