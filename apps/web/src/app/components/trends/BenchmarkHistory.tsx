import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  benchmarkRequest,
  benchmarkStatus,
  type BenchmarkRun,
} from "../../features/benchmarks/use-benchmarks";
import { Button } from "../ui/button";

const readingSchema = z.object({
  source: z.string().optional(),
  observed_at: z.string(),
  temperature_c: z.number().nullable(),
  humidity_pct: z.number().nullable(),
  report: z.object({
    benchmark: z.object({ stage: z.number() }).optional(),
    sensor_valid: z.boolean(),
  }),
});

async function readings(unit: string, id: string) {
  const rows: z.infer<typeof readingSchema>[] = [];
  let before: string | null = null;
  do {
    const page: {
      readings: z.infer<typeof readingSchema>[];
      next_before: string | null;
    } = z
      .object({
        readings: z.array(readingSchema),
        next_before: z.string().nullable(),
      })
      .parse(
        await benchmarkRequest(
          unit,
          `/${id}/readings${before ? `?before=${encodeURIComponent(before)}` : ""}`,
        ),
      );
    rows.push(...page.readings);
    before = page.next_before;
  } while (before && rows.length < 10000);

  return rows.reverse().flatMap((reading, index, all) => {
    const point = {
      at: new Date(reading.observed_at).getTime(),
      temperature: reading.report.sensor_valid ? reading.temperature_c : null,
      humidity: reading.report.sensor_valid ? reading.humidity_pct : null,
      stage: reading.report.benchmark?.stage,
      source: reading.source,
    };
    const previousAt = all[index - 1]
      ? new Date(all[index - 1].observed_at).getTime()
      : null;
    return previousAt !== null && point.at - previousAt > 20000
      ? [
          { ...point, at: point.at - 1, temperature: null, humidity: null },
          point,
        ]
      : [point];
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "In progress";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) return "In progress";
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  if (minutes)
    return seconds ? `${minutes} min ${seconds} sec` : `${minutes} min`;
  return `${seconds} sec`;
}

function InfoField({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border px-3 py-2.5 ${className}`}
      style={{
        backgroundColor: "var(--surface-porcelain)",
        borderColor: "var(--border-default)",
      }}
    >
      <dt
        className="text-(length:--type-caption)"
        style={{
          color: "var(--text-secondary)",
          lineHeight: "var(--leading-normal)",
        }}
      >
        {label}
      </dt>
      <dd
        className="mt-1 break-words text-(length:--type-body-sm)"
        style={{
          color: "var(--text-primary)",
          fontFamily: "var(--font-display)",
          fontWeight: "var(--weight-bold)",
          lineHeight: "var(--leading-snug)",
        }}
      >
        {value}
      </dd>
    </div>
  );
}

export function BenchmarkRunReadings({ run }: { run: BenchmarkRun }) {
  const query = useQuery({
    queryKey: ["benchmark-readings", run.id],
    queryFn: () => readings(run.incubator_id, run.id),
    refetchInterval: run.ended_at ? false : 5000,
  });
  const result = run.result;
  const duration =
    result?.elapsed_ms ??
    (run.ended_at
      ? Math.max(
          0,
          new Date(run.ended_at).getTime() - new Date(run.started_at).getTime(),
        )
      : null);

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <InfoField label="Status" value={benchmarkStatus(run.status)} />
        <InfoField label="Started" value={formatDateTime(run.started_at)} />
        <InfoField label="Duration" value={formatDuration(duration)} />
        <InfoField
          label="Temperature range"
          value={
            result && result.samples > 0
              ? `${result.min_t.toFixed(1)}–${result.max_t.toFixed(1)}°C`
              : "No samples"
          }
        />
        <InfoField
          label="Humidity range"
          value={
            result && result.samples > 0
              ? `${result.min_rh.toFixed(1)}–${result.max_rh.toFixed(1)}% RH`
              : "No samples"
          }
        />
        {run.conditions.notes?.trim() && (
          <InfoField
            label="Test notes"
            value={run.conditions.notes.trim()}
            className="col-span-2 sm:col-span-3"
          />
        )}
        {run.kind === "htm" && (
          <>
            <InfoField
              label="Measurement ceiling"
              value={`${(run.settings?.ceiling_c ?? result?.ceiling_c ?? 38.5).toFixed(1)}°C`}
            />
            <InfoField
              label="DHT22 cutoff"
              value={`${(run.settings?.htm_overtemp_c ?? result?.htm_overtemp_c ?? 39).toFixed(1)}°C`}
            />
          </>
        )}
      </dl>
      {query.isPending ? (
        <p role="status">Loading readings…</p>
      ) : query.isError ? (
        <p role="alert">
          Readings are unavailable.{" "}
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </p>
      ) : !query.data?.length ? (
        <p>No recorded readings are available for this run yet.</p>
      ) : (
        (["temperature", "humidity"] as const).map((metric) => (
          <div key={metric}>
            <h3 className="font-bold">
              {metric === "temperature"
                ? "Temperature (°C)"
                : "Humidity (% RH)"}
            </h3>
            <div
              className="h-64 w-full"
              role="img"
              aria-label={`${metric} readings for the selected benchmark`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={query.data}
                  margin={{ top: 16, right: 16, bottom: 8, left: 0 }}
                >
                  <CartesianGrid stroke="var(--border-default)" />
                  <XAxis
                    dataKey="at"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
                  />
                  <YAxis domain={["auto", "auto"]} />
                  <Tooltip
                    labelFormatter={(value) =>
                      new Date(Number(value)).toLocaleString()
                    }
                  />
                  <Line
                    type="linear"
                    dataKey={metric}
                    stroke="var(--brand-primary)"
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
