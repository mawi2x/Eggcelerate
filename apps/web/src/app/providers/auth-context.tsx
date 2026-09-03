import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Redirect } from "wouter";

export interface MockAuthUser {
  id: string;
  role: "farmer";
}

interface AuthContextValue {
  user: MockAuthUser | null;
  isAuthenticated: boolean;
  signIn: () => void;
  completeOnboarding: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function MockAuthProvider({
  children,
  initiallyAuthenticated = true,
}: {
  children: ReactNode;
  initiallyAuthenticated?: boolean;
}) {
  const [user, setUser] = useState<MockAuthUser | null>(
    initiallyAuthenticated ? { id: "mock-farmer", role: "farmer" } : null,
  );
  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: user !== null,
    signIn: () => setUser({ id: "mock-farmer", role: "farmer" }),
    completeOnboarding: () => setUser({ id: "mock-farmer", role: "farmer" }),
    signOut: () => setUser(null),
  }), [user]);

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
