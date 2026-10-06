import { useMemo, useRef, useState } from "react";
import type { HatchRecord } from "../../domain/types";
import {
  type HatchSort,
  selectFilteredHatch,
  selectHatchKpis,
  selectHatchSpeciesSummaries,
  selectHatchSummary,
  selectHatchWithPct,
  selectSortedHatch,
} from "../../features/trends/selectors";
import type { ViewMode } from "../ViewToggle";

import { HATCH_ROWS } from "./presentation";

export function useHatchHistory(history: HatchRecord[]) {
  // Hatch history state.
  const [hatchSearch, setHatchSearch] = useState("");
  const [species, setSpecies] = useState<string>("All");
  const [hatchPage, setHatchPage] = useState(1);
  const [hatchSort, setHatchSort] = useState<HatchSort>("newest");
  const touchStartX = useRef<number | null>(null);
  const [hatchRowsPerPage, setHatchRowsPerPage] = useState(HATCH_ROWS);
  const [hatchView, setHatchView] = useState<ViewMode>("grid");

  // ── Hatch-history derived data ──────────────────────────────────────────────
  const withPct = useMemo(() => selectHatchWithPct(history), [history]);

  const kpis = useMemo(() => selectHatchKpis(withPct), [withPct]);
  // The overview describes all completed cycles, independently of list filters.
  const summary = useMemo(() => selectHatchSummary(history), [history]);
  const speciesSummaries = useMemo(
    () => selectHatchSpeciesSummaries(history),
    [history],
  );

  const speciesOptions: string[] = [
    "All",
    ...Array.from(new Set(history.map((h) => h.modeName))).sort(),
  ];

  const filteredHatch = useMemo(
    () =>
      selectSortedHatch(
        selectFilteredHatch(withPct, {
          search: hatchSearch,
          species,
        }),
        hatchSort,
      ),
    [withPct, hatchSearch, species, hatchSort],
  );

  const hatchPages = Math.max(
    1,
    Math.ceil(filteredHatch.length / hatchRowsPerPage),
  );
  const page = Math.min(hatchPage, hatchPages);
  const pagedHatch = filteredHatch.slice(
    (page - 1) * hatchRowsPerPage,
    page * hatchRowsPerPage,
  );

  return {
    hatchSearch,
    setHatchSearch,
    hatchSort,
    setHatchSort,
    species,
    setSpecies,
    setHatchPage,
    touchStartX,
    hatchRowsPerPage,
    setHatchRowsPerPage,
    hatchView,
    setHatchView,
    kpis,
    summary,
    speciesSummaries,
    speciesOptions,
    filteredHatch,
    hatchPages,
    page,
    pagedHatch,
  };
}
