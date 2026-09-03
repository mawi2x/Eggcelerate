import { InMemoryEggcelerateRepository } from "./in-memory-repository";

export const appRepository = new InMemoryEggcelerateRepository({ latencyMs: 350 });
