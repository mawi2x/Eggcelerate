import type { Incubator } from "../../domain/types";
import { reportedOutputStates, resolvedTelemetryStatus } from "../../features/farm/telemetry";
import { useTemperatureDisplay } from "../../providers/temperature-context";
import { benchmarkModes, benchmarkStatus, type useBenchmarks } from "../../features/benchmarks/use-benchmarks";
import { Button } from "../ui/button";

export function BenchmarkStatus({ model, unit }: { model: ReturnType<typeof useBenchmarks>; unit: Incubator }) {
  const temperature = useTemperatureDisplay();
  const outputs = reportedOutputStates(unit);
  const run = model.active;
  if (!run) return null;
  const snapshot = run.result;
  const stage = run.kind === "lhm" ? snapshot?.stage === 1 ? "Measuring at 60% exhaust" : snapshot?.stage === 2 ? "Measuring at 100% exhaust" : "Warming and stabilizing" : "Measuring";
  return <section aria-label="Current benchmark" className="space-y-3 rounded-2xl border p-4" style={{ background: "var(--surface-card)", borderColor: "var(--border-default)" }}>
    <h2 className="font-bold" style={{ fontFamily: "var(--font-display)", fontSize: "var(--type-heading-sm)" }}>{benchmarkModes.find((m) => m.id === run.kind)?.name}</h2>
    <p role="status" aria-live="polite">{benchmarkStatus(run.status)}{snapshot ? `. ${stage}. ${Math.floor(snapshot.elapsed_ms / 60000)} minutes elapsed.` : "."}</p>
    <p style={{ color: "var(--text-secondary)", fontSize: "var(--type-body-sm)" }}>Empty chamber test. No eggs or tray turning. Maximum duration is one hour.</p>
    <dl className="grid grid-cols-2 gap-3">
      <div><dt>Temperature</dt><dd className="text-xl font-bold tabular-nums">{Number.isFinite(unit.temp) ? temperature.value(unit.temp).toFixed(1) : "—"}{temperature.unit}</dd></div>
      <div><dt>Humidity</dt><dd className="text-xl font-bold tabular-nums">{Number.isFinite(unit.humidity) ? unit.humidity.toFixed(1) : "—"}% RH</dd></div>
      {outputs && <><div><dt>Heating element</dt><dd>{outputs.heaterOn ? "On" : "Off"}</dd></div><div><dt>Mist maker</dt><dd>{outputs.mistOn ? "On" : "Off"}</dd></div><div><dt>Upper circulation fan</dt><dd>{outputs.fanOn ? "On" : "Off"}</dd></div><div><dt>Lower exhaust fan</dt><dd>{outputs.exhaustOn ? "On" : "Off"}</dd></div></>}
    </dl>
    {resolvedTelemetryStatus(unit) !== "fresh" && <p role="status">Sensor readings are delayed. These are the last received values.</p>}
    {model.query.isError && <p role="alert">Connection unavailable. The device timeout remains active; stop has not been confirmed.</p>}
    {model.stop.isError && <p role="alert">{model.stop.error.message}</p>}
    <Button variant="outline" className="rounded-full" disabled={model.stop.isPending} onClick={() => model.stop.mutate()}>{run.status === "stopping" ? "Retry Stop" : "Stop benchmark"}</Button>
  </section>;
}
