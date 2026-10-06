import { useEffect, useMemo, useRef, useState } from "react";
import type { Incubator, Mode } from "../../domain/types";
import {
  selectFilteredIncubators,
  selectIncubatorStatusFilterCounts,
  selectSortedIncubators,
} from "../../features/incubators/selectors";
import { useIsMobile } from "../ui/use-mobile";
import type { ViewMode } from "../ViewToggle";

import type { Filter, SortKey } from "./presentation";

export function useIncubatorList(units: Incubator[], modes: Mode[]) {
  const isMobile = useIsMobile();
  // Chamber search is local to this page's controls row.
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [filter, setFilter] = useState<Filter>("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("progress");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const modeOf = (id: string) => modes.find((m) => m.id === id) ?? modes[0];

  const counts = useMemo(
    () => selectIncubatorStatusFilterCounts(units),
    [units],
  );

  const filtered = useMemo(
    () =>
      selectFilteredIncubators(units, modes, {
        search,
        status: filter,
        modeId: modeFilter,
      }),
    [units, search, filter, modeFilter, modes],
  );
  const sorted = useMemo(
    () =>
      selectSortedIncubators(filtered, modes, {
        sort,
        sortAsc,
        prioritizeIssues: filter === "issues",
      }),
    [filtered, filter, sort, sortAsc, modes],
  );
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !isMobile || sorted.length === 0)
      return;

    let ticking = false;
    let frameId: number | null = null;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      frameId = requestAnimationFrame(() => {
        ticking = false;
        frameId = null;
        const cards = cardRefs.current;
        if (!cards.length) return;
        const targetY = window.innerHeight * 0.35;
        let closestIdx = 0;
        let minDistance = Infinity;

        cards.forEach((card, idx) => {
          if (!card) return;
          const rect = card.getBoundingClientRect();
          const dist = Math.abs(rect.top - targetY);
          if (dist < minDistance) {
            minDistance = dist;
            closestIdx = idx;
          }
        });

        setActiveCardIndex((prev) => (prev === closestIdx ? prev : closestIdx));
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [isMobile, sorted]);
  const scrollToChamber = (index: number) => {
    const el = cardRefs.current[index];
    if (el) {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      el.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
      el.querySelector<HTMLElement>("button")?.focus({
        preventScroll: true,
      });
      setActiveCardIndex(index);
    }
  };

  const filterPills: {
    key: Filter;
    label: string;
    count: number;
  }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "optimal", label: "Normal", count: counts.optimal },
    { key: "issues", label: "Alerts", count: counts.issues },
  ];

  // Pagination for the list view.
  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * rowsPerPage;
  const paged = sorted.slice(start, start + rowsPerPage);

  return {
    isMobile,
    totalUnits: units.length,
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
    rowsPerPage,
    setRowsPerPage,
    modeOf,
    sorted,
    activeCardIndex,
    cardRefs,
    scrollToChamber,
    filterPills,
    clampedPage,
    paged,
  };
}
