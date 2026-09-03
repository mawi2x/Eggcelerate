import { createContext, useContext, type ReactNode } from "react";
import type { EggcelerateRepository } from "../data/repositories/repository";

const RepositoryContext = createContext<EggcelerateRepository | null>(null);

export function RepositoryProvider({
  repository,
  children,
}: {
  repository: EggcelerateRepository;
  children: ReactNode;
}) {
  return (
    <RepositoryContext.Provider value={repository}>
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepository(): EggcelerateRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) {
    throw new Error("useRepository must be used within AppProviders.");
  }
  return repository;
}
