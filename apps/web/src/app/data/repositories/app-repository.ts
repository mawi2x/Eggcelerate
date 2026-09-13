import { resolveDataSource } from "../transport/env";
import { ApiRepository } from "./api-repository";
import { InMemoryEggcelerateRepository } from "./in-memory-repository";
import type { EggcelerateRepository } from "./repository";

const resolved = resolveDataSource({
  VITE_DATA_SOURCE: import.meta.env.VITE_DATA_SOURCE,
  VITE_API_URL: import.meta.env.VITE_API_URL,
});

export const appRepository: EggcelerateRepository =
  resolved.source === "api" && resolved.apiUrl !== null
    ? new ApiRepository({ baseUrl: resolved.apiUrl })
    : new InMemoryEggcelerateRepository({ latencyMs: 350 });
