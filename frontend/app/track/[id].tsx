import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { apiFetch, wsUrl } from "@/src/api/client";
import { EmptyState } from "@/src/components/ui";
import { Order, STATUS_LABELS } from "../(tabs)/orders";

const STEPS = [
  { key: "CONFIRMED", label: "Order confirmed", icon: "checkmark-circle" },
  { key: "PREPARING", label: "Being prepared", icon: "flame" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery", icon: "bicycle" },
  { key: "DELIVERED", label: "Delivered", icon: "home" },
] as const;

const { width } = Dimensions.get("window");
const MAP_WIDTH = width - spacing.lg * 2;
const RIDER_START = { x: 24, y: 28 };
const RIDER_END = { x: MAP_WIDTH - 64, y: 130 };

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
  const progress = useSharedValue(0);
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
          if (msg.type === "location") {
            setEta(msg.eta_mins);
            progress.value = withTiming(msg.progress, { duration: 4500 });
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
        if (o.status === "DELIVERED") progress.value = 1;
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

  const riderStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: RIDER_START.x + (RIDER_END.x - RIDER_START.x) * progress.value },
      { translateY: RIDER_START.y + (RIDER_END.y - RIDER_START.y) * progress.value },
    ],
  }));

  const stepIndex = STEPS.findIndex((s) => s.key === status);
  const delivered = status === "DELIVERED";

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
        {/* Simulated live map */}
        <View style={styles.mapCard} testID="track-map">
          <View style={styles.mapGrid}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridLineH, { top: 40 * (i + 1) }]} />
            ))}
            {Array.from({ length: 7 }).map((_, i) => (
              <View key={`v-${i}`} style={[styles.gridLineV, { left: (MAP_WIDTH / 7) * (i + 1) }]} />
            ))}
          </View>
          {/* Route line */}
          <View style={styles.routeLine} />
          {/* Restaurant pin */}
          <View style={[styles.pin, { left: RIDER_START.x - 4, top: RIDER_START.y - 10 }]}>
            <Ionicons name="storefront" size={18} color="#B84018" />
          </View>
          {/* Home pin */}
          <View style={[styles.pin, { left: RIDER_END.x + 4, top: RIDER_END.y + 6 }]}>
            <Ionicons name="home" size={18} color="#388E3C" />
          </View>
          {/* Rider marker */}
          <Animated.View style={[styles.riderMarker, riderStyle]} testID="rider-marker">
            <Ionicons name="bicycle" size={16} color="#FFFFFF" />
          </Animated.View>
        </View>

        {/* ETA banner */}
        <View style={styles.etaCard} testID="track-eta">
          {delivered ? (
            <>
              <Text style={styles.etaTitle}>Delivered 🎉</Text>
              <Text style={styles.etaSub}>Enjoy your meal!</Text>
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
        {order && (status === "OUT_FOR_DELIVERY" || status === "PREPARING") ? (
          <View style={styles.riderCard} testID="rider-card">
            <View style={styles.riderAvatar}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.riderName}>{order.rider?.name ?? "Delivery partner"}</Text>
              <Text style={styles.riderSub}>Your delivery partner</Text>
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
  mapCard: {
    height: 210,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapGrid: { position: "absolute", inset: 0 } as any,
  gridLineH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: colors.divider },
  gridLineV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: colors.divider },
  routeLine: {
    position: "absolute",
    left: 40,
    top: 44,
    width: MAP_WIDTH - 110,
    height: 0,
    borderTopWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    transform: [{ rotate: "14deg" }],
  },
  pin: { position: "absolute" },
  riderMarker: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brandSecondary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
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
