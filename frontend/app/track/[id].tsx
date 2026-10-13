import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { apiFetch, wsUrl } from "@/src/api/client";
import { EmptyState } from "@/src/components/ui";
import { LiveMap } from "@/src/components/live-map";
import { Order, STATUS_LABELS } from "../(tabs)/orders";

const STEPS = [
  { key: "PLACED", label: "Order placed", icon: "receipt" },
  { key: "CONFIRMED", label: "Accepted by restaurant", icon: "checkmark-circle" },
  { key: "PREPARING", label: "Being prepared", icon: "flame" },
  { key: "READY", label: "Ready for pickup", icon: "bag-check" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery", icon: "bicycle" },
  { key: "DELIVERED", label: "Delivered", icon: "home" },
] as const;

const FALLBACK_RESTAURANT = { lat: 12.9716, lng: 77.5946 };

export default function TrackOrder() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState("");
  const [eta, setEta] = useState(35);
  const [connected, setConnected] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let closed = false;

    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(wsUrl(`/api/ws/orders/${id}`));
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "init" || msg.type === "status") {
            setStatus(msg.status);
            if (msg.eta_mins != null) setEta(msg.eta_mins);
          }
          if (msg.type === "init" && msg.rider) {
            setOrder((o) => (o ? { ...o, rider: msg.rider } : o));
            if (msg.rider.lat != null) setRiderPos({ lat: msg.rider.lat, lng: msg.rider.lng });
          }
          if (msg.type === "rider") {
            setOrder((o) => (o ? { ...o, rider: msg.rider } : o));
          }
          if (msg.type === "location") {
            setEta(msg.eta_mins);
            setRiderPos({ lat: msg.rider.lat, lng: msg.rider.lng });
          }
        } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retryRef.current = setTimeout(connect, 4000);
      };
      ws.onerror = () => ws.close();
    };

    (async () => {
      try {
        const o = await apiFetch<Order>(`/api/orders/${id}`);
        setOrder(o);
        setStatus(o.status);
        if (o.rider?.lat != null && o.rider?.lng != null) setRiderPos({ lat: o.rider.lat, lng: o.rider.lng });
      } catch (e: any) {
        setLoadError(e.message || "Tracking information unavailable.");
      }
    })();
    connect();

    return () => {
      closed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const stepIndex = STEPS.findIndex((s) => s.key === status);
  const delivered = status === "DELIVERED";
  const restaurantPos = {
    lat: order?.restaurant.lat ?? FALLBACK_RESTAURANT.lat,
    lng: order?.restaurant.lng ?? FALLBACK_RESTAURANT.lng,
  };
  const destinationPos = {
    lat: order?.address.lat ?? restaurantPos.lat + 0.018,
    lng: order?.address.lng ?? restaurantPos.lng + 0.012,
  };
  const riderOnMap = delivered ? destinationPos : riderPos ?? restaurantPos;

  if (loadError) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Tracking unavailable"
          subtitle={loadError}
          actionLabel="Go Back"
          onAction={() => router.back()}
          testID="track-error"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="track-screen">
      <View style={styles.header}>
        <Pressable testID="track-back" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1917" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Track Order</Text>
          {order ? <Text style={styles.subtitle}>{order.restaurant.name}</Text> : null}
        </View>
        <View style={[styles.liveBadge, { opacity: connected ? 1 : 0.5 }]} testID="live-badge">
          <View style={[styles.liveDot, { backgroundColor: connected ? "#388E3C" : "#F57C00" }]} />
          <Text style={styles.liveText}>{connected ? "LIVE" : "..."}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LiveMap
          restaurant={restaurantPos}
          destination={destinationPos}
          rider={riderOnMap}
          showRider={!!order?.rider || delivered}
        />

        {/* ETA banner */}
        <View style={styles.etaCard} testID="track-eta">
          {delivered ? (
            <>
              <Text style={styles.etaTitle}>Delivered 🎉</Text>
              <Text style={styles.etaSub}>Enjoy your meal!</Text>
            </>
          ) : status === "CANCELLED" ? (
            <>
              <Text style={styles.etaTitle}>Order cancelled</Text>
              <Text style={styles.etaSub}>Any payment made will be refunded.</Text>
            </>
          ) : status === "PLACED" ? (
            <>
              <Text style={styles.etaTitle}>Waiting for restaurant</Text>
              <Text style={styles.etaSub}>Your order will be accepted shortly</Text>
            </>
          ) : status === "PAYMENT_PENDING" ? (
            <>
              <Text style={styles.etaTitle}>Payment pending</Text>
              <Text style={styles.etaSub}>This order is awaiting payment.</Text>
            </>
          ) : (
            <>
              <Text style={styles.etaTitle}>Arriving in ~{eta} min</Text>
              <Text style={styles.etaSub}>{STATUS_LABELS[status] ?? "Connecting..."}</Text>
            </>
          )}
        </View>

        {/* Rider card */}
        {order?.rider && !delivered ? (
          <View style={styles.riderCard} testID="rider-card">
            <View style={styles.riderAvatar}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.riderName}>{order.rider?.name ?? "Delivery partner"}</Text>
              <Text style={styles.riderSub}>{order.rider?.vehicle ?? "Your delivery partner"}</Text>
            </View>
            <Pressable
              testID="rider-call-button"
              style={styles.riderAction}
              onPress={() => Linking.openURL(`tel:${order.rider?.phone ?? ""}`)}
            >
              <Ionicons name="call" size={18} color="#D95325" />
            </Pressable>
            <Pressable
              testID="rider-chat-button"
              style={styles.riderAction}
              onPress={() => router.push("/help")}
            >
              <Ionicons name="chatbubble-ellipses" size={18} color="#D95325" />
            </Pressable>
          </View>
        ) : null}

        {/* Status timeline */}
        <View style={styles.timelineCard} testID="track-timeline">
          {STEPS.map((step, i) => {
            const done = stepIndex >= i;
            const current = stepIndex === i;
            return (
              <View key={step.key} style={styles.stepRow} testID={`track-step-${step.key.toLowerCase()}`}>
                <View style={styles.stepLeft}>
                  <View style={[styles.stepIcon, done && styles.stepIconDone, current && styles.stepIconCurrent]}>
                    <Ionicons
                      name={step.icon as any}
                      size={16}
                      color={done ? "#FFFFFF" : "#C8BCAB"}
                    />
                  </View>
                  {i < STEPS.length - 1 ? (
                    <View style={[styles.stepLine, stepIndex > i && styles.stepLineDone]} />
                  ) : null}
                </View>
                <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
              </View>
            );
          })}
        </View>

        {order ? (
          <Pressable
            testID="track-details-link"
            style={styles.detailsLink}
            onPress={() => router.push(`/order/${order.id}`)}
          >
            <Text style={styles.detailsLinkText}>View order details</Text>
            <Ionicons name="chevron-forward" size={16} color="#D95325" />
          </Pressable>
        ) : (
          <ActivityIndicator color="#D95325" style={{ marginTop: spacing.lg }} />
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontFamily: fonts.displayBold, fontSize: 10, color: colors.onSurfaceSecondary, letterSpacing: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  etaCard: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: 2,
  },
  etaTitle: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: colors.onSurfaceInverse },
  etaSub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.surfaceTertiary },
  riderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  riderName: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg, color: colors.onSurface },
  riderSub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  riderAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 52 },
  stepLeft: { alignItems: "center", width: 32 },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIconDone: { backgroundColor: colors.success },
  stepIconCurrent: { backgroundColor: colors.brandPrimary },
  stepLine: { width: 2, flex: 1, minHeight: 18, backgroundColor: colors.border, marginVertical: 2 },
  stepLineDone: { backgroundColor: colors.success },
  stepLabel: { fontFamily: fonts.textMedium, fontSize: typeScale.lg, color: colors.muted },
  stepLabelDone: { color: colors.onSurface, fontFamily: fonts.displaySemiBold },
  detailsLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 48 },
  detailsLinkText: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.base },
}));
