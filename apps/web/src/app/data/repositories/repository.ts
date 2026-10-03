import type { Result } from "../../domain/result";
import type {
  AbortedCycleRecord,
  AlertEntry,
  DevelopmentCheck,
  HatchRecord,
  Incubator,
  Mode,
  Reading,
  TurnCommand,
} from "../../domain/types";
import type { SettingsPreferences } from "../settings";

export type RepositoryOperation =
  | "listIncubators"
  | "getIncubator"
  | "addIncubator"
  | "updateIncubatorProfile"
  | "updateIncubatorConfiguration"
  | "startCycle"
  | "resetStoppedCycle"
  | "requestManualTurn"
  | "getTurnCommand"
  | "reconnectIncubator"
  | "createCandlingEntry"
  | "updateCandlingEntry"
  | "deleteCandlingEntry"
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
  | "completeCycle"
  | "listAbortedCycles"
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
export type UpdateIncubatorProfileInput = {
  name: string;
};

export type UpdateIncubatorConfigurationInput = {
  modeId?: string;
  autoTurn?: boolean;
  turnIntervalHours?: number;
};

export type StartCycleInput = {
  modeId: string;
  totalEggs: number;
};

export type CandlingEntryInput = {
  day: number;
  label: string;
  date: string;
  fertile: number;
  clear: number;
  uncertain: number;
  note: string;
  photos: string[];
  checks: DevelopmentCheck[];
  checkpointType?: "first" | "later";
  developing?: number;
  stoppedDeveloping?: number;
};

export type UpdateCandlingEntryInput = Partial<Omit<CandlingEntryInput, "day">>;

export type ReadingWindow = "24h" | "7d" | "full";

export type ReadingQuery = {
  incubatorId: string;
  window: ReadingWindow;
  resolution?: "chart";
};

export type RawReadingScope = {
  incubatorIds: string[];
  window: ReadingWindow;
  end: string;
};
export type ScopedRawReading = {
  incubatorId: string;
  chamber: string;
  reading: Reading;
  receivedAt: string;
  waterOk: boolean;
};
export type RawReadingPreview = {
  rows: ScopedRawReading[];
  total: number;
  end: string;
  scopeToken: string;
};

export interface MutationOptions {
  idempotencyKey: string;
}

export interface EggcelerateRepository {
  listIncubators(): Promise<Result<Incubator[]>>;
  getIncubator(id: string): Promise<Result<Incubator>>;
  addIncubator(
    unit: Incubator,
    options?: MutationOptions,
  ): Promise<Result<Incubator>>;
  updateIncubatorProfile(
    id: string,
    input: UpdateIncubatorProfileInput,
    options?: MutationOptions,
  ): Promise<Result<Incubator>>;
  updateIncubatorConfiguration(
    id: string,
    input: UpdateIncubatorConfigurationInput,
    options?: MutationOptions,
  ): Promise<Result<Incubator>>;
  startCycle(
    id: string,
    input: StartCycleInput,
    options?: MutationOptions,
  ): Promise<Result<Incubator>>;
  resetStoppedCycle(
    id: string,
    options?: MutationOptions,
  ): Promise<Result<Incubator>>;
  requestManualTurn(
    id: string,
    options?: MutationOptions,
  ): Promise<Result<TurnCommand>>;
  getTurnCommand(
    incubatorId: string,
    commandId: string,
  ): Promise<Result<TurnCommand>>;
  reconnectIncubator(
    id: string,
    options?: MutationOptions,
  ): Promise<Result<Incubator>>;
  createCandlingEntry(
    id: string,
    input: CandlingEntryInput,
    options?: MutationOptions,
  ): Promise<Result<Incubator>>;
  updateCandlingEntry(
    id: string,
    day: number,
    input: UpdateCandlingEntryInput,
    options?: MutationOptions,
  ): Promise<Result<Incubator>>;
  deleteCandlingEntry(
    id: string,
    day: number,
    options?: MutationOptions,
  ): Promise<Result<Incubator>>;
  listReadings(query: ReadingQuery): Promise<Result<Reading[]>>;
  previewRawReadings(
    query: RawReadingScope,
  ): Promise<Result<RawReadingPreview>>;
  exportRawReadings(scopeToken: string): Promise<Result<Blob>>;
  listModes(): Promise<Result<Mode[]>>;
  addMode(mode: Mode, options?: MutationOptions): Promise<Result<Mode>>;
  updateMode(
    id: string,
    patch: Partial<Mode>,
    options?: MutationOptions,
  ): Promise<Result<Mode>>;
  deleteMode(
    id: string,
    options?: MutationOptions,
  ): Promise<Result<{ id: string }>>;
  listAlerts(): Promise<Result<AlertEntry[]>>;
  acknowledgeAlert(
    id: string,
    options?: MutationOptions,
  ): Promise<Result<AlertEntry>>;
  dismissAlert(
    id: string,
    options?: MutationOptions,
  ): Promise<Result<{ id: string }>>;
  markAllAlertsRead(options?: MutationOptions): Promise<Result<AlertEntry[]>>;
  clearReadAlerts(options?: MutationOptions): Promise<Result<AlertEntry[]>>;
  listHatchRecords(): Promise<Result<HatchRecord[]>>;
  completeCycle(
    input: CompleteCycleInput,
    options?: MutationOptions,
  ): Promise<Result<HatchRecord>>;
  listAbortedCycles(): Promise<Result<AbortedCycleRecord[]>>;
  stopCycle(
    input: StopCycleInput,
    options?: MutationOptions,
  ): Promise<Result<AbortedCycleRecord>>;
  listSettings(): Promise<Result<SettingsPreferences>>;
  saveSettings(
    settings: SettingsPreferences,
    options?: MutationOptions,
  ): Promise<Result<SettingsPreferences>>;
}
