import React, { createContext, useContext, useEffect, useState } from "react";

import { apiFetch, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

export type User = { id: string; name: string; email: string; phone: string };

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
      if (token) {
        try {
          const me = await apiFetch<User>("/api/auth/me");
          setUser(me);
        } catch {
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (token: string, u: User) => {
    await storage.secureSet(TOKEN_KEY, token);
    setUser(u);
  };

  const signIn = async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await persist(data.token, data.user);
  };

  const signUp = async (name: string, email: string, phone: string, password: string) => {
    const data = await apiFetch<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, phone, password }),
    });
    await persist(data.token, data.user);
  };

  const signOut = async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
