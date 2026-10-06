import type { IncubatorStatusFilter } from "../../features/incubators/selectors";
// Design tokens.
export const RUST = "var(--brand-primary)";
export const CARD = "var(--surface-subtle)";
export const BORDER = "var(--border-default)";
export const MUTED = "var(--text-secondary)";
export const TEXT = "var(--text-primary)";
export const INPUT_BORDER = "var(--input-border)";

export type Filter = IncubatorStatusFilter;

export const inputStyle = {
  borderColor: INPUT_BORDER,
  backgroundColor: "var(--surface-tile)",
};

// Framed white control matching the toolbar spec.
export const sortTriggerStyle = {
  backgroundColor: "var(--surface-card)",
  borderColor: "var(--border-default)",
  color: "var(--brand-primary)",
  fontWeight: "var(--weight-medium)",
};

export type SortKey = "progress" | "name";

export const sortOptions: { key: SortKey; label: string }[] = [
  { key: "progress", label: "Progress" },
  { key: "name", label: "Name" },
];
