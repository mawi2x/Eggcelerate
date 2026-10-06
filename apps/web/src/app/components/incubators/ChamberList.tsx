import { rangeState, waterState } from "../../domain/incubator";
import type { Incubator } from "../../domain/types";
import { EmptyState } from "../EmptyState";
import { IncubatorCard } from "../IncubatorCard";
import { StatusBadge } from "../StatusBadge";
import { readingStateColors } from "../statusPresentation";
import { Button } from "../ui/button";
import { PaginationBar } from "../ui/pagination-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

import { BORDER, CARD, MUTED, RUST, TEXT } from "./presentation";
import type { useIncubatorList } from "./useIncubatorList";

export function ChamberList({
  model,
  onOpenUnit,
  onHarvest,
  onAdd,
}: {
  model: ReturnType<typeof useIncubatorList>;
  onOpenUnit: (id: string) => void;
  onHarvest: (unit: Incubator) => void;
  onAdd: () => void;
}) {
  const {
    isMobile,
    totalUnits,
    search,
    setSearch,
    view,
    filter,
    setFilter,
    modeFilter,
    setModeFilter,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    modeOf,
    sorted,
    activeCardIndex,
    cardRefs,
    scrollToChamber,
    clampedPage,
    paged,
  } = model;
  return (
    <section aria-label="Chamber list">
      {sorted.length === 0 ? (
        <EmptyState
          title={
            totalUnits === 0
              ? "No incubators yet"
              : "No chambers match your filters"
          }
          description={
            totalUnits === 0
              ? "Add an incubator to start monitoring your farm."
              : "Try a different search term or clear the selected filters."
          }
          action={
            totalUnits === 0 ? (
              <Button
                type="button"
                className="rounded-xl"
                style={{
                  backgroundColor: RUST,
                  color: "var(--on-brand)",
                  fontSize: "var(--type-button-label)",
                }}
                onClick={onAdd}
              >
                <span>Add incubator</span>
              </Button>
            ) : search || filter !== "all" || modeFilter !== "all" ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                style={{
                  borderColor: BORDER,
                  color: RUST,
                  fontSize: "var(--type-button-label)",
                }}
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                  setModeFilter("all");
                }}
              >
                <span>Clear filters</span>
              </Button>
            ) : undefined
          }
        />
      ) : view === "grid" ? (
        <>
          {/* Reserve a small mobile gutter so the fixed chamber index never
              sits on top of the card edge. */}
          <div className="grid grid-cols-1 gap-2 md:gap-5 lg:grid-cols-2 xl:grid-cols-3 pr-4 md:pr-0">
            {sorted.map((unit, idx) => (
              <div
                key={unit.id}
                ref={(el) => {
                  cardRefs.current[idx] = el;
                }}
                data-chamber-idx={idx}
                className="scroll-mt-24 scroll-mb-[var(--mobile-bottom-nav-clearance)] rounded-2xl"
              >
                <IncubatorCard
                  unit={unit}
                  mode={modeOf(unit.modeId)}
                  onOpen={onOpenUnit}
                  cta="Configure"
                  onHarvest={onHarvest}
                  highlighted={isMobile && activeCardIndex === idx}
                />
              </div>
            ))}
          </div>

          {/* Empty spacer on mobile to allow scrolling the last card completely above the mascot FAB */}
          <div className="h-16 md:hidden" aria-hidden="true" />

          {/* Floating Vertical Dot Track on Mobile (shows incubator count and scroll position) */}
          {sorted.length > 1 && (
            // biome-ignore lint/a11y/useSemanticElements: navigation buttons form an ARIA group, not a set of form inputs
            <div
              className="scrollbar-none pointer-events-auto fixed right-1.5 top-1/2 z-20 m-0 flex h-fit max-h-[calc(100dvh-var(--mobile-bottom-nav-clearance)-1rem)] w-3 min-w-0 -translate-y-1/2 flex-col items-center gap-1 overflow-y-auto bg-transparent max-[20rem]:hidden md:hidden"
              role="group"
              aria-label={`Chamber list index. Showing ${sorted.length} chambers.`}
            >
              {sorted.map((unit, idx) => {
                const isActive = activeCardIndex === idx;
                return (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => scrollToChamber(idx)}
                    className="flex h-3 w-2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
                    aria-label={`Scroll to ${unit.name} (${idx + 1} of ${sorted.length})`}
                    title={`${unit.name} (${idx + 1} of ${sorted.length})`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <span
                      className="rounded-full transition-all duration-200 motion-reduce:transition-none"
                      style={{
                        width: isActive ? 4 : 2.5,
                        height: isActive ? 12 : 2.5,
                        backgroundColor: isActive
                          ? "var(--brand-primary)"
                          : "var(--wash-checkbox)",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            border: `var(--border-width-hairline) solid ${BORDER}`,
            backgroundColor: CARD,
          }}
        >
          <PaginationBar
            className="border-b border-t-0"
            page={clampedPage}
            pageSize={rowsPerPage}
            totalItems={sorted.length}
            itemLabel="incubators"
            pageSizeOptions={[10, 20, 50]}
            onPageSizeChange={(value) => {
              setRowsPerPage(value);
              setPage(1);
            }}
            onPageChange={setPage}
          />
          <div className="h-[var(--chamber-list-height)] overflow-auto">
            <Table
              style={{
                fontSize: "var(--type-body)",
                lineHeight: "var(--leading-normal)",
              }}
            >
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["CHAMBER", "MODE", "DAY"].map((h) => (
                    <TableHead
                      key={h}
                      className="sticky top-0 z-10"
                      style={{
                        backgroundColor: CARD,
                        borderBottom: `var(--border-width-hairline) solid ${BORDER}`,
                        color: "var(--text-muted)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        letterSpacing: "var(--tracking-label)",
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </TableHead>
                  ))}
                  {["TEMP", "HUMIDITY", "WATER"].map((h) => (
                    <TableHead
                      key={h}
                      className="sticky top-0 z-10 text-right"
                      style={{
                        backgroundColor: CARD,
                        borderBottom: `var(--border-width-hairline) solid ${BORDER}`,
                        color: "var(--text-muted)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        letterSpacing: "var(--tracking-label)",
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </TableHead>
                  ))}
                  {["STATUS", "ACTIONS"].map((h) => (
                    <TableHead
                      key={h}
                      className="sticky top-0 z-10"
                      style={{
                        backgroundColor: CARD,
                        borderBottom: `var(--border-width-hairline) solid ${BORDER}`,
                        color: "var(--text-muted)",
                        fontSize: "var(--type-label)",
                        fontWeight: "var(--weight-bold)",
                        letterSpacing: "var(--tracking-label)",
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((unit) => {
                  const mode = modeOf(unit.modeId);
                  const tempSt = rangeState(unit.temp, mode.targetTemp);
                  const humSt = rangeState(unit.humidity, mode.targetHumidity);
                  const waterSt = waterState(unit.waterOk);
                  return (
                    <TableRow
                      key={unit.id}
                      className="group transition-colors duration-200 hover:bg-[var(--nav-hover-bg)]"
                    >
                      <TableCell
                        style={{
                          fontWeight: "var(--weight-bold)",
                          color: TEXT,
                        }}
                      >
                        {unit.name}
                      </TableCell>
                      <TableCell>
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor: "var(--wash-brand-soft)",
                            color: RUST,
                            fontWeight: "var(--weight-bold)",
                            fontSize: "var(--type-caption)",
                          }}
                        >
                          {mode.name}
                        </span>
                      </TableCell>
                      <TableCell style={{ color: MUTED }}>
                        {unit.dayOfIncubation} of {mode.incubationDays}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        style={{
                          color: readingStateColors[tempSt],
                          fontWeight: "var(--weight-bold)",
                        }}
                      >
                        {unit.temp}°C
                      </TableCell>
                      <TableCell
                        className="text-right"
                        style={{
                          color: readingStateColors[humSt],
                          fontWeight: "var(--weight-bold)",
                        }}
                      >
                        {unit.humidity}%
                      </TableCell>
                      <TableCell
                        className="text-right"
                        style={{
                          color: readingStateColors[waterSt],
                          fontWeight: "var(--weight-bold)",
                        }}
                      >
                        {unit.waterOk ? "Normal" : "Low"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={unit.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer rounded-xl"
                          style={{
                            borderColor: BORDER,
                            color: RUST,
                            fontSize: "var(--type-button-label)",
                            fontWeight: "var(--weight-bold)",
                            lineHeight: "var(--leading-button)",
                            height: "var(--incubator-action-height)",
                          }}
                          onClick={() => onOpenUnit(unit.id)}
                          aria-label={`Configure ${unit.name}`}
                        >
                          <span>Configure</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}
