import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { benchmarkRequest, type BenchmarkRun } from "../../features/benchmarks/use-benchmarks";
import { Button } from "../ui/button";

const readingSchema = z.object({ source: z.string().optional(), observed_at: z.string(), temperature_c: z.number().nullable(), humidity_pct: z.number().nullable(), report: z.object({ benchmark: z.object({ stage: z.number() }).optional(), sensor_valid: z.boolean() }) });
async function readings(unit: string, id: string) {
  const rows: z.infer<typeof readingSchema>[] = [];
  let before: string | null = null;
  do {
    const page: { readings: z.infer<typeof readingSchema>[]; next_before: string | null } = z.object({ readings: z.array(readingSchema), next_before: z.string().nullable() }).parse(await benchmarkRequest(unit, `/${id}/readings${before ? `?before=${encodeURIComponent(before)}` : ""}`));
    rows.push(...page.readings); before = page.next_before;
  } while (before && rows.length < 10000);
  return rows.reverse().flatMap((r, index, all) => { const point = ({ at: new Date(r.observed_at).getTime(), temperature: r.report.sensor_valid ? r.temperature_c : null, humidity: r.report.sensor_valid ? r.humidity_pct : null, stage: r.report.benchmark?.stage, source: r.source }); return index > 0 && point.at - new Date(all[index - 1].observed_at).getTime() > 20000 ? [{ ...point, at: point.at - 1, temperature: null, humidity: null }, point] : [point]; });
}
export function BenchmarkRunReadings({ run }: { run: BenchmarkRun }) {
  const query = useQuery({ queryKey: ["benchmark-readings", run.id], queryFn: () => readings(run.incubator_id, run.id), refetchInterval: run.ended_at ? false : 5000 });
  return <div className="space-y-4">
    <p>Indicated sensor readings. Intake temperature and humidity were not independently measured. Replayed local readings have no recorded actuator stage. Gaps remain visible. {run.conditions.notes}</p>
    {run.result && <div className="space-y-2">
      {run.result.samples ? <p>Transient temperature: {run.result.min_t.toFixed(1)}–{run.result.max_t.toFixed(1)}°C. Transient humidity: {run.result.min_rh.toFixed(1)}–{run.result.max_rh.toFixed(1)}% RH.</p> : <p>No valid sensor samples were recorded.</p>}
      {run.result.results.map((r, i) => r.windows ? <p key={i}>{run.kind === "lhm" ? `${i === 1 ? 60 : 100}% exhaust` : "Sustained window"}: {r.mean_t.toFixed(2)}°C, {r.mean_rh.toFixed(2)}% RH, dew point {r.dew_point.toFixed(2)}°C ({r.samples} samples).</p> : null)}
      {!run.result.results.some((r) => r.windows) && <p>No sustained plateau established.</p>}
      {run.kind === "htm" && <p>HTM test ceiling: {(run.settings?.ceiling_c ?? run.result.ceiling_c ?? 38.5).toFixed(1)}°C. DHT22 cutoff: {(run.settings?.htm_overtemp_c ?? run.result.htm_overtemp_c ?? 39).toFixed(1)}°C. There is no separate thermal fuse, so the physical maximum is not established.</p>}
    </div>}
    {query.isPending ? <p role="status">Loading readings…</p> : query.isError ? <p role="alert">Readings are unavailable. <Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></p> : !query.data?.length ? <p>No recorded readings are available for this run yet.</p> : (["temperature", "humidity"] as const).map((metric) => <div key={metric}>
      <h3 className="font-bold">{metric === "temperature" ? "Temperature (°C)" : "Humidity (% RH)"}</h3>
      <div className="h-64 w-full" role="img" aria-label={`${metric} readings for the selected benchmark`}>
        <ResponsiveContainer width="100%" height="100%"><LineChart data={query.data} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border-default)" /><XAxis dataKey="at" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} /><YAxis domain={["auto", "auto"]} />
          <Tooltip labelFormatter={(v) => new Date(Number(v)).toLocaleString()} /><Line type="linear" dataKey={metric} stroke="var(--brand-primary)" dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart></ResponsiveContainer>
      </div>
    </div>)}
  </div>;
}
