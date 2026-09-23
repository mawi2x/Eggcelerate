import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import { getCsrfToken } from "../app/data/transport/session";
import {
  AppProviders,
  createAppQueryClient,
} from "../app/providers/AppProviders";
import { useAuth } from "../app/providers/auth-context";
import { render, waitFor } from "./render";

const identity = {
  authenticated: true,
  user: {
    id: "user-1",
    email: "farmer@example.com",
    display_name: "A. Farmer",
    role: "owner",
  },
  farm: { id: "farm-1", name: "Sunrise Farm" },
  csrf_token: "c".repeat(43),
};

describe("API auth state", () => {
  it("hydrates cookie sessions and clears private cache on expiry", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: identity }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(["private-farm-data"], ["secret"]);
    const mounted = await render(
      <AppProviders
        repository={new InMemoryEggcelerateRepository()}
        authApiBaseUrl="/api"
        queryClient={queryClient}
      >
        <AuthStatus />
      </AppProviders>,
    );
    try {
      await waitFor(
        () => mounted.container.textContent?.includes("authenticated") ?? false,
      );
      expect(getCsrfToken()).toBe(identity.csrf_token);
      expect(fetchMock.mock.calls[0][1]).toMatchObject({
        method: "GET",
        credentials: "include",
      });
      expect(queryClient.getQueryData(["private-farm-data"])).toEqual([
        "secret",
      ]);

      await act(async () => {
        window.dispatchEvent(new Event("eggcelerate:session-expired"));
      });
      await waitFor(
        () =>
          mounted.container.textContent?.includes("unauthenticated") ?? false,
      );
      expect(getCsrfToken()).toBeNull();
      expect(queryClient.getQueryCache().getAll()).toEqual([]);
    } finally {
      await mounted.unmount();
      vi.unstubAllGlobals();
    }
  });
});

function AuthStatus() {
  const { status } = useAuth();
  return <span>{status}</span>;
}
