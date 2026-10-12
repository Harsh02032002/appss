import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "expo-router";

import { apiFetch } from "@/src/api/client";
import { showToast } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";

type FavoritesContextType = {
  ids: string[];
  isFavorite: (restaurantId: string) => boolean;
  toggle: (restaurantId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextType>(null!);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!user) {
      setIds([]);
      return;
    }
    try {
      const data = await apiFetch<{ ids: string[] }>("/api/favorites");
      setIds(data.ids);
    } catch {
      // keep stale
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isFavorite = (restaurantId: string) => ids.includes(restaurantId);

  const toggle = async (restaurantId: string) => {
    if (!user) {
      showToast("Log in to save favourites", "info");
      router.push("/login");
      return;
    }
    const wasFav = ids.includes(restaurantId);
    setIds((prev) => (wasFav ? prev.filter((i) => i !== restaurantId) : [restaurantId, ...prev]));
    try {
      const res = await apiFetch<{ favorited: boolean }>(`/api/favorites/${restaurantId}`, { method: "POST" });
      showToast(res.favorited ? "Added to favourites" : "Removed from favourites", "success");
    } catch (e: any) {
      setIds((prev) => (wasFav ? [restaurantId, ...prev] : prev.filter((i) => i !== restaurantId)));
      showToast(e.message || "Could not update favourites", "error");
    }
  };

  return (
    <FavoritesContext.Provider value={{ ids, isFavorite, toggle, refresh }}>{children}</FavoritesContext.Provider>
  );
}

export const useFavorites = () => useContext(FavoritesContext);
