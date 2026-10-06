import type { FeatureQueryState } from "../../features/farm/query-state";
import { EmptyState } from "../EmptyState";
import { FeatureDataStatus } from "../FeatureDataStatus";
import { Button } from "../ui/button";
import { PaginationBar } from "../ui/pagination-bar";
import { HatchHistoryControls } from "./HatchHistoryControls";
import { HatchRecordCard } from "./HatchRecordCard";
import { HatchSummaryPanel } from "./HatchSummaryPanel";
import { BORDER } from "./presentation";
import type { useHatchHistory } from "./useHatchHistory";

export function HatchHistory({
  model,
  historyStatus,
  isMobile,
}: {
  model: ReturnType<typeof useHatchHistory>;
  historyStatus?: FeatureQueryState;
  isMobile: boolean;
}) {
  const {
    setHatchSearch,
    setSpecies,
    setHatchPage,
    touchStartX,
    hatchRowsPerPage,
    setHatchRowsPerPage,
    hatchView,
    summary,
    speciesSummaries,
    filteredHatch,
    hatchPages,
    page,
    pagedHatch,
  } = model;

  return (
    <section aria-label="Hatch history">
      {historyStatus && (
        <FeatureDataStatus label="Hatch history" state={historyStatus} />
      )}
      {(!historyStatus || historyStatus.hasData) && (
        <>
          <HatchSummaryPanel
            summary={summary}
            speciesSummaries={speciesSummaries}
          />

          <HatchHistoryControls model={model} />

          <div className="mt-3 space-y-3 md:mt-4">
            {pagedHatch.length > 0 ? (
              <ul
                aria-label="Completed hatch cycles"
                className={
                  isMobile || hatchView === "grid"
                    ? "grid touch-pan-y grid-cols-1 gap-3 md:grid-cols-2"
                    : "touch-pan-y overflow-hidden rounded-[var(--radius-card)] border"
                }
                style={{
                  borderColor: BORDER,
                  backgroundColor:
                    !isMobile && hatchView === "list"
                      ? "var(--surface-card)"
                      : undefined,
                }}
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0].clientX;
                }}
                onTouchEnd={(e) => {
                  if (touchStartX.current === null) return;
                  const dx = e.changedTouches[0].clientX - touchStartX.current;
                  touchStartX.current = null;
                  if (Math.abs(dx) < 48) return;
                  if (dx < 0) setHatchPage(Math.min(hatchPages, page + 1));
                  else setHatchPage(Math.max(1, page - 1));
                }}
              >
                {pagedHatch.map((record, index) => (
                  <li
                    key={record.id}
                    className={
                      isMobile || hatchView === "grid"
                        ? "min-w-0 rounded-[var(--radius-card)] border shadow-sm"
                        : index > 0
                          ? "border-t"
                          : ""
                    }
                    style={{
                      borderColor: BORDER,
                      backgroundColor: "var(--surface-card)",
                    }}
                  >
                    <HatchRecordCard
                      record={record}
                      compact={!isMobile && hatchView === "list"}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                size="compact"
                title={
                  summary.cycles === 0
                    ? "No completed cycles yet"
                    : "No cycles match your filters"
                }
                description={
                  summary.cycles === 0
                    ? "Completed cycle records will appear here after a hatch is recorded."
                    : "Try a different chamber or species, or clear the selected filters."
                }
                action={
                  summary.cycles > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      style={{
                        borderColor: BORDER,
                        color: "var(--brand-primary)",
                      }}
                      onClick={() => {
                        setHatchSearch("");
                        setSpecies("All");
                        setHatchPage(1);
                      }}
                    >
                      <span>Clear filters</span>
                    </Button>
                  ) : undefined
                }
              />
            )}
            {filteredHatch.length > 0 && (
              <div
                className="overflow-hidden rounded-[var(--radius-dialog)] border"
                style={{
                  backgroundColor: "var(--surface-card)",
                  borderColor: BORDER,
                }}
              >
                <PaginationBar
                  className="border-none px-4 py-3"
                  page={page}
                  pageSize={hatchRowsPerPage}
                  totalItems={filteredHatch.length}
                  itemLabel="records"
                  pageSizeOptions={[10, 20, 50]}
                  onPageSizeChange={(value) => {
                    setHatchRowsPerPage(value);
                    setHatchPage(1);
                  }}
                  onPageChange={setHatchPage}
                />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
