import { useRef, useState } from "react";
import type { HatchSummary } from "../../features/trends/selectors";
import { Typography } from "../ui/typography";

type SpeciesSummary = HatchSummary & { species: string };

function SpeciesRows({
  groups,
  className,
}: {
  groups: SpeciesSummary[];
  className?: string;
}) {
  return (
    <ul className={className} aria-label="Hatchability by species">
      {groups.map((group) => (
        <li key={group.species} className="flex min-w-0 items-center gap-3">
          <div className="flex w-24 shrink-0 flex-wrap items-baseline gap-x-1 md:w-28">
            <Typography as="span" variant="headingSmall">
              {group.species}
            </Typography>
            <Typography
              as="p"
              variant="caption"
              style={{ color: "var(--hatch-summary-muted)" }}
            >
              {group.cycles} {group.cycles === 1 ? "cycle" : "cycles"}
            </Typography>
          </div>
          <div className="min-w-0 flex-1">
            {group.avgRate === null ? (
              <Typography
                variant="caption"
                style={{ color: "var(--hatch-summary-muted)" }}
              >
                Fertile egg count unavailable
              </Typography>
            ) : (
              <div
                role="progressbar"
                aria-label={`${group.species} hatchability`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={group.avgRate}
                aria-valuetext={`${group.avgRate.toFixed(1)}%, based on ${group.ratedCycles} of ${group.cycles} cycles`}
                className="overflow-hidden rounded-[var(--radius-bar)]"
                style={{
                  height: "var(--progress-thickness)",
                  background: "var(--hatch-summary-track)",
                }}
              >
                <div
                  className="h-full rounded-[var(--radius-bar)]"
                  style={{
                    width: `${group.avgRate}%`,
                    background: "var(--hatch-summary-accent)",
                  }}
                />
              </div>
            )}
          </div>
          <Typography
            as="span"
            variant="body"
            className="w-12 shrink-0 text-right tabular-nums"
            style={{ fontWeight: "var(--weight-bold)" }}
          >
            {group.avgRate === null ? "N/A" : `${group.avgRate.toFixed(1)}%`}
          </Typography>
        </li>
      ))}
    </ul>
  );
}

export function HatchSummaryPanel({
  summary,
  speciesSummaries,
}: {
  summary: HatchSummary;
  speciesSummaries: SpeciesSummary[];
}) {
  const hasPartialRate = summary.ratedCycles < summary.cycles;
  const speciesCarouselRef = useRef<HTMLElement>(null);
  const [speciesPage, setSpeciesPage] = useState(0);
  const speciesSlides = Array.from(
    { length: Math.ceil(speciesSummaries.length / 3) },
    (_, index) => speciesSummaries.slice(index * 3, index * 3 + 3),
  );

  const handleSpeciesScroll = () => {
    const element = speciesCarouselRef.current;
    if (!element || element.clientWidth === 0) return;
    setSpeciesPage(Math.round(element.scrollLeft / element.clientWidth));
  };

  const goToSpeciesPage = (page: number) => {
    const element = speciesCarouselRef.current;
    if (!element) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollTo({
      left: page * element.clientWidth,
      behavior: reduceMotion ? "auto" : "smooth",
    });
    setSpeciesPage(page);
  };

  return (
    <section
      aria-labelledby="hatch-summary-title"
      className="overflow-hidden rounded-[var(--radius-card)] border"
      style={{
        background: "var(--hatch-summary-bg)",
        color: "var(--hatch-summary-fg)",
        borderColor: "var(--hatch-summary-border)",
      }}
    >
      <div className="p-3 md:p-4">
        <div>
          <Typography as="h2" id="hatch-summary-title" variant="headingSmall">
            Average Hatchability
          </Typography>
        </div>
        <Typography
          variant="metric"
          className="mt-1 tabular-nums"
          style={{ fontSize: "var(--type-page-title)" }}
        >
          {summary.avgRate === null ? "N/A" : `${summary.avgRate.toFixed(1)}%`}
        </Typography>
        <Typography
          variant="caption"
          className="mt-0.5"
          style={{ color: "var(--hatch-summary-muted)" }}
        >
          {summary.avgRate === null ? (
            "Hatchability needs a known fertile egg count."
          ) : (
            <>
              Hatchability is based on{" "}
              <strong style={{ fontWeight: "var(--weight-bold)" }}>
                {summary.ratedHatched} chicks
              </strong>{" "}
              from{" "}
              <strong style={{ fontWeight: "var(--weight-bold)" }}>
                {summary.ratedFertileEggs} fertile eggs
              </strong>
              .
            </>
          )}
          {hasPartialRate && (
            <>
              {" "}
              Fertility data is available for{" "}
              <strong style={{ fontWeight: "var(--weight-bold)" }}>
                {summary.ratedCycles} of {summary.cycles} cycles
              </strong>
              .
            </>
          )}
        </Typography>
        <Typography
          variant="caption"
          className="mt-1"
          style={{ color: "var(--hatch-summary-muted)" }}
        >
          <strong style={{ fontWeight: "var(--weight-bold)" }}>
            {summary.hatched} chicks
          </strong>{" "}
          hatched from{" "}
          <strong style={{ fontWeight: "var(--weight-bold)" }}>
            {summary.totalEggs} eggs set
          </strong>{" "}
          across{" "}
          <strong style={{ fontWeight: "var(--weight-bold)" }}>
            {summary.cycles} completed{" "}
            {summary.cycles === 1 ? "cycle" : "cycles"}
          </strong>
          .
        </Typography>
      </div>

      <div
        className="border-t p-3 md:p-4"
        style={{ borderColor: "var(--hatch-summary-divider)" }}
      >
        {speciesSummaries.length === 0 ? (
          <Typography style={{ color: "var(--hatch-summary-muted)" }}>
            Complete your first cycle to see hatchability by species.
          </Typography>
        ) : (
          <>
            <section
              ref={speciesCarouselRef}
              onScroll={handleSpeciesScroll}
              aria-label="Hatchability by species"
              aria-roledescription="carousel"
              className="flex snap-x snap-mandatory touch-pan-x overflow-x-auto scrollbar-none md:hidden"
            >
              {speciesSlides.map((groups, index) => (
                <section
                  key={groups[0]?.species ?? index}
                  aria-roledescription="slide"
                  aria-label={`Species ${index * 3 + 1} to ${index * 3 + groups.length} of ${speciesSummaries.length}`}
                  className="min-w-full shrink-0 snap-start"
                >
                  <SpeciesRows groups={groups} className="grid gap-y-2" />
                </section>
              ))}
            </section>
            {speciesSlides.length > 1 && (
              <div className="mt-3 flex justify-center gap-1.5 md:hidden">
                {speciesSlides.map((groups, index) => (
                  <button
                    key={groups[0]?.species ?? index}
                    type="button"
                    onClick={() => goToSpeciesPage(index)}
                    className="h-1.5 cursor-pointer rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1"
                    aria-current={speciesPage === index ? "true" : undefined}
                    aria-label={`Show species ${index * 3 + 1} to ${index * 3 + groups.length}`}
                    style={{
                      width:
                        speciesPage === index
                          ? "var(--dot-width-current)"
                          : "var(--dot-size)",
                      backgroundColor:
                        speciesPage === index
                          ? "var(--brand-primary)"
                          : "var(--dot-idle)",
                    }}
                  />
                ))}
              </div>
            )}
            <SpeciesRows
              groups={speciesSummaries}
              className="hidden gap-x-6 gap-y-2 md:grid md:grid-cols-2"
            />
          </>
        )}
      </div>
    </section>
  );
}
