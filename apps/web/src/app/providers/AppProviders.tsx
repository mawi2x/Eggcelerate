import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import type { EggcelerateRepository } from "../data/repositories/repository";
import { ApiAuthProvider, MockAuthProvider } from "./auth-context";
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
            {children}
          </MockAuthProvider>
        )}
      </QueryClientProvider>
    </RepositoryProvider>
  );
}
