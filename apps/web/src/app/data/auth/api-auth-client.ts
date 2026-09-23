import { z } from "zod";
import { normalizeBaseUrl } from "../repositories/api-repository";
import { getCsrfToken, setCsrfToken } from "../transport/session";

const IdentitySchema = z
  .object({
    authenticated: z.literal(true),
    user: z
      .object({
        id: z.string().min(1),
        email: z.string().email(),
        display_name: z.string().min(1),
        role: z.literal("owner"),
      })
      .strict(),
    farm: z.object({ id: z.string().min(1), name: z.string().min(1) }).strict(),
    csrf_token: z.string().min(32),
  })
  .strict();

const SessionSchema = z.union([
  z.object({ authenticated: z.literal(false) }).strict(),
  IdentitySchema,
]);

export type ApiAuthIdentity = z.infer<typeof IdentitySchema>;

export interface RegisterAccountInput {
  email: string;
  password: string;
  displayName: string;
  farmName: string;
}

interface AuthEnvelope<T> {
  ok: true;
  data: T;
}

export class ApiAuthClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    baseUrl: string,
    fetchImpl: typeof fetch = fetch.bind(globalThis),
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.fetchImpl = fetchImpl;
  }

  async session(): Promise<ApiAuthIdentity | null> {
    const data = await this.request("/session");
    const parsed = SessionSchema.parse(data);
    if (!parsed.authenticated) {
      setCsrfToken(null);
      return null;
    }
    setCsrfToken(parsed.csrf_token);
    return parsed;
  }

  async signIn(
    email: string,
    password: string,
    rememberMe: boolean,
  ): Promise<ApiAuthIdentity> {
    const data = await this.request("/login", {
      email,
      password,
      remember_me: rememberMe,
    });
    const identity = IdentitySchema.parse(data);
    setCsrfToken(identity.csrf_token);
    return identity;
  }

  async register(input: RegisterAccountInput): Promise<ApiAuthIdentity> {
    const data = await this.request("/register", {
      email: input.email,
      password: input.password,
      display_name: input.displayName,
      farm_name: input.farmName,
    });
    const identity = IdentitySchema.parse(data);
    setCsrfToken(identity.csrf_token);
    return identity;
  }

  async signOut(): Promise<void> {
    const csrfToken = getCsrfToken();
    await this.request("/logout", {}, csrfToken);
    setCsrfToken(null);
  }

  private async request(
    path: string,
    body?: Record<string, unknown>,
    csrfToken?: string | null,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/v1/auth${path}`, {
        method: body === undefined ? "GET" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error("The sign-in service is unreachable. Try again.");
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("The sign-in service returned an unreadable response.");
    }
    const error = z
      .object({
        ok: z.literal(false),
        error: z.object({ message: z.string().min(1) }).passthrough(),
      })
      .safeParse(payload);
    if (!response.ok || error.success) {
      if (error.success) throw new Error(error.data.error.message);
      throw new Error("The sign-in request could not be completed.");
    }
    const envelope = z
      .object({ ok: z.literal(true), data: z.unknown() })
      .safeParse(payload) as z.SafeParseReturnType<
      unknown,
      AuthEnvelope<unknown>
    >;
    if (!envelope.success) {
      throw new Error("The sign-in service returned an unexpected response.");
    }
    return envelope.data.data;
  }
}
