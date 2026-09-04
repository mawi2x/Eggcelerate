export type ResultError = { code: string; message: string; details?: unknown };
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ResultError };

export function resultMessage(
  result: Extract<Result<unknown>, { ok: false }>,
): string {
  return result.error.message;
}
