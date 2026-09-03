import type { Incubator, Mode, UnitStatus } from "../../domain/types";

export type IncubatorStatusFilter = "all" | UnitStatus;

export function selectFilteredIncubators(
  units: Incubator[],
  modes: Mode[],
  opts: { search: string; status: IncubatorStatusFilter; modeId: string },
): Incubator[] {
  const modeOf = (id: string) => modes.find((m) => m.id === id) ?? modes[0];
  const q = opts.search.trim().toLowerCase();
  return units.filter((u) => {
    if (opts.status !== "all" && u.status !== opts.status) return false;
    if (opts.modeId !== "all" && u.modeId !== opts.modeId) return false;
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || modeOf(u.modeId).name.toLowerCase().includes(q);
  });
}
