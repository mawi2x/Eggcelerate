import { type FormEvent, useEffect, useRef, useState } from "react";
import type { ReadingBounds } from "../../data/repositories/repository";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { CONTROL_FONT, MUTED } from "./presentation";

function localInputDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function CustomDateRangeControls({ active, bounds, onApply }: {
  active: boolean;
  bounds?: ReadingBounds | null;
  onApply: (bounds: ReadingBounds) => void;
}) {
  const [initialNow] = useState(() => Date.now());
  const [from, setFrom] = useState(() => localInputDate(bounds ? Date.parse(bounds.start) : initialNow - 86400000));
  const [to, setTo] = useState(() => localInputDate(bounds ? Date.parse(bounds.end) : initialNow));
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(() => bounds ? { from: localInputDate(Date.parse(bounds.start)), to: localInputDate(Date.parse(bounds.end)) } : null);
  const errorSummary = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorSummary.current?.focus(); }, [error]);
  const changed = !active || applied?.from !== from || applied?.to !== to;
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lower = Date.parse(from), upper = Date.parse(to);
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) {
      setError("Choose a From date and time earlier than To.");
      return;
    }
    if (upper > Date.now()) {
      setError("To cannot be in the future.");
      return;
    }
    setError(null);
    setApplied({ from, to });
    onApply({ start: new Date(lower).toISOString(), end: new Date(upper).toISOString() });
  };
  return (
    <form onSubmit={apply} className="min-w-0 flex-1 space-y-1.5 md:max-w-[38rem]" aria-label="Custom date range">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-44 space-y-1">
          <Label htmlFor="trend-from" style={{ ...CONTROL_FONT, color: MUTED }}>From</Label>
          <Input size="compact" id="trend-from" type="datetime-local" required value={from} onChange={(event) => { setFrom(event.target.value); setError(null); }} style={{ ...CONTROL_FONT, fontSize: "var(--type-control-value)", fontWeight: "var(--weight-regular)", color: "var(--text-secondary)", backgroundColor: "var(--surface-muted)" }} className="h-[var(--control-height-default)] w-full min-w-0 rounded-xl border-[var(--input-border)] focus-visible:border-[var(--brand-primary)] focus-visible:ring-[var(--brand-primary)]/25 md:h-[var(--control-height-compact)]" />
        </div>
        <div className="min-w-0 flex-1 basis-44 space-y-1">
          <Label htmlFor="trend-to" style={{ ...CONTROL_FONT, color: MUTED }}>To</Label>
          <Input size="compact" id="trend-to" type="datetime-local" required value={to} onChange={(event) => { setTo(event.target.value); setError(null); }} style={{ ...CONTROL_FONT, fontSize: "var(--type-control-value)", fontWeight: "var(--weight-regular)", color: "var(--text-secondary)", backgroundColor: "var(--surface-muted)" }} className="h-[var(--control-height-default)] w-full min-w-0 rounded-xl border-[var(--input-border)] focus-visible:border-[var(--brand-primary)] focus-visible:ring-[var(--brand-primary)]/25 md:h-[var(--control-height-compact)]" />
        </div>
        <Button type="submit" variant="outline" className="h-[var(--control-height-action)] rounded-xl border-[var(--brand-primary-soft)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-hover)] hover:bg-[var(--brand-primary-soft-hover)] hover:text-[var(--brand-primary-hover)]" style={{ fontFamily: "var(--font-body)", fontSize: "var(--type-button-label)", fontWeight: "var(--weight-bold)", lineHeight: "var(--leading-button)" }} disabled={!changed}>
          {changed ? "Apply" : "Applied"}
        </Button>
      </div>
      {error && <p ref={errorSummary} tabIndex={-1} role="alert" className="text-(length:--type-body-sm) leading-[var(--leading-normal)] text-[var(--status-danger-fg)]">{error}</p>}
    </form>
  );
}
