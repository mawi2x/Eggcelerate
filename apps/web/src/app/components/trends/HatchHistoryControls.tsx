import { Search } from "lucide-react";
import type { HatchSort } from "../../features/trends/selectors";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useIsMobile } from "../ui/use-mobile";
import { ViewToggle } from "../ViewToggle";
import {
  CONTROL_FONT,
  inputStyle,
  MUTED,
  RUST,
  TEXT,
  toolbarInputStyle,
} from "./presentation";
import type { useHatchHistory } from "./useHatchHistory";

const sortOptions: { value: HatchSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  {
    value: "highest",
    label: "Highest hatchability",
  },
  { value: "lowest", label: "Lowest hatchability" },
];

export function HatchHistoryControls({
  model,
}: {
  model: ReturnType<typeof useHatchHistory>;
}) {
  const isMobile = useIsMobile();
  const {
    hatchSearch,
    setHatchSearch,
    hatchSort,
    setHatchSort,
    species,
    setSpecies,
    speciesOptions,
    hatchView,
    setHatchView,
    setHatchPage,
  } = model;
  return (
    <div className="mt-3 space-y-2 md:mt-6 md:space-y-3">
      <div className="grid grid-cols-[minmax(0,4fr)_minmax(0,3fr)_minmax(0,3fr)] items-center gap-2 md:flex md:flex-wrap md:gap-3 xl:flex-nowrap">
        <div className="relative min-w-0 md:min-w-[180px] md:flex-1 xl:min-w-0">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: MUTED }}
          />
          <Input
            size="toolbar"
            value={hatchSearch}
            maxLength={50}
            onChange={(e) => {
              setHatchSearch(e.target.value);
              setHatchPage(1);
            }}
            placeholder={
              isMobile ? "Search..." : "Search chamber or species..."
            }
            aria-label="Filter hatch history"
            className="h-[var(--control-height-mobile)] rounded-xl pl-9 md:h-[var(--control-height-toolbar)]"
            style={{ ...inputStyle, fontSize: "var(--type-filter-value)" }}
          />
        </div>
        <div className="col-start-2 min-w-0 md:w-[210px] md:shrink-0">
          <Select
            size="filter"
            value={hatchSort}
            onValueChange={(value) => {
              setHatchSort(value as HatchSort);
              setHatchPage(1);
            }}
          >
            <SelectTrigger
              size="filter"
              aria-label="Sort hatch history"
              className="w-full min-w-0 rounded-xl px-2 [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
              style={{ ...toolbarInputStyle, ...CONTROL_FONT, color: RUST }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={CONTROL_FONT}>
              {sortOptions.map(({ value, label }) => (
                <SelectItem key={value} value={value} style={{ color: TEXT }}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-start-3 min-w-0 md:w-[180px] md:shrink-0">
          <Select
            size="filter"
            value={species}
            onValueChange={(value) => {
              setSpecies(value);
              setHatchPage(1);
            }}
          >
            <SelectTrigger
              size="filter"
              aria-label="Filter hatch history by species"
              className="w-full min-w-0 rounded-xl px-2 [&_[data-slot=select-value]]:truncate"
              style={{ ...toolbarInputStyle, ...CONTROL_FONT, color: RUST }}
            >
              <SelectValue placeholder="All Species" />
            </SelectTrigger>
            <SelectContent style={CONTROL_FONT}>
              {speciesOptions.map((option) => (
                <SelectItem key={option} value={option} style={{ color: TEXT }}>
                  {option === "All" ? "All Species" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="hidden md:block">
          <ViewToggle view={hatchView} onChange={setHatchView} />
        </div>
      </div>
    </div>
  );
}
