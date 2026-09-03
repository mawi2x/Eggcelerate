import type { Result } from "../../domain/result";
import type {
  AbortedCycleRecord,
  AlertEntry,
  HatchRecord,
  Incubator,
  Mode,
  Reading,
} from "../../domain/types";
import type { SettingsPreferences } from "../settings";

export type RepositoryOperation =
  | "listIncubators"
  | "getIncubator"
  | "addIncubator"
  | "updateIncubator"
  | "listReadings"
  | "listModes"
  | "addMode"
  | "updateMode"
  | "deleteMode"
  | "listAlerts"
  | "acknowledgeAlert"
  | "dismissAlert"
  | "markAllAlertsRead"
  | "clearReadAlerts"
  | "listHatchRecords"
  | "recordHarvest"
  | "completeCycle"
  | "listAbortedCycles"
  | "recordAbortedCycle"
  | "stopCycle"
  | "listSettings"
  | "saveSettings";

export type RepositoryFailureMode = "offline" | "rejected" | "timeout";

export type HarvestInput = {
  chamber: string;
  modeName: string;
  cycleDays: number;
  totalEggs: number;
  fertileEggs: number | null;
  hatchedEggs: number;
};

export type AbortedCycleInput = {
  incubator: string;
  modeName: string;
  dayStopped: number;
  totalEggs: number;
  fertileEggs: number | null;
};

export type CompleteCycleInput = HarvestInput & { incubatorId: string };
export type StopCycleInput = AbortedCycleInput & { incubatorId: string };

export type CompletedCycle = {
  incubator: Incubator;
  record: HatchRecord;
};

export type StoppedCycle = {
  incubator: Incubator;
  record: AbortedCycleRecord;
};

export type ReadingWindow = "24h" | "7d" | "full";

export type ReadingQuery = {
  incubatorId: string;
  window: ReadingWindow;
};

export interface EggcelerateRepository {
  listIncubators(): Promise<Result<Incubator[]>>;
  getIncubator(id: string): Promise<Result<Incubator>>;
  addIncubator(unit: Incubator): Promise<Result<Incubator>>;
  updateIncubator(id: string, patch: Partial<Incubator>): Promise<Result<Incubator>>;
  listReadings(query: ReadingQuery): Promise<Result<Reading[]>>;
  listModes(): Promise<Result<Mode[]>>;
  addMode(mode: Mode): Promise<Result<Mode>>;
  updateMode(id: string, patch: Partial<Mode>): Promise<Result<Mode>>;
  deleteMode(id: string): Promise<Result<{ id: string }>>;
  listAlerts(): Promise<Result<AlertEntry[]>>;
  acknowledgeAlert(id: string): Promise<Result<AlertEntry>>;
  dismissAlert(id: string): Promise<Result<{ id: string }>>;
  markAllAlertsRead(): Promise<Result<AlertEntry[]>>;
  clearReadAlerts(): Promise<Result<AlertEntry[]>>;
  listHatchRecords(): Promise<Result<HatchRecord[]>>;
  recordHarvest(input: HarvestInput): Promise<Result<HatchRecord>>;
  completeCycle(input: CompleteCycleInput): Promise<Result<CompletedCycle>>;
  listAbortedCycles(): Promise<Result<AbortedCycleRecord[]>>;
  recordAbortedCycle(input: AbortedCycleInput): Promise<Result<AbortedCycleRecord>>;
  stopCycle(input: StopCycleInput): Promise<Result<StoppedCycle>>;
  listSettings(): Promise<Result<SettingsPreferences>>;
  saveSettings(settings: SettingsPreferences): Promise<Result<SettingsPreferences>>;
}
