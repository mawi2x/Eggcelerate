import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRepository } from "../app/data/repositories/api-repository";
import { wireExamples } from "../app/data/transport/examples";

describe("base URL normalization", () => {
  it("accepts origin-only and documented suffixed bases without doubling /api/v1", async () => {
    for (const baseUrl of [
      "http://api",
      "http://api/api/v1",
      "http://api/api/v1///",
      "/api",
      "/api/v1",
    ]) {
      const seen: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: unknown) => {
          seen.push(url as string);
          return { json: async () => wireResponse("/api/v1/incubators") };
        }),
      );
      const repository = new ApiRepository({ baseUrl });
      expect((await repository.listIncubators()).ok).toBe(true);
      expect(seen).toEqual([
        baseUrl.startsWith("/")
          ? "/api/v1/incubators"
          : "http://api/api/v1/incubators",
      ]);
    }
  });
});

function wireResponse(path: string): unknown {
  const found = wireExamples.find((item) => item.path === path);

  if (!found) throw new Error(`Missing wire example for ${path}`);
  return found.response;
}

function stubFetch(
  handler: (
    url: string,
    init: RequestInit | undefined,
  ) => { status: number; body: unknown },
) {
  return vi.fn(async (url: unknown, init?: RequestInit) => ({
    json: async () => handler(url as string, init).body,
  }));
}

describe("ApiRepository transport", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps the incubator list through domain mappers", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch(() => ({
        status: 200,
        body: wireResponse("/api/v1/incubators"),
      })),
    );
    const repository = new ApiRepository({ baseUrl: "http://api" });
    const result = await repository.listIncubators();
    expect(result.ok && result.data).toHaveLength(1);
    expect(result.ok && result.data[0]?.turnInterval).toBe(4);
    expect(result.ok && result.data[0]?.candled).toEqual({ 6: true });
  });

  it("translates every error code without rewriting it", async () => {
    for (const code of [
      "validation_error",
      "not_found",
      "conflict",
      "rejected",
      "offline",
      "timeout",
    ]) {
      vi.stubGlobal(
        "fetch",
        stubFetch(() => ({
          status: 400,
          body: { ok: false, error: { code, message: `${code} happened` } },
        })),
      );
      const repository = new ApiRepository({ baseUrl: "http://api" });
      const result = await repository.getIncubator("chamber-1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(code);
        expect(result.error.message).toBe(`${code} happened`);
      }
    }
  });

  it("maps transport failures to offline and aborts to timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const offline = await new ApiRepository({
      baseUrl: "http://api",
    }).getIncubator("x");
    expect(offline.ok).toBe(false);
    if (!offline.ok) expect(offline.error.code).toBe("offline");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("aborted", "AbortError");
      }),
    );
    const timedOut = await new ApiRepository({
      baseUrl: "http://api",
    }).getIncubator("x");
    expect(timedOut.ok).toBe(false);
    if (!timedOut.ok) expect(timedOut.error.code).toBe("timeout");
  });

  it("treats contract breaches as unknown errors", async () => {
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      stubFetch(() => ({ status: 200, body: { ok: true, data: { nope: 1 } } })),
    );
    const result = await new ApiRepository({
      baseUrl: "http://api",
    }).getIncubator("x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unknown_error");
    silence.mockRestore();
  });

  it("sends idempotency keys and converts hours to wire minutes", async () => {
    const seen: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        seen.push({ url: url as string, init });
        return { json: async () => wireResponse("/api/v1/incubators") };
      }),
    );
    const repository = new ApiRepository({
      baseUrl: "http://api",
      newIdempotencyKey: () => "key-1",
    });
    await repository.updateIncubatorConfiguration("chamber-1", {
      modeId: "duck",
      turnIntervalHours: 4,
    });
    const call = seen[0];
    const headers = call.init?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("key-1");
    const body = JSON.parse(call.init?.body as string) as Record<
      string,
      unknown
    >;
    expect(body).toEqual({ mode_id: "duck", turn_interval_min: 240 });
  });

  it("posts clear acknowledged alerts through a same-origin base", async () => {
    const seen: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        seen.push({ url: url as string, init });
        return {
          json: async () =>
            wireResponse("/api/v1/alerts/actions/clear-acknowledged"),
        } as Response;
      }),
    );
    const repository = new ApiRepository({
      baseUrl: "/api",
      newIdempotencyKey: () => "clear-key",
    });

    const result = await repository.clearReadAlerts();

    expect(result.ok).toBe(true);
    expect(seen[0]?.url).toBe("/api/v1/alerts/actions/clear-acknowledged");
    expect(new Headers(seen[0]?.init?.headers).get("Idempotency-Key")).toBe(
      "clear-key",
    );
  });
});
