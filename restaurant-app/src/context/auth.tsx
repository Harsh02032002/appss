import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { apiFetch, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import type { Partner } from "@/src/types";

type AuthContextType = {
  partner: Partner | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setRestaurant: (patch: Partial<Partner["restaurant"]>) => void;
};

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
      if (!token) {
        setPartner(null);
        return;
      }
      setPartner(await apiFetch<Partner>("/api/partner/auth/me"));
    } catch {
      await storage.secureRemove(TOKEN_KEY);
      setPartner(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; partner: Partner }>("/api/partner/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.toLowerCase(), password }),
    });
    await storage.secureSet(TOKEN_KEY, data.token);
    setPartner(data.partner);
  };

  const signOut = async () => {
    await storage.secureRemove(TOKEN_KEY);
    setPartner(null);
  };

  const setRestaurant = (patch: Partial<Partner["restaurant"]>) =>
    setPartner((p) => (p ? { ...p, restaurant: { ...p.restaurant, ...patch } } : p));

  return (
    <AuthContext.Provider value={{ partner, loading, signIn, signOut, refresh, setRestaurant }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
