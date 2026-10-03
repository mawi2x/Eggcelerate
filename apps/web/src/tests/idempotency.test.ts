import { afterEach, describe, expect, it, vi } from "vitest";
import { createIdempotencyKey } from "../app/data/transport/idempotency";

describe("idempotency key generation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the browser UUID API when available", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid-from-browser" });
    expect(createIdempotencyKey()).toBe("uuid-from-browser");
  });

  it("keeps mutation keys distinct when crypto is absent", () => {
    vi.stubGlobal("crypto", undefined);
    const first = createIdempotencyKey();
    const second = createIdempotencyKey();
    expect(first).toMatch(/^idempotency-[a-z0-9-]+$/);
    expect(second).not.toBe(first);
  });

  it("still creates a UUID-shaped key when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(7),
    });
    expect(createIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("falls back when the browser blocks both random APIs", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new DOMException("secure context required", "SecurityError");
      },
      getRandomValues: () => {
        throw new DOMException("secure context required", "SecurityError");
      },
    });
    expect(createIdempotencyKey()).toMatch(/^idempotency-[a-z0-9-]+$/);
  });
});
