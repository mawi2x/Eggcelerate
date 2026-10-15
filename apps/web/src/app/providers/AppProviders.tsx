import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useMemo, useRef, useState } from "react";
import type { EggcelerateRepository } from "../data/repositories/repository";
import { InMemoryEggcelerateRepository } from "../data/repositories/in-memory-repository";
import { ApiAuthProvider, MockAuthProvider, useAuth } from "./auth-context";
import { RepositoryProvider } from "./repository-context";

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}

export function AppProviders({
  repository,
  children,
  queryClient: providedQueryClient,
  initiallyAuthenticated = true,
  authApiBaseUrl,
}: {
  repository: EggcelerateRepository;
  children: ReactNode;
  queryClient?: QueryClient;
  initiallyAuthenticated?: boolean;
  authApiBaseUrl?: string | null;
}) {
  const [queryClient] = useState(
    () => providedQueryClient ?? createAppQueryClient(),
  );

  return (
    <RepositoryProvider repository={repository}>
      <QueryClientProvider client={queryClient}>
        {authApiBaseUrl ? (
          <ApiAuthProvider baseUrl={authApiBaseUrl}>{children}</ApiAuthProvider>
        ) : (
          <MockAuthProvider
            initiallyAuthenticated={initiallyAuthenticated}
            queryClient={queryClient}
          >
            <DemoFarmScope fallback={repository}>{children}</DemoFarmScope>
          </MockAuthProvider>
        )}
      </QueryClientProvider>
    </RepositoryProvider>
  );
}

function DemoFarmScope({
  fallback,
  children,
}: {
  fallback: EggcelerateRepository;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const farms = useRef(new Map<string, EggcelerateRepository>());
  const repository = useMemo(() => {
    if (!user?.id.startsWith("demo-owner-")) return fallback;
    let farm = farms.current.get(user.id);
    if (!farm) {
      farm = new InMemoryEggcelerateRepository({
        fixtureSet: "demo",
        emptyFarm: true,
        latencyMs: 350,
        account: {
          farmName: user.farmName,
          accountHolder: user.displayName,
          displayName: user.displayName,
        },
      });
      farms.current.set(user.id, farm);
    }
    return farm;
  }, [fallback, user]);
  return (
    <RepositoryProvider repository={repository}>{children}</RepositoryProvider>
  );
}
