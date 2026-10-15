import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Redirect } from "wouter";
import {
  ApiAuthClient,
  type ApiAuthIdentity,
  type RegisterAccountInput,
} from "../data/auth/api-auth-client";
import {
  clearDemoSession,
  savedDemoSession,
  signInDemo,
  type DemoIdentity,
} from "../data/auth/demo-accounts";
import { setCsrfToken } from "../data/transport/session";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  farmName: string;
  role: "owner" | "farmer";
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  mode: "mock" | "api";
  registrationEnabled: boolean;
  status: AuthStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<void>;
  register: (input: RegisterAccountInput) => Promise<void>;
  completeOnboarding: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const mockUser: AuthUser = {
  id: "mock-farmer",
  email: "farmer@example.test",
  displayName: "Farmer Juan",
  farmName: "Sunrise Poultry",
  role: "farmer",
};

function userFromApi(identity: ApiAuthIdentity): AuthUser {
  return {
    id: identity.user.id,
    email: identity.user.email,
    displayName: identity.user.display_name,
    farmName: identity.farm.name,
    role: identity.user.role,
  };
}

function userFromDemo(identity: DemoIdentity): AuthUser {
  return {
    id: identity.id,
    email: identity.email,
    displayName: identity.display_name,
    farmName: identity.farm_name,
    role: "owner",
  };
}

export function MockAuthProvider({
  children,
  initiallyAuthenticated = true,
  queryClient,
}: {
  children: ReactNode;
  initiallyAuthenticated?: boolean;
  queryClient?: QueryClient;
}) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = savedDemoSession();
    return saved
      ? userFromDemo(saved)
      : saved === null
        ? null
        : initiallyAuthenticated
          ? mockUser
          : null;
  });
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      mode: "mock",
      registrationEnabled: false,
      status: user ? "authenticated" : "unauthenticated",
      isLoading: false,
      isAuthenticated: user !== null,
      error: null,
      signIn: async (email, password) => {
        const identity = await signInDemo(email, password);
        queryClient?.clear();
        setUser(userFromDemo(identity));
      },
      register: async () => {
        throw new Error("Accounts are provided by your administrator.");
      },
      completeOnboarding: () => setUser(mockUser),
      signOut: async () => {
        clearDemoSession();
        queryClient?.clear();
        setUser(null);
      },
    }),
    [queryClient, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function ApiAuthProvider({
  baseUrl,
  children,
}: {
  baseUrl: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const client = useMemo(() => new ApiAuthClient(baseUrl), [baseUrl]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionCheck = new AbortController();
    let active = true;
    let expired = false;
    const expireSession = () => {
      expired = true;
      sessionCheck.abort();
      setCsrfToken(null);
      queryClient.clear();
      setUser(null);
      setStatus("unauthenticated");
      setError("Your session has ended. Sign in again to continue.");
    };
    window.addEventListener("eggcelerate:session-expired", expireSession);
    void client
      .session(sessionCheck.signal)
      .then(({ identity }) => {
        if (!active || expired) return;
        setUser(identity ? userFromApi(identity) : null);
        setStatus(identity ? "authenticated" : "unauthenticated");
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active || expired) return;
        setCsrfToken(null);
        setUser(null);
        setStatus("unauthenticated");
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not check your sign-in session.",
        );
      });
    return () => {
      active = false;
      sessionCheck.abort();
      window.removeEventListener("eggcelerate:session-expired", expireSession);
    };
  }, [client, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      mode: "api",
      registrationEnabled: false,
      status,
      isLoading: status === "loading",
      isAuthenticated: status === "authenticated" && user !== null,
      error,
      signIn: async (email, password, rememberMe = false) => {
        const identity = await client.signIn(email, password, rememberMe);
        queryClient.clear();
        setUser(userFromApi(identity));
        setStatus("authenticated");
        setError(null);
      },
      register: async () => {
        throw new Error("Accounts are provided by your administrator.");
      },
      completeOnboarding: () => undefined,
      signOut: async () => {
        await client.signOut();
        queryClient.clear();
        setUser(null);
        setStatus("unauthenticated");
        setError(null);
      },
    }),
    [client, error, queryClient, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used within AppProviders.");
  return auth;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Redirect to="/login" replace />;
}
