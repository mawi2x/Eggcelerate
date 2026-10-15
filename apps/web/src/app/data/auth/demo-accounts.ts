import { z } from "zod";
import type { UpdateUserInput } from "./admin-client";
import type { RegisterAccountInput } from "./api-auth-client";

export const DEMO_ADMIN_EMAIL = "admin@eggcelerate.demo";
export const DEMO_ADMIN_PASSWORD = "eggcelerate_admin";
export const DEMO_FARMER_EMAIL = "farmer@example.test";
export const DEMO_FARMER_PASSWORD = "DemoFarmer123!";
const ACCOUNTS_KEY = "eggcelerate.demo.accounts.v1";
const SAMPLE_DELETED_KEY = "eggcelerate.demo.sample-deleted.v1";
const SESSION_KEY = "eggcelerate.demo.session.v1";
const AccountSchema = z.object({
  id: z.string(),
  email: z.string(),
  display_name: z.string(),
  farm_name: z.string(),
  administrator: z.boolean(),
  disabled: z.boolean(),
  created_at: z.string(),
  salt: z.string(),
  passwordHash: z.string(),
});
type DemoAccount = z.infer<typeof AccountSchema>;
export type DemoIdentity = Omit<DemoAccount, "salt" | "passwordHash">;
const admin: DemoIdentity = {
  id: "demo-admin",
  email: DEMO_ADMIN_EMAIL,
  display_name: "Demo Administrator",
  farm_name: "Demo Administration",
  administrator: true,
  disabled: false,
  created_at: "2026-10-15T00:00:00Z",
};
const sampleFarmer: DemoIdentity = {
  id: "mock-farmer",
  email: DEMO_FARMER_EMAIL,
  display_name: "Farmer Juan",
  farm_name: "Sunrise Poultry",
  administrator: false,
  disabled: false,
  created_at: "2026-10-15T00:00:00Z",
};
function accounts(): DemoAccount[] {
  const raw = localStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  const parsed = z.array(AccountSchema).safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("Demo account data could not be read.");
  return parsed.data;
}
function publicIdentity({
  salt: _salt,
  passwordHash: _hash,
  ...identity
}: DemoAccount): DemoIdentity {
  return identity;
}
async function hash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function savedDemoSession(): DemoIdentity | null | undefined {
  const id = sessionStorage.getItem(SESSION_KEY);
  if (id === null) {
    if (localStorage.getItem(SAMPLE_DELETED_KEY)) return null;
    const savedSample = accounts().find(
      (entry) => entry.id === sampleFarmer.id,
    );
    return savedSample ? publicIdentity(savedSample) : undefined;
  }
  if (id === admin.id) return admin;

  if (!id) return null;
  const account = accounts().find(
    (entry) => entry.id === id && !entry.disabled,
  );
  return account
    ? publicIdentity(account)
    : id === sampleFarmer.id && !localStorage.getItem(SAMPLE_DELETED_KEY)
      ? sampleFarmer
      : null;
}
export function clearDemoSession() {
  sessionStorage.setItem(SESSION_KEY, "");
}
export async function signInDemo(
  email: string,
  password: string,
): Promise<DemoIdentity> {
  const normalized = email.trim().toLowerCase();
  let identity: DemoIdentity;
  if (normalized === DEMO_ADMIN_EMAIL && password === DEMO_ADMIN_PASSWORD)
    identity = admin;
  else {
    const account = accounts().find(
      (entry) => entry.email === normalized && !entry.disabled,
    );
    if (
      account &&
      (await hash(password, account.salt)) === account.passwordHash
    )
      identity = publicIdentity(account);
    else if (
      !accounts().some((entry) => entry.id === sampleFarmer.id) &&
      !localStorage.getItem(SAMPLE_DELETED_KEY) &&
      normalized === DEMO_FARMER_EMAIL &&
      password === DEMO_FARMER_PASSWORD
    )
      identity = sampleFarmer;
    else
      throw new Error(
        "Email or password is incorrect. Use an account created by the demo administrator.",
      );
  }
  sessionStorage.setItem(SESSION_KEY, identity.id);
  return identity;
}
function requireAdmin() {
  if (!savedDemoSession()?.administrator)
    throw new Error("Sign in with the demo administrator account.");
}
export const demoAdminClient = {
  updateUser: async (id: string, input: UpdateUserInput) => {
    requireAdmin();
    if (id === admin.id)
      throw new Error("The demo administrator account cannot be edited.");
    const email = input.email.trim().toLowerCase();
    let target = accounts().find((entry) => entry.id === id);
    if (
      !target &&
      id === sampleFarmer.id &&
      !localStorage.getItem(SAMPLE_DELETED_KEY)
    ) {
      const salt = crypto.randomUUID();
      target = {
        ...sampleFarmer,
        salt,
        passwordHash: await hash(DEMO_FARMER_PASSWORD, salt),
      };
    }
    if (!target) throw new Error("This user no longer exists.");
    const current = accounts();
    if (
      email === DEMO_ADMIN_EMAIL ||
      current.some((entry) => entry.id !== id && entry.email === email) ||
      (id !== sampleFarmer.id &&
        email === DEMO_FARMER_EMAIL &&
        !localStorage.getItem(SAMPLE_DELETED_KEY) &&
        !current.some((entry) => entry.id === sampleFarmer.id))
    )
      throw new Error("An account with this email already exists.");
    const salt = input.password ? crypto.randomUUID() : target.salt;
    const updated = {
      ...target,
      email,
      display_name: input.displayName,
      farm_name: input.farmName,
      salt,
      passwordHash: input.password
        ? await hash(input.password, salt)
        : target.passwordHash,
    };
    const latest = accounts();
    if (
      !latest.some((entry) => entry.id === id) &&
      !(id === sampleFarmer.id && !localStorage.getItem(SAMPLE_DELETED_KEY))
    )
      throw new Error("This user no longer exists.");
    requireAdmin();
    if (latest.some((entry) => entry.id !== id && entry.email === email))
      throw new Error("An account with this email already exists.");
    localStorage.setItem(
      ACCOUNTS_KEY,
      JSON.stringify([...latest.filter((entry) => entry.id !== id), updated]),
    );
    return { id, email };
  },
  deleteUser: async (id: string) => {
    requireAdmin();
    if (id === admin.id)
      throw new Error("The demo administrator account cannot be deleted.");
    const current = accounts();
    if (
      !current.some((entry) => entry.id === id) &&
      !(id === sampleFarmer.id && !localStorage.getItem(SAMPLE_DELETED_KEY))
    )
      throw new Error("This user no longer exists.");
    if (id === sampleFarmer.id)
      localStorage.setItem(SAMPLE_DELETED_KEY, "true");
    localStorage.setItem(
      ACCOUNTS_KEY,
      JSON.stringify(current.filter((entry) => entry.id !== id)),
    );
    return { id };
  },
  session: async () => {
    requireAdmin();
    return { administrator: true as const };
  },
  users: async (offset: number) => {
    requireAdmin();
    const stored = accounts();
    const sample =
      !localStorage.getItem(SAMPLE_DELETED_KEY) &&
      !stored.some((entry) => entry.id === sampleFarmer.id)
        ? [sampleFarmer]
        : [];
    const users = [admin, ...sample, ...stored.map(publicIdentity)];
    return {
      users: users.slice(offset, offset + 20),
      total: users.length,
      offset,
      limit: 20,
    };
  },
  createUser: async (input: RegisterAccountInput) => {
    requireAdmin();
    const email = input.email.trim().toLowerCase();
    if (
      email === DEMO_ADMIN_EMAIL ||
      (email === DEMO_FARMER_EMAIL &&
        !localStorage.getItem(SAMPLE_DELETED_KEY) &&
        !accounts().some((entry) => entry.id === sampleFarmer.id)) ||
      accounts().some((entry) => entry.email === email)
    )
      throw new Error("An account with this email already exists.");
    const salt = crypto.randomUUID();
    const account: DemoAccount = {
      id: `demo-owner-${crypto.randomUUID()}`,
      email,
      display_name: input.displayName,
      farm_name: input.farmName,
      administrator: false,
      disabled: false,
      created_at: new Date().toISOString(),
      salt,
      passwordHash: await hash(input.password, salt),
    };
    // Re-read after hashing so concurrent creates cannot overwrite one another.
    const current = accounts();
    if (current.some((entry) => entry.email === email))
      throw new Error("An account with this email already exists.");
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...current, account]));
    return { id: account.id, farm_id: account.id, email };
  },
};
