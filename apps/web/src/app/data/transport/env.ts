import { z } from "zod";

export type DataSource = "mock" | "api";

const EnvSchema = z.object({
  VITE_DATA_SOURCE: z.enum(["mock", "api"]).default("mock"),
  VITE_API_URL: z.string().optional(),
});

export interface ResolvedDataSource {
  source: DataSource;
  apiUrl: string | null;
}

export function resolveDataSource(
  env: Record<string, string | undefined>,
): ResolvedDataSource {
  const parsed = EnvSchema.parse({
    VITE_DATA_SOURCE: env.VITE_DATA_SOURCE,
    VITE_API_URL: env.VITE_API_URL,
  });
  if (parsed.VITE_DATA_SOURCE === "mock") {
    return { source: "mock", apiUrl: null };
  }
  const raw = (parsed.VITE_API_URL ?? "").replace(/\/+$/, "");
  let protocol: string;
  try {
    protocol = new URL(raw).protocol;
  } catch {
    throw new Error(
      "VITE_API_URL must be an http(s) URL when VITE_DATA_SOURCE=api.",
    );
  }
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(
      "VITE_API_URL must be an http(s) URL when VITE_DATA_SOURCE=api.",
    );
  }
  return { source: "api", apiUrl: raw };
}
