import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Plus,
  Search,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Mode } from "../../domain/types";
import { Button } from "../ui/button";
import { FilterBar } from "../ui/filter-bar";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ViewToggle } from "../ViewToggle";

import {
  inputStyle,
  MUTED,
  RUST,
  type SortKey,
  sortOptions,
  sortTriggerStyle,
} from "./presentation";
import type { useIncubatorList } from "./useIncubatorList";

export function IncubatorToolbar({
  model,
  modes,
  header,
  onAdd,
}: {
  model: ReturnType<typeof useIncubatorList>;
  modes: Mode[];
  header?: ReactNode;
  onAdd: () => void;
}) {
  const {
    search,
    setSearch,
    view,
    setView,
    filter,
    setFilter,
    modeFilter,
    setModeFilter,
    sort,
    setSort,
    sortAsc,
    setSortAsc,
    setPage,
    filterPills,
  } = model;
  return (
    <>
      {/* Row 1: Search + ViewToggle (desktop) + Add Button */}
      {/* Sticky toolbar: page header + search + filters stay fixed while chamber cards scroll underneath. */}
      <div
        className="sticky top-0 z-30 flex flex-col gap-2 md:gap-3"
        style={{
          backgroundColor: "var(--surface-app)",
          paddingBottom: 4,
          paddingTop: 24,
        }}
      >
        {header}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: MUTED }}
            />
            <Input
              size="toolbar"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              maxLength={50}
              placeholder="Search incubators..."
              aria-label="Search incubators"
              className="h-[var(--control-height-mobile)] rounded-xl pl-9 md:h-[var(--control-height-default)]"
              style={{ ...inputStyle, fontSize: "var(--type-filter-value)" }}
            />
          </div>
          <Button
            size="default"
            onClick={onAdd}
            className="h-[var(--control-height-mobile)] shrink-0 rounded-xl px-2.5 transition-colors duration-200 hover:!bg-[var(--brand-primary-hover)] focus-visible:outline-none md:hidden"
            style={{
              backgroundColor: RUST,
              color: "var(--on-brand)",
              fontSize: "var(--type-filter-value)",
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-button)",
            }}
            aria-label="Add incubator"
          >
            <Plus size={16} />
            Add
          </Button>
          <div className="hidden md:block">
            <ViewToggle view={view} onChange={setView} />
          </div>
          <Button
            size="toolbar"
            onClick={onAdd}
            className="hidden h-[var(--control-height-default)] shrink-0 rounded-xl px-4 transition-colors duration-200 hover:!bg-[var(--brand-primary-hover)] focus-visible:outline-none md:inline-flex"
            style={{
              backgroundColor: RUST,
              color: "var(--on-brand)",
              fontSize: "var(--type-button-label)",
              fontWeight: "var(--weight-bold)",
              lineHeight: "var(--leading-button)",
            }}
            aria-label="Add incubator"
          >
            <Plus size={18} />
            Add Incubator
          </Button>
        </div>

        {/* Row 2 on mobile: Status filter pills with scroll indicator / Row 2 on desktop: FilterBar + Dropdowns */}
        <div className="flex flex-col gap-2 md:gap-3 md:!mt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-initial">
            <FilterBar
              ariaLabel="Incubator status filter"
              variant="segmented"
              fitToScreenOnMobile
              value={filter}
              onChange={(key) => {
                setFilter(key as typeof filter);
                setPage(1);
              }}
              options={filterPills.map((p) => ({
                key: p.key,
                label: p.label,
                count: p.count,
              }))}
              className="min-w-0 flex-1 md:!w-full lg:!w-auto"
            />
          </div>

          <div className="flex w-full items-center justify-end gap-2 lg:w-auto">
            {/* Incubation Mode Select */}
            <Select
              size="filter"
              value={modeFilter}
              onValueChange={(v) => {
                setModeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger
                size="filter"
                className="h-[var(--control-height-mobile)] min-w-0 flex-1 rounded-full px-3.5 md:h-[var(--control-height-default)] md:w-auto md:min-w-[var(--control-min-width-list-filter)] md:flex-initial md:rounded-xl md:px-3.5"
                style={{
                  ...sortTriggerStyle,
                }}
                aria-label="Filter by incubation mode"
              >
                <SelectValue placeholder="All modes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modes</SelectItem>
                {modes.map((mode) => (
                  <SelectItem key={mode.id} value={mode.id}>
                    {mode.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort Key Select */}
            <Select
              size="filter"
              value={sort}
              onValueChange={(v) => {
                setSort(v as SortKey);
                setPage(1);
              }}
            >
              <SelectTrigger
                size="filter"
                className="h-[var(--control-height-mobile)] min-w-0 flex-1 rounded-full px-3.5 md:h-[var(--control-height-default)] md:w-auto md:min-w-[var(--control-min-width-list-filter)] md:flex-initial md:rounded-xl md:px-3.5"
                style={{
                  ...sortTriggerStyle,
                }}
                aria-label="Sort chambers"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((o) => (
                  <SelectItem key={o.key} value={o.key}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort Direction Toggle */}
            <button
              type="button"
              onClick={() => {
                setSortAsc((v) => !v);
                setPage(1);
              }}
              className="flex h-[var(--control-height-mobile)] w-[var(--control-height-mobile)] shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors duration-200 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 md:h-[var(--control-height-default)] md:w-[var(--control-height-default)] md:rounded-xl"
              style={{
                backgroundColor: "var(--surface-card)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
              title={sortAsc ? "Sort ascending" : "Sort descending"}
              aria-label={`Sort direction: ${sortAsc ? "ascending" : "descending"}`}
            >
              {sortAsc ? (
                <ArrowUpNarrowWide size={16} className="md:size-[18px]" />
              ) : (
                <ArrowDownWideNarrow size={16} className="md:size-[18px]" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
