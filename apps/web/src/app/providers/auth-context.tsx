import { useQueryClient } from "@tanstack/react-query";
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

export function MockAuthProvider({
  children,
  initiallyAuthenticated = true,
}: {
  children: ReactNode;
  initiallyAuthenticated?: boolean;
}) {
  const [user, setUser] = useState<AuthUser | null>(
    initiallyAuthenticated ? mockUser : null,
  );
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      mode: "mock",
      registrationEnabled: true,
      status: user ? "authenticated" : "unauthenticated",
      isLoading: false,
      isAuthenticated: user !== null,
      error: null,
      signIn: async (email) => setUser({ ...mockUser, email, role: "farmer" }),
      register: async (input) =>
        setUser({
          id: "mock-farmer",
          email: input.email,
          displayName: input.displayName,
          farmName: input.farmName,
          role: "farmer",
        }),
      completeOnboarding: () => setUser(mockUser),
      signOut: async () => setUser(null),
    }),
    [user],
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
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    const expireSession = () => {
      setCsrfToken(null);
      queryClient.clear();
      setUser(null);
      setStatus("unauthenticated");
      setError("Your session has ended. Sign in again to continue.");
    };
    window.addEventListener("eggcelerate:session-expired", expireSession);
    void client
      .session()
      .then(({ identity, registrationEnabled: canRegister }) => {
        if (!active) return;
        setUser(identity ? userFromApi(identity) : null);
        setRegistrationEnabled(canRegister);
        setStatus(identity ? "authenticated" : "unauthenticated");
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
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
      window.removeEventListener("eggcelerate:session-expired", expireSession);
    };
  }, [client, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      mode: "api",
      registrationEnabled,
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
      register: async (input) => {
        const identity = await client.register(input);
        queryClient.clear();
        setUser(userFromApi(identity));
        setStatus("authenticated");
        setError(null);
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
    [client, error, queryClient, registrationEnabled, status, user],
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
