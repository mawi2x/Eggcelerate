export const RESULT_ERROR_CODES = [
  "unauthorized",
  "validation_error",
  "not_found",
  "conflict",
  "rejected",
  "offline",
  "timeout",
  "unknown_error",
] as const;

export type ResultErrorCode = (typeof RESULT_ERROR_CODES)[number];
export type ResultError = {
  code: ResultErrorCode;
  message: string;
  details?: unknown;
};
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ResultError };

export function resultMessage(
  result: Extract<Result<unknown>, { ok: false }>,
): string {
  return result.error.message;
}
