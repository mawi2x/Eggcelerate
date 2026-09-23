import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiAuthClient } from "../app/data/auth/api-auth-client";
import { getCsrfToken, setCsrfToken } from "../app/data/transport/session";

const identity = {
  authenticated: true as const,
  user: {
    id: "user-1",
    email: "farmer@example.com",
    display_name: "A. Farmer",
    role: "owner" as const,
  },
  farm: { id: "farm-1", name: "Sunrise Farm" },
  csrf_token: "x".repeat(43),
};

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

afterEach(() => setCsrfToken(null));

describe("ApiAuthClient", () => {
  it("hydrates the operator-controlled registration switch", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        ok: true,
        data: { authenticated: false, registration_enabled: false },
      }),
    );
    const client = new ApiAuthClient("/api", fetchImpl);

    await expect(client.session()).resolves.toEqual({
      identity: null,
      registrationEnabled: false,
    });
  });

  it("uses cookie credentials and carries CSRF into logout", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ ok: true, data: identity }))
      .mockResolvedValueOnce(
        response({
          ok: true,
          data: { authenticated: false, registration_enabled: false },
        }),
      );
    const client = new ApiAuthClient("/api", fetchImpl);

    await expect(
      client.signIn("farmer@example.com", "secret-password", true),
    ).resolves.toMatchObject({ user: identity.user, farm: identity.farm });
    expect(getCsrfToken()).toBe(identity.csrf_token);
    expect(fetchImpl.mock.calls[0][0]).toBe("/api/v1/auth/login");
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({
        email: "farmer@example.com",
        password: "secret-password",
        remember_me: true,
      }),
    });

    await client.signOut();
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: {
        "X-CSRF-Token": identity.csrf_token,
      },
    });
    expect(getCsrfToken()).toBeNull();
  });

  it("surfaces the API error message for rejected credentials", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response(
        {
          ok: false,
          error: {
            code: "unauthorized",
            message: "Email or password is incorrect.",
          },
        },
        401,
      ),
    );
    const client = new ApiAuthClient("https://farm.example/api", fetchImpl);

    await expect(
      client.signIn("farmer@example.com", "wrong-password", false),
    ).rejects.toThrow("Email or password is incorrect.");
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://farm.example/api/v1/auth/login",
    );
  });
});
