import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRepository } from "../app/data/repositories/api-repository";
import { wireExamples } from "../app/data/transport/examples";

describe("base URL normalization", () => {
  it("binds native fetch to the browser global receiver", async () => {
    vi.stubGlobal("fetch", async function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return { json: async () => wireResponse("/api/v1/incubators") };
    });
    try {
      const result = await new ApiRepository({
        baseUrl: "http://api",
      }).listIncubators();
      expect(result.ok).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

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
      "unknown_error",
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

  it("rejects malformed API error envelopes and unknown error codes", async () => {
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      stubFetch(() => ({
        status: 400,
        body: {
          ok: false,
          error: { code: "future_error", message: "Invalid server code" },
        },
      })),
    );
    const result = await new ApiRepository({
      baseUrl: "http://api",
    }).getIncubator("chamber-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unknown_error");
    silence.mockRestore();
  });

  it("keeps turn acceptance separate from the polled command status", async () => {
    const seen: { url: string; method: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        const target = url as string;
        const method = init?.method ?? "GET";
        seen.push({ url: target, method });
        return {
          json: async () =>
            method === "POST"
              ? { ok: true, data: { command_id: "cmd-7", status: "accepted" } }
              : {
                  ok: true,
                  data: {
                    command_id: "cmd-7",
                    status: "acked",
                    requested_at: "2026-09-23T10:00:00+00:00",
                    executed_at: "2026-09-23T10:00:02+00:00",
                    error_code: null,
                  },
                },
        } as Response;
      }),
    );
    const repository = new ApiRepository({ baseUrl: "http://api" });

    const accepted = await repository.requestManualTurn("chamber-7", {
      idempotencyKey: "cmd-7",
    });
    expect(accepted.ok && accepted.data).toMatchObject({
      id: "cmd-7",
      status: "pending",
    });
    expect(seen).toHaveLength(1);

    const confirmed = await repository.getTurnCommand("chamber-7", "cmd-7");
    expect(confirmed.ok && confirmed.data).toMatchObject({
      id: "cmd-7",
      status: "acked",
      errorCode: null,
    });
    expect(seen.map(({ method }) => method)).toEqual(["POST", "GET"]);
    expect(seen[1]?.url).toContain("/commands/cmd-7");
  });

  it("revalidates a cached candling ID before retrying an entry mutation", async () => {
    let entryId = "entry-old";
    let loseFirstPatch = true;
    const patchPaths: string[] = [];
    const repository = new ApiRepository({
      baseUrl: "http://api",
      fetchImpl: vi.fn(async (url: unknown, init?: RequestInit) => {
        const path = String(url);
        if (path.endsWith("/candling-entries") && init?.method === "GET") {
          return {
            json: async () => ({
              ok: true,
              data: [
                {
                  id: entryId,
                  day: 2,
                  label: "First check",
                  observed_on: "2026-09-10",
                  fertile_eggs: 10,
                  clear_eggs: 0,
                  uncertain_eggs: 0,
                  note: "Before",
                  photo_keys: [],
                  checks: [],
                  checkpoint_type: "first",
                },
              ],
            }),
          } as Response;
        }
        if (init?.method === "PATCH") {
          patchPaths.push(path);
          if (loseFirstPatch) {
            loseFirstPatch = false;
            throw new TypeError("Patch response lost");
          }
          return {
            json: async () => ({
              ok: true,
              data: {
                id: entryId,
                day: 2,
                label: "First check",
                observed_on: "2026-09-10",
                fertile_eggs: 10,
                clear_eggs: 0,
                uncertain_eggs: 0,
                note: "After",
                photo_keys: [],
                checks: [],
                checkpoint_type: "first",
              },
            }),
          } as Response;
        }
        return {
          json: async () => wireResponse("/api/v1/incubators/chamber-1"),
        } as Response;
      }),
    });
    const options = { idempotencyKey: "same-entry-update" };
    const input = { note: "After" };
    const first = await repository.updateCandlingEntry(
      "chamber-1",
      2,
      input,
      options,
    );
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.error.code).toBe("offline");

    entryId = "entry-new";
    const retried = await repository.updateCandlingEntry(
      "chamber-1",
      2,
      input,
      options,
    );
    expect(retried.ok).toBe(true);
    expect(patchPaths[0]).toContain("/entry-old");
    expect(patchPaths[1]).toContain("/entry-new");
  });

  it.each(["complete", "stop"] as const)(
    "returns a committed %s record without depending on a second incubator fetch",
    async (operation) => {
      const terminalExample = wireExamples.find((item) =>
        item.path.endsWith(`/cycles/current/${operation}`),
      );
      if (!terminalExample) throw new Error(`Missing ${operation} example`);
      const seen: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: unknown) => {
          seen.push(url as string);
          return { json: async () => terminalExample.response } as Response;
        }),
      );
      const repository = new ApiRepository({ baseUrl: "http://api" });
      const result =
        operation === "complete"
          ? await repository.completeCycle({
              incubatorId: "chamber-1",
              chamber: "Chamber One",
              modeName: "Broiler",
              cycleDays: 21,
              totalEggs: 12,
              fertileEggs: 10,
              hatchedEggs: 9,
            })
          : await repository.stopCycle({
              incubatorId: "chamber-1",
              incubator: "Chamber One",
              modeName: "Broiler",
              dayStopped: 8,
              totalEggs: 12,
              fertileEggs: 10,
            });
      expect(result.ok).toBe(true);
      expect(seen).toHaveLength(1);
      expect(seen[0]).toContain(`/cycles/current/${operation}`);
    },
  );

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
