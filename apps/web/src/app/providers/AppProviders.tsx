import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EggcelerateRepository } from "../data/repositories/repository";
import { MockAuthProvider } from "./auth-context";
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
}: {
  repository: EggcelerateRepository;
  children: ReactNode;
  queryClient?: QueryClient;
  initiallyAuthenticated?: boolean;
}) {
  const [queryClient] = useState(() => providedQueryClient ?? createAppQueryClient());

  return (
    <MockAuthProvider initiallyAuthenticated={initiallyAuthenticated}>
      <RepositoryProvider repository={repository}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </RepositoryProvider>
    </MockAuthProvider>
  );
}
