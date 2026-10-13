import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { apiFetch, getToken, wsUrl } from "@/src/api/client";
import { showToast } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import type { Order, Rider } from "@/src/types";

type FeedContextType = {
  orders: Order[];
  loading: boolean;
  connected: boolean;
  refresh: () => Promise<void>;
  upsert: (order: Order) => void;
  riders: Rider[];
  refreshRiders: () => Promise<void>;
  act: (order: Order, action: "accept" | "reject" | "preparing" | "ready" | "assign", payload?: any) => Promise<Order | null>;
};

const FeedContext = createContext<FeedContextType>(null!);

/** Keeps every order for the restaurant (active + past) in memory, kept fresh by the partner WebSocket. */
export function OrdersFeedProvider({ children }: { children: React.ReactNode }) {
  const { partner } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const upsert = useCallback((order: Order) => {
    setOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === order.id);
      if (idx === -1) return [order, ...prev];
      const next = [...prev];
      next[idx] = order;
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!partner) return;
    try {
      const data = await apiFetch<{ orders: Order[] }>("/api/partner/orders?scope=all");
      setOrders(data.orders);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, [partner]);

  const refreshRiders = useCallback(async () => {
    if (!partner) return;
    try {
      const data = await apiFetch<{ riders: Rider[] }>("/api/partner/riders");
      setRiders(data.riders);
    } catch {}
  }, [partner]);

  useEffect(() => {
    refresh();
    refreshRiders();
  }, [refresh, refreshRiders]);

  // WebSocket live feed with reconnect
  useEffect(() => {
    if (!partner) return;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (closed) return;
      const token = await getToken();
      const ws = new WebSocket(wsUrl(`/api/partner/ws?token=${encodeURIComponent(token ?? "")}`));
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "order_new") {
            upsert(msg.order);
            showToast(`New order from ${msg.order.customer?.name ?? "a customer"} · ₹${Math.round(msg.order.amounts.total / 100)}`, "success");
          } else if (msg.type === "order_update") {
            upsert(msg.order);
            if (msg.order.status === "DELIVERED") refreshRiders();
          }
        } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 4000);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [partner, upsert, refreshRiders]);

  const act: FeedContextType["act"] = async (order, action, payload) => {
    const path =
      action === "accept"
        ? `/api/partner/orders/${order.id}/accept`
        : action === "reject"
          ? `/api/partner/orders/${order.id}/reject`
          : action === "assign"
            ? `/api/partner/orders/${order.id}/assign-rider`
            : `/api/partner/orders/${order.id}/status`;
    const body =
      action === "reject"
        ? { reason: payload?.reason || "Restaurant unable to fulfil" }
        : action === "assign"
          ? { rider_id: payload.rider_id }
          : action === "preparing"
            ? { status: "PREPARING" }
            : action === "ready"
              ? { status: "READY" }
              : undefined;
    try {
      const updated = await apiFetch<Order>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      upsert(updated);
      if (action === "assign") refreshRiders();
      const msg: Record<string, string> = {
        accept: "Order accepted",
        reject: "Order rejected",
        preparing: "Marked as preparing",
        ready: "Marked ready for pickup",
        assign: "Rider assigned",
      };
      showToast(msg[action], "success");
      return updated;
    } catch (e: any) {
      showToast(e.message || "Action failed", "error");
      return null;
    }
  };

  return (
    <FeedContext.Provider value={{ orders, loading, connected, refresh, upsert, riders, refreshRiders, act }}>
      {children}
    </FeedContext.Provider>
  );
}

export const useOrdersFeed = () => useContext(FeedContext);
