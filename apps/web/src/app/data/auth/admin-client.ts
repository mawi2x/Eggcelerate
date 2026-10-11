import { z } from "zod";
import { normalizeBaseUrl } from "../repositories/api-repository";
import { appAuthApiBaseUrl } from "../repositories/app-repository";
import { getCsrfToken, notifySessionExpired } from "../transport/session";
import type { RegisterAccountInput } from "./api-auth-client";

const UserListSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      display_name: z.string(),
      farm_name: z.string(),
      administrator: z.boolean(),
      disabled: z.boolean(),
      created_at: z.string(),
    }),
  ),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

async function request(path: string, body?: Record<string, unknown>) {
  if (!appAuthApiBaseUrl)
    throw new Error("Administration requires the connected account server.");
  let response: Response;
  try {
    response = await fetch(
      `${normalizeBaseUrl(appAuthApiBaseUrl)}/api/v1/admin${path}`,
      {
        method: body ? "POST" : "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(body ? { "X-CSRF-Token": getCsrfToken() ?? "" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
  } catch {
    throw new Error("The account server is unreachable. Try again.");
  }
  const payload = await response.json().catch(() => null);
  if (response.status === 401) notifySessionExpired();
  if (!response.ok || payload?.ok !== true) {
    throw new Error(
      payload?.error?.message ?? "The account request could not be completed.",
    );
  }
  return payload.data as unknown;
}

export const adminClient = {
  session: async () =>
    z
      .object({ administrator: z.literal(true) })
      .parse(await request("/session")),
  users: async (offset: number) =>
    UserListSchema.parse(await request(`/users?offset=${offset}&limit=20`)),
  createUser: async (input: RegisterAccountInput) =>
    z.object({ id: z.string(), farm_id: z.string(), email: z.string() }).parse(
      await request("/users", {
        email: input.email,
        password: input.password,
        display_name: input.displayName,
        farm_name: input.farmName,
      }),
    ),
};
