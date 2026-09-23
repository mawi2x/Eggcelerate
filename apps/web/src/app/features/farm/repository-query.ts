import type { Result, ResultErrorCode } from "../../domain/result";

export class RepositoryQueryError extends Error {
  readonly code: ResultErrorCode;
  readonly details?: unknown;

  constructor(code: ResultErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "RepositoryQueryError";
    this.code = code;
    this.details = details;
  }
}

export function requireResultData<T>(result: Result<T>): T {
  if (result.ok) return result.data;
  throw new RepositoryQueryError(
    result.error.code,
    result.error.message,
    result.error.details,
  );
}

export function repositoryErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The farm data operation failed.";
}

export type MutationErrorPresentation = {
  title: string;
  description: string;
};

export function mutationErrorPresentation(
  error: unknown,
  options: { rolledBack?: boolean } = {},
): MutationErrorPresentation {
  const code =
    error instanceof RepositoryQueryError ? error.code : "unknown_error";
  const recovery = options.rolledBack
    ? " The previous values were restored."
    : " Your unsaved changes are still available.";

  if (code === "offline") {
    return {
      title: "You're offline",
      description: `Reconnect, then try again.${recovery}`,
    };
  }
  if (code === "timeout") {
    return {
      title: "Confirmation timed out",
      description: `The change was not confirmed. Try again.${recovery}`,
    };
  }
  if (
    code === "rejected" ||
    code === "validation_error" ||
    code === "conflict"
  ) {
    return {
      title: "Change rejected",
      description: `${repositoryErrorMessage(error)}${recovery}`,
    };
  }
  return {
    title: "Change wasn't saved",
    description: `${repositoryErrorMessage(error)}${recovery}`,
  };
}
