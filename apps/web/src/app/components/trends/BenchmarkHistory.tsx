import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Incubator } from "../../domain/types";
import { benchmarkModes, benchmarkRequest, benchmarkStatus, useBenchmarks, type BenchmarkRun } from "../../features/benchmarks/use-benchmarks";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

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
function RunCharts({ run }: { run: BenchmarkRun }) {
  const query = useQuery({ queryKey: ["benchmark-readings", run.id], queryFn: () => readings(run.incubator_id, run.id), refetchInterval: run.ended_at ? false : 5000 });
  return <div className="space-y-4">
    <p>Indicated sensor readings. Intake temperature and humidity were not independently measured. Replayed local readings have no recorded actuator stage. Gaps remain visible. {run.conditions.notes}</p>
    {run.result && <div className="space-y-2">
      {run.result.samples ? <p>Transient temperature: {run.result.min_t.toFixed(1)}–{run.result.max_t.toFixed(1)}°C. Transient humidity: {run.result.min_rh.toFixed(1)}–{run.result.max_rh.toFixed(1)}% RH.</p> : <p>No valid sensor samples were recorded.</p>}
      {run.result.results.map((r, i) => r.windows ? <p key={i}>{run.kind === "lhm" ? `${i === 1 ? 60 : 100}% exhaust` : "Sustained window"}: {r.mean_t.toFixed(2)}°C, {r.mean_rh.toFixed(2)}% RH, dew point {r.dew_point.toFixed(2)}°C ({r.samples} samples).</p> : null)}
      {!run.result.results.some((r) => r.windows) && <p>No sustained plateau established.</p>}
      {run.kind === "htm" && <p>Test ceiling: 38.5°C. The unrestricted physical maximum is not established.</p>}
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
function ChamberRuns({ unit }: { unit: Incubator }) {
  const model = useBenchmarks(unit.id);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = model.query.data?.find((r) => r.id === selectedId);
  if (!model.available) return <p>Benchmark history requires a connected API account.</p>;
  return <div className="space-y-4">
    {model.query.isPending ? <p role="status">Loading benchmark history…</p> : model.query.isError ? <p role="alert">{model.query.error.message} <Button variant="outline" onClick={() => void model.query.refetch()}>Retry</Button></p> : !model.query.data?.length ? <p>No benchmarks saved for this chamber yet.</p> : <ul className="space-y-2">{model.query.data.map((run) => <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border-default)" }}>
      <div><p className="font-bold">{benchmarkModes.find((m) => m.id === run.kind)?.name}</p><p>{new Date(run.started_at).toLocaleString()} — {benchmarkStatus(run.status)}</p></div>
      <Button variant="outline" className="rounded-full" onClick={() => setSelectedId(run.id)} aria-pressed={selectedId === run.id}>View results</Button>
    </li>)}</ul>}
    {selected && <RunCharts run={selected} />}
  </div>;
}
export function BenchmarkHistory({ units }: { units: Incubator[] }) {
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const unit = units.find((u) => u.id === unitId) ?? units[0];
  return <section className="space-y-4 rounded-2xl border p-4 md:p-6" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
    <h2 className="font-bold" style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)" }}>Benchmark history</h2>
    {unit ? <><Select value={unit.id} onValueChange={setUnitId}><SelectTrigger aria-label="Benchmark chamber"><SelectValue /></SelectTrigger><SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select><ChamberRuns key={unit.id} unit={unit} /></> : <p>Add a chamber to view benchmark history.</p>}
  </section>;
}
