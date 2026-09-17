/**
 * Create a key for a retryable mutation.
 *
 * `crypto.randomUUID()` is restricted to secure contexts in browsers. The
 * dashboard is also used behind an HTTP-only internal preview, so keep the
 * mutation contract working there with the broadly available random-values
 * API and a final uniqueness fallback.
 */
let fallbackSequence = 0;

export function createIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    try {
      return cryptoApi.randomUUID();
    } catch {
      // Fall through when a browser exposes but blocks the secure-only API.
    }
  }
  if (typeof cryptoApi?.getRandomValues === "function") {
    try {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      // Keep the familiar UUID shape while using a v4-compatible variant.
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0"),
      );
      return [
        hex.slice(0, 4).join(""),
        hex.slice(4, 6).join(""),
        hex.slice(6, 8).join(""),
        hex.slice(8, 10).join(""),
        hex.slice(10, 16).join(""),
      ].join("-");
    } catch {
      // The non-cryptographic fallback below still gives every tab a
      // timestamp/sequence/random combination suitable for idempotency.
    }
  }
  const sequence = fallbackSequence++;
  return `idempotency-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
