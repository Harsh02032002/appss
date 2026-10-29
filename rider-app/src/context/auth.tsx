import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { apiFetch, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import type { Rider } from "@/src/types";

type AuthContextType = {
  rider: Rider | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setRider: (patch: Partial<Rider>) => void;
};

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [rider, setRiderState] = useState<Rider | null>(null);
  const [loading, setLoading] = useState(true);

  const restore = useCallback(async () => {
    try {
      const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
      if (!token) return;
      setRiderState(await apiFetch<Rider>("/api/rider/auth/me"));
    } catch {
      await storage.secureRemove(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  const signIn = async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; rider: Rider }>("/api/rider/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.toLowerCase(), password }),
    });
    await storage.secureSet(TOKEN_KEY, data.token);
    setRiderState(data.rider);
  };

  const signOut = async () => {
    await storage.secureRemove(TOKEN_KEY);
    setRiderState(null);
  };

  const setRider = (patch: Partial<Rider>) => setRiderState((r) => (r ? { ...r, ...patch } : r));

  return <AuthContext.Provider value={{ rider, loading, signIn, signOut, setRider }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
