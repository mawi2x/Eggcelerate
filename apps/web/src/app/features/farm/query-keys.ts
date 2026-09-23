export const farmQueryKeys = {
  all: ["farm"] as const,
  incubators: ["farm", "incubators"] as const,
  modes: ["farm", "modes"] as const,
  alerts: ["farm", "alerts"] as const,
  hatchRecords: ["farm", "hatch-records"] as const,
  abortedCycles: ["farm", "aborted-cycles"] as const,
  readings: ["farm", "readings"] as const,
  readingsFor: (incubatorId: string) =>
    ["farm", "readings", incubatorId] as const,
  settings: ["farm", "settings"] as const,
  turnCommand: (incubatorId: string) =>
    ["farm", "turn-command", incubatorId] as const,
  readingWindow: (incubatorId: string, window: string) =>
    ["farm", "readings", incubatorId, window] as const,
};
