import { AlertOctagon, ChevronRight } from "lucide-react";
import { Incubator, Mode, getUnitIssues } from "../data/mockData";

interface Props {
  criticalUnits: Incubator[];
  modes: Mode[];
  onView: () => void;
}

function summarize(unit: Incubator, mode: Mode): string {
  const issues = getUnitIssues(unit, mode);
  if (issues.length === 0) return `${unit.name} needs attention`;
  if (issues.length <= 2) return `${unit.name}: ${issues.join(", ")}`;
  return `${unit.name} needs attention. ${issues.length} issues found.`;
}

export function AlertBanner({ criticalUnits, modes, onView }: Props) {
  if (criticalUnits.length === 0) return null;
  const modeOf = (id: string) => modes.find((m) => m.id === id) ?? modes[0];

  const headline =
    criticalUnits.length === 1
      ? summarize(criticalUnits[0], modeOf(criticalUnits[0].modeId))
      : `${criticalUnits.length} chambers need attention`;

  const detail =
    criticalUnits.length === 1
      ? "Tap to open this chamber and resolve it."
      : criticalUnits.map((u) => summarize(u, modeOf(u.modeId))).join(" · ");

  return (
    <button
      onClick={onView}
      className="w-full text-left rounded-3xl px-5 py-4 flex items-center gap-4 transition-opacity hover:opacity-95"
      style={{ backgroundColor: "var(--brand-primary)", color: "var(--on-brand)" }}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>
        <AlertOctagon size={22} />
      </span>
      <div className="flex-1">
        <p style={{ fontFamily: "Baloo 2, sans-serif", fontSize: 17, fontWeight: 600 }}>{headline}</p>
        <p style={{ opacity: 0.9 }}>{detail}</p>
      </div>
      <ChevronRight size={22} className="shrink-0" />
    </button>
  );
}
