export interface Account {
  farmName: string;
  /** Resized JPEG profile photo, saved with farm preferences. */
  profilePhoto?: string | null;
  /** Full legal name, e.g. "Farmer Juan Dela Cruz". */
  accountHolder: string;
  /** Optional short name for the sidebar profile card, e.g. "Farmer Juan". */
  displayName: string;
}

// Input character caps, shared by the forms that write these values.
export const FARM_NAME_MAX = 30;
export const ACCOUNT_HOLDER_MAX = 35;
export const DISPLAY_NAME_MAX = 20;
export const CHAMBER_NAME_MAX = 30;

export const initialAccount: Account = {
  farmName: "Sunrise Poultry",
  accountHolder: "Farmer Juan Dela Cruz",
  displayName: "Farmer Juan",
};

/**
 * Name shown on the sidebar profile card: the Display Name when set, otherwise
 * the first word of the Account Holder so the card never needs to truncate.
 */
export function resolveDisplayName(account: Account): string {
  const short = account.displayName.trim();
  if (short) return short;
  return account.accountHolder.trim().split(/\s+/)[0] ?? "";
}

/** Initials for the avatar, from the first and last word of the full name. */
export function accountInitials(account: Account): string {
  const words = account.accountHolder.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}
