import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import * as Location from "expo-location";

import { apiFetch, getToken, wsUrl } from "@/src/api/client";
import { showToast } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import type { Dashboard, Order } from "@/src/types";

export type LocationState = "idle" | "requesting" | "granted" | "denied" | "blocked" | "error";

type RiderContextType = {
  dashboard: Dashboard | null;
  requests: Order[];
  assigned: Order[];
  activeOrder: Order | null;
  loading: boolean;
  connected: boolean;
  position: { lat: number; lng: number; heading: number | null } | null;
  locationState: LocationState;
  refresh: () => Promise<void>;
  setOnline: (online: boolean) => Promise<void>;
  act: (orderId: string, action: "accept" | "reject" | "pickup" | "deliver") => Promise<Order | null>;
  requestLocation: () => Promise<boolean>;
  openSettings: () => void;
};

const RiderContext = createContext<RiderContextType>(null!);

export function RiderProvider({ children }: { children: React.ReactNode }) {
  const { rider, setRider } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [requests, setRequests] = useState<Order[]>([]);
  const [assigned, setAssigned] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [position, setPosition] = useState<RiderContextType["position"]>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentRef = useRef(0);
  const positionRef = useRef<RiderContextType["position"]>(null);

  const activeOrder = dashboard?.active_order ?? null;

  const refresh = useCallback(async () => {
    if (!rider) return;
    try {
      const [d, r] = await Promise.all([
        apiFetch<Dashboard>("/api/rider/dashboard"),
        apiFetch<{ requests: Order[]; assigned: Order[] }>("/api/rider/requests"),
      ]);
      setDashboard(d);
      setRequests(r.requests);
      setAssigned(r.assigned);
      setRider({ online: d.rider.online, status: d.rider.status });
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ---- Live feed (WebSocket) ----
  const riderId = rider?.id;
  useEffect(() => {
    if (!riderId) return;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;
    const connect = async () => {
      if (closed) return;
      const token = await getToken();
      ws = new WebSocket(wsUrl(`/api/rider/ws?token=${encodeURIComponent(token ?? "")}`));
      ws.onopen = () => {
        setConnected(true);
        refresh();
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "request_new") {
            setRequests((prev) => (prev.some((o) => o.id === msg.order.id) ? prev.map((o) => (o.id === msg.order.id ? { ...o, ...msg.order } : o)) : [...prev, msg.order]));
          } else if (msg.type === "request_taken") {
            setRequests((prev) => prev.filter((o) => o.id !== msg.order_id));
          } else if (msg.type === "payout") {
            showToast(`Payout received: ₹${Math.round(msg.amount / 100)} for ${msg.deliveries} deliveries`, "success");
            refresh();
          } else if (msg.type === "order_update") {
            const o: Order = msg.order;
            if (o.rider?.id === riderId) {
              if (["DELIVERED", "CANCELLED"].includes(o.status)) {
                if (o.status === "CANCELLED") showToast("Order was cancelled", "info");
                refresh();
              } else {
                setDashboard((d) => (d ? { ...d, active_order: o } : d));
                setAssigned((prev) => (prev.some((x) => x.id === o.id) ? prev.map((x) => (x.id === o.id ? o : x)) : [...prev, o]));
                if (o.status === "READY") showToast(`${o.restaurant.name}: order is ready for pickup`, "success");
              }
            }
          }
        } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 4000);
      };
      ws.onerror = () => ws?.close();
    };
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [riderId, refresh]);

  // ---- Real GPS: watch position while online, stream to backend (throttled) ----
  const sendLocation = useCallback(async (lat: number, lng: number, heading: number | null, force = false) => {
    const now = Date.now();
    if (!force && now - lastSentRef.current < 4000) return;
    lastSentRef.current = now;
    try {
      await apiFetch("/api/rider/location", { method: "POST", body: JSON.stringify({ lat, lng, heading }) });
    } catch {}
  }, []);

  const stopWatch = () => {
    watchRef.current?.remove();
    watchRef.current = null;
  };

  const requestLocation = useCallback(async (): Promise<boolean> => {
    setLocationState("requesting");
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let status = current.status;
      if (status !== "granted") {
        if (!current.canAskAgain && Platform.OS !== "web") {
          setLocationState("blocked");
          return false;
        }
        status = (await Location.requestForegroundPermissionsAsync()).status;
      }
      if (status !== "granted") {
        setLocationState(Platform.OS === "web" ? "denied" : (await Location.getForegroundPermissionsAsync()).canAskAgain ? "denied" : "blocked");
        return false;
      }
      setLocationState("granted");
      return true;
    } catch {
      setLocationState("error");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!rider?.online) {
      stopWatch();
      return;
    }
    let cancelled = false;
    (async () => {
      const ok = await requestLocation();
      if (!ok || cancelled) return;
      try {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 10 },
          (loc) => {
            const p = { lat: loc.coords.latitude, lng: loc.coords.longitude, heading: loc.coords.heading ?? null };
            setPosition(p);
            positionRef.current = p;
            sendLocation(p.lat, p.lng, p.heading);
          },
        );
        if (cancelled) sub.remove();
        else watchRef.current = sub;
      } catch {
        setLocationState("error");
      }
    })();
    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [rider?.online, requestLocation, sendLocation]);

  // Heartbeat: a stationary rider still re-sends his last fix so the customer keeps a position + ETA
  useEffect(() => {
    if (!rider?.online) return;
    const t = setInterval(() => {
      const p = positionRef.current;
      if (p) sendLocation(p.lat, p.lng, p.heading, true);
    }, 12000);
    return () => clearInterval(t);
  }, [rider?.online, sendLocation]);

  const setOnline = async (online: boolean) => {
    if (online) {
      const ok = await requestLocation();
      if (!ok) {
        showToast("Location access is needed to go online", "error");
        return;
      }
    }
    try {
      const r = await apiFetch<{ online: boolean }>("/api/rider/status", { method: "PATCH", body: JSON.stringify({ online }) });
      setRider({ online: r.online });
      setDashboard((d) => (d ? { ...d, rider: { ...d.rider, online: r.online } } : d));
      showToast(r.online ? "You're online · ready for deliveries" : "You're offline", r.online ? "success" : "info");
    } catch (e: any) {
      showToast(e.message || "Could not update status", "error");
    }
  };

  const act: RiderContextType["act"] = async (orderId, action) => {
    try {
      const o = await apiFetch<Order>(`/api/rider/orders/${orderId}/${action}`, { method: "POST" });
      const msg = { accept: "Delivery accepted", reject: "Delivery declined", pickup: "Order picked up", deliver: "Delivered · great job!" }[action];
      showToast(msg, "success");
      const p = positionRef.current;
      if (p && (action === "accept" || action === "pickup")) sendLocation(p.lat, p.lng, p.heading, true);
      await refresh();
      return o;
    } catch (e: any) {
      showToast(e.message || "Action failed", "error");
      await refresh();
      return null;
    }
  };

  return (
    <RiderContext.Provider
      value={{
        dashboard,
        requests,
        assigned,
        activeOrder,
        loading,
        connected,
        position,
        locationState,
        refresh,
        setOnline,
        act,
        requestLocation,
        openSettings: () => Linking.openSettings(),
      }}
    >
      {children}
    </RiderContext.Provider>
  );
}

export const useRider = () => useContext(RiderContext);
