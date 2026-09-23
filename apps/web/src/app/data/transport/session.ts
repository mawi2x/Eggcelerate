let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function notifySessionExpired(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("eggcelerate:session-expired"));
  }
}
