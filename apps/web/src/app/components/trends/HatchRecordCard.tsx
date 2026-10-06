import { useId } from "react";
import type { HatchWithPct } from "../../features/trends/selectors";
import { Typography } from "../ui/typography";

function formatDate(iso: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T00:00:00`)
    : new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function HatchRecordCard({
  record,
  compact = false,
}: {
  record: HatchWithPct;
  compact?: boolean;
}) {
  const titleId = useId();
  const rateColor =
    record.pct === null
      ? "var(--text-secondary)"
      : record.pct >= 80
        ? "var(--status-success-fg)"
        : "var(--status-warning-fg)";
  return (
    <article aria-labelledby={titleId} className="p-4">
      <div
        className={`grid gap-x-6 gap-y-2 ${compact ? "md:grid-cols-[minmax(0,1fr)_auto]" : ""}`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Typography
              as="h3"
              id={titleId}
              variant="headingSmall"
              style={{
                color: "var(--text-primary)",
                fontWeight: "var(--weight-bold)",
                overflowWrap: "anywhere",
              }}
            >
              {record.chamber}
            </Typography>
            <Typography
              as="span"
              variant="label"
              className="rounded-full px-2 py-0.5"
              style={{
                background: "var(--wash-brand-soft)",
                color: "var(--brand-primary)",
                textTransform: "none",
                letterSpacing: "normal",
              }}
            >
              {record.modeName}
            </Typography>
          </div>
          <Typography
            variant="caption"
            className="mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            <time dateTime={record.startDate}>
              {formatDate(record.startDate)}
            </time>
            {" to "}
            <time dateTime={record.endDate}>{formatDate(record.endDate)}</time>
          </Typography>
        </div>
        <div
          className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${compact ? "md:flex-col md:items-end md:justify-start" : ""}`}
        >
          <Typography
            variant="headingSmall"
            className="tabular-nums"
            style={{ color: rateColor, fontWeight: "var(--weight-bold)" }}
          >
            {record.pct === null ? "N/A" : `${record.pct.toFixed(1)}%`}
            <Typography
              as="span"
              variant="caption"
              className="ml-1"
              style={{ color: "var(--text-secondary)" }}
            >
              hatchability
            </Typography>
          </Typography>
          <Typography
            variant="caption"
            style={{ color: "var(--text-secondary)" }}
          >
            <strong style={{ color: "var(--status-success-fg)" }}>
              {record.hatchedEggs} hatched
            </strong>
            {" and "}
            {record.totalEggs - record.hatchedEggs} unhatched from{" "}
            {record.totalEggs} eggs set
          </Typography>
        </div>
      </div>
      {record.pct === null ? (
        <Typography
          variant="caption"
          className="mt-2"
          style={{ color: "var(--text-secondary)" }}
        >
          Hatchability unavailable without a valid fertile egg count.
        </Typography>
      ) : (
        <>
          <div
            role="progressbar"
            aria-label={`${record.chamber} hatchability`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={record.pct}
            aria-valuetext={`${record.pct.toFixed(1)}%, ${record.hatchedEggs} chicks from ${record.fertileEggs} fertile eggs`}
            className="mt-2 overflow-hidden rounded-[var(--radius-bar)]"
            style={{
              height: "var(--progress-thickness)",
              background: "var(--track-gauge)",
            }}
          >
            <div
              className="h-full rounded-[var(--radius-bar)]"
              style={{ width: `${record.pct}%`, background: rateColor }}
            />
          </div>
          <Typography
            variant="caption"
            className="mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Based on {record.fertileEggs} fertile eggs
          </Typography>
        </>
      )}
    </article>
  );
}
