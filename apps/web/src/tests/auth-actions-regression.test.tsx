import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiAuthClient } from "../app/data/auth/api-auth-client";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import { getCsrfToken, setCsrfToken } from "../app/data/transport/session";
import {
  AppProviders,
  createAppQueryClient,
} from "../app/providers/AppProviders";
import { MockAuthProvider, useAuth } from "../app/providers/auth-context";
import { render, waitFor } from "./render";

const identity = {
  authenticated: true,
  user: {
    id: "u",
    email: "farmer@example.com",
    display_name: "Farmer",
    role: "owner",
  },
  farm: { id: "farm", name: "Our Farm" },
  csrf_token: "c".repeat(43),
} as const;
const account = {
  email: "farmer@example.com",
  password: "StrongPassword123!",
  displayName: "Farmer",
  farmName: "Our Farm",
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setCsrfToken(null);
});

describe("authentication actions after the React upgrade", () => {
  it.each([
    [() => Promise.reject(new Error("Network down")), "unreachable"],
    [() => Promise.resolve(new Response("not json")), "unreadable"],
    [
      () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ok: false,
              error: { message: "Account disabled" },
            }),
            { status: 403 },
          ),
        ),
      "Account disabled",
    ],
    [
      () =>
        Promise.resolve(
          new Response(JSON.stringify({ message: "Proxy error" }), {
            status: 502,
          }),
        ),
      "could not be completed",
    ],
    [
      () => Promise.resolve(new Response(JSON.stringify({ wrong: true }))),
      "unexpected response",
    ],
  ])("preserves useful sign-in failure feedback", async (response, message) => {
    const client = new ApiAuthClient(
      "/api",
      vi.fn<typeof fetch>().mockImplementation(response),
    );
    await expect(
      client.signIn(account.email, account.password, false),
    ).rejects.toThrow(message);
  });
  it("clears stale CSRF for an anonymous session and rejects cancelled session checks", async () => {
    const response = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            data: { authenticated: false, registration_enabled: true },
          }),
        ),
      );
    const client = new ApiAuthClient(
      "/api",
      vi.fn<typeof fetch>().mockImplementation(response),
    );
    setCsrfToken("stale csrf");
    expect(await client.session()).toEqual({
      identity: null,
      registrationEnabled: true,
    });
    expect(getCsrfToken()).toBeNull();
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(client.session(cancelled.signal)).rejects.toThrow("cancelled");
  });
  it.each(["mock", "api"] as const)(
    "clears private queries when %s users register, sign in and sign out",
    async (mode) => {
      vi.spyOn(ApiAuthClient.prototype, "session").mockResolvedValue({
        identity: null,
        registrationEnabled: true,
      });
      vi.spyOn(ApiAuthClient.prototype, "register").mockResolvedValue(identity);
      vi.spyOn(ApiAuthClient.prototype, "signIn").mockResolvedValue(identity);
      vi.spyOn(ApiAuthClient.prototype, "signOut").mockResolvedValue(undefined);
      let auth: ReturnType<typeof useAuth>;
      function Probe() {
        auth = useAuth();
        return (
          <span>
            {auth.status}:{auth.user?.email}
          </span>
        );
      }
      const client = createAppQueryClient();
      const mounted = await render(
        mode === "api" ? (
          <AppProviders
            repository={new InMemoryEggcelerateRepository()}
            authApiBaseUrl="/api"
            queryClient={client}
          >
            <Probe />
          </AppProviders>
        ) : (
          <MockAuthProvider initiallyAuthenticated={false} queryClient={client}>
            <Probe />
          </MockAuthProvider>
        ),
      );
      try {
        await waitFor(
          () =>
            mounted.container.textContent?.includes("unauthenticated") ?? false,
        );
        for (const action of [
          () => auth.register(account),
          () => auth.signIn(account.email, account.password),
        ]) {
          client.setQueryData(["private"], "old farm");
          await act(action);
          expect(mounted.container.textContent).toContain(
            `authenticated:${account.email}`,
          );
          expect(client.getQueryData(["private"])).toBeUndefined();
          client.setQueryData(["private"], "current farm");
          await act(() => auth.signOut());
          expect(mounted.container.textContent).toBe("unauthenticated:");
          expect(client.getQueryData(["private"])).toBeUndefined();
        }
        await act(async () => auth.completeOnboarding());
        expect(mounted.container.textContent).toContain(
          mode === "mock"
            ? "authenticated:farmer@example.test"
            : "unauthenticated:",
        );
      } finally {
        await mounted.unmount();
        client.clear();
      }
    },
  );

  it("shows session errors and cannot restore a session after unmount", async () => {
    vi.spyOn(ApiAuthClient.prototype, "session")
      .mockRejectedValueOnce(new Error("Offline"))
      .mockRejectedValueOnce("Unavailable");
    function Probe() {
      const auth = useAuth();
      return (
        <span>
          {auth.status}:{auth.error}
        </span>
      );
    }
    for (const message of [
      "Offline",
      "Could not check your sign-in session.",
    ]) {
      const client = createAppQueryClient();
      const mounted = await render(
        <AppProviders
          repository={new InMemoryEggcelerateRepository()}
          authApiBaseUrl="/api"
          queryClient={client}
        >
          <Probe />
        </AppProviders>,
      );
      try {
        await waitFor(
          () => mounted.container.textContent?.includes(message) ?? false,
        );
        expect(mounted.container.textContent).toContain("unauthenticated");
      } finally {
        await mounted.unmount();
        client.clear();
      }
    }
  });

  it("sends registration details and clears CSRF only after successful logout", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: identity }), {
        status: 200,
      }),
    );
    const client = new ApiAuthClient("/api", fetcher);
    await client.register(account);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      display_name: account.displayName,
      farm_name: account.farmName,
    });
    expect(getCsrfToken()).toBe(identity.csrf_token);
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }),
    );
    await client.signOut();
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({
      "X-CSRF-Token": identity.csrf_token,
    });
    expect(getCsrfToken()).toBeNull();
  });
});
