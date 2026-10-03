import type { ConditionSeverity, ConnectionState, CyclePhase } from "./cycle";

// IDs are opaque strings owned by the layer that creates the entity. Display
// names are never identifiers and must not be used for repository lookups.
export type FarmId = string;
export type UserId = string;
export type IncubatorId = string;
export type DeviceId = string;
export type CycleId = string;
export type ModeId = string;
export type AlertId = string;
export type CandlingEntryId = string;
export type HatchRecordId = string;

export type UnitStatus = "optimal" | "warning" | "alert";
export type PowerSource = "grid" | "battery";
export type TelemetryStatus = "fresh" | "stale" | "offline";
export type TurnCommandStatus =
  | "pending"
  | "dispatched"
  | "acked"
  | "rejected"
  | "timed_out";
export type AlertSeverity = "critical" | "warning" | "info";
export type ReadingState = "ok" | "warning" | "critical";
export type DevelopmentCheck = "veining" | "airCell" | "movement";

export interface Range {
  min: number;
  max: number;
}

export interface CandlingCheckpoint {
  label: string;
  dayRange: string;
  day: number;
}

// A Mode is a reusable preset template. It is not edited per incubator.
export interface Mode {
  id: ModeId;
  name: string;
  builtIn: boolean;
  targetTemp: Range;
  targetHumidity: Range;
  incubationDays: number;
  /** Domain/UI value in hours. Transport mappers convert it to minutes. */
  defaultTurnInterval: number;
}

export interface CandlingLogEntry {
  id?: CandlingEntryId;
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
}

export interface Incubator {
  id: IncubatorId;
  name: string;
  deviceId: DeviceId;
  modeId: ModeId;
  dayOfIncubation: number;
  totalEggsLoaded?: number;
  fertileEggs?: number;
  temp: number;
  humidity: number;
  waterOk: boolean;
  tempTrend: number;
  humidityTrend: number;
  powerSource: PowerSource;
  batteryPct: number;
  status: UnitStatus;
  turnCommandStatus?: TurnCommandStatus;
  lastTurned: string;
  nextTurn: string;
  /** Domain/UI value in hours. */
  turnInterval: number;
  autoTurn: boolean;
  paired: boolean;
  cyclePhase: CyclePhase;
  conditionSeverity: ConditionSeverity;
  connectionState: ConnectionState;
  telemetryStatus?: TelemetryStatus;
  telemetryObservedAt?: string | null;
  telemetryReceivedAt?: string | null;
  telemetryLastSeenAt?: string | null;
  candled: Record<number, boolean>;
  candlingLog: CandlingLogEntry[];
}

export interface TurnCommand {
  id: string;
  status: TurnCommandStatus;
  requestedAt?: string;
  executedAt?: string | null;
  errorCode?: string | null;
}

export interface Reading {
  ts: number;
  time: string;
  temp: number;
  humidity: number;
  tempMin?: number;
  tempMax?: number;
  humidityMin?: number;
  humidityMax?: number;
  sampleCount?: number;
  bucketSeconds?: number;
}

export interface AlertEntry {
  id: AlertId;
  severity: AlertSeverity;
  title: string;
  /** Temporary display-name reference; migrate to incubatorId at the repository boundary. */
  unit: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  conditionState?: "active" | "resolved";
  resolvedAt?: string;
  resolutionReason?: "recovered" | "configuration_changed" | "monitoring_ended";
}

export interface HatchRecord {
  id: HatchRecordId;
  chamber: string;
  modeName: string;
  startDate: string;
  endDate: string;
  totalEggs: number;
  fertileEggs: number | null;
  hatchedEggs: number;
}

export interface AbortedCycleRecord {
  id: string;
  incubator: string;
  modeName: string;
  stoppedOn: string;
  dayStopped: number;
  totalEggs: number;
  fertileEggs: number | null;
}
