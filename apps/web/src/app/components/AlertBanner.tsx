import { ChevronRight } from "lucide-react";
import { getUnitIssues } from "../domain/incubator";
import type { Incubator, Mode } from "../domain/types";
import { ExclamationIcon } from "./icons";
import { StatusIconBadge, statusIconBadgeGlyphSize } from "./StatusIconBadge";

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
      type="button"
      onClick={onView}
      className="w-full cursor-pointer text-left rounded-3xl px-5 py-4 flex items-center gap-4 transition-opacity hover:opacity-95 active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
      style={{
        backgroundColor: "var(--brand-primary)",
        color: "var(--on-brand)",
      }}
    >
      <StatusIconBadge
        size="banner"
        backgroundColor="var(--tint-on-brand)"
        icon={
          <ExclamationIcon
            size={statusIconBadgeGlyphSize("banner")}
            color="var(--status-icon-badge-fg)"
          />
        }
      />
      <div className="flex-1">
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--type-heading-sm)",
            fontWeight: "var(--weight-semibold)",
            lineHeight: "var(--leading-snug)",
            color: "var(--on-brand)",
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
        >
          {headline}
        </p>
        <p style={{ opacity: 0.9 }}>{detail}</p>
      </div>
      <ChevronRight size={22} className="shrink-0" />
    </button>
  );
}
