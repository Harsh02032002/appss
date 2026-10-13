import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import dayjs from "dayjs";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { apiFetch } from "@/src/api/client";
import { EmptyState } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useReorder } from "@/src/hooks/use-reorder";

export type Order = {
  id: string;
  restaurant: { id: string; name: string; image: string; address: string; lat?: number; lng?: number };
  items: { item_id: string; name: string; price: number; qty: number; veg: boolean; image: string; notes?: string }[];
  address: { label: string; line1: string; landmark?: string; city?: string; pincode?: string; lat?: number; lng?: number };
  amounts: { subtotal: number; delivery_fee: number; taxes: number; tip: number; discount?: number; total: number };
  coupon_code?: string;
  review?: { rating: number; comment: string; at: string } | null;
  payment_method: string;
  payment_status: string;
  status: string;
  rider?: { id?: string; name: string; phone: string; vehicle?: string; lat?: number; lng?: number } | null;
  customer?: { name: string; phone: string };
  cancel_reason?: string;
  timeline: { status: string; at: string }[];
  created_at: string;
};

export const ACTIVE_STATUSES = ["PLACED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];

export const STATUS_LABELS: Record<string, string> = {
  PAYMENT_PENDING: "Payment Pending",
  PLACED: "Placed",
  CONFIRMED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready for pickup",
  OUT_FOR_DELIVERY: "On the way",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function statusColor(status: string, colors: any): string {
  switch (status) {
    case "PLACED":
      return colors.muted;
    case "CONFIRMED":
      return colors.info;
    case "PREPARING":
    case "READY":
      return colors.warning;
    case "OUT_FOR_DELIVERY":
      return colors.brandPrimary;
    case "DELIVERED":
      return colors.success;
    default:
      return colors.error;
  }
}

export default function Orders() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const { user, loading: authLoading } = useAuth();
  const reorder = useReorder();

  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"active" | "past">("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await apiFetch<{ orders: Order[] }>("/api/orders");
      setOrders(data.orders);
    } catch {
      // keep stale list
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]),
  );

  const filtered = orders.filter((o) =>
    tab === "active" ? ACTIVE_STATUSES.includes(o.status) : !ACTIVE_STATUSES.includes(o.status),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="orders-screen">
      <Text style={styles.title}>My Orders</Text>

      {authLoading || loading ? (
        <View style={styles.center} testID="orders-loading">
          <ActivityIndicator color="#D95325" />
        </View>
      ) : !user ? (
        <EmptyState
          icon="receipt-outline"
          title="Log in to view orders"
          subtitle="Your order history and live tracking live here."
          actionLabel="Log In"
          onAction={() => router.push({ pathname: "/login", params: { redirect: "/orders" } })}
          testID="orders-guest"
        />
      ) : (
        <>
          <View style={styles.segment} testID="orders-tabs">
            {(["active", "past"] as const).map((t) => (
              <Pressable
                key={t}
                testID={`orders-tab-${t}`}
                style={[styles.segmentBtn, tab === t && styles.segmentBtnActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                  {t === "active" ? "Active" : "Past Orders"}
                </Text>
              </Pressable>
            ))}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            contentContainerStyle={[styles.list, { paddingBottom: 32 + bottomChrome }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor="#D95325"
              />
            }
            renderItem={({ item }) => (
              <Pressable
                testID={`order-card-${item.id}`}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
                onPress={() => router.push(`/order/${item.id}`)}
              >
                <View style={styles.cardTop}>
                  <Image source={{ uri: item.restaurant.image }} style={styles.thumb} contentFit="cover" />
                  <View style={styles.cardInfo}>
                    <Text style={styles.restaurantName} numberOfLines={1}>
                      {item.restaurant.name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.items.map((i) => `${i.name} x${i.qty}`).join(", ")}
                    </Text>
                    <Text style={styles.meta}>{dayjs(item.created_at).format("D MMM, h:mm A")}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: statusColor(item.status, colors) }]}>
                    <Text style={styles.badgeText}>{STATUS_LABELS[item.status] ?? item.status}</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <View style={styles.totalWrap}>
                    <Text style={styles.total}>₹{Math.round(item.amounts.total / 100)}</Text>
                    {item.review ? (
                      <View style={styles.ratedRow} testID={`order-rated-${item.id}`}>
                        <Ionicons name="star" size={12} color={colors.warning} />
                        <Text style={styles.ratedText}>You rated {item.review.rating}</Text>
                      </View>
                    ) : null}
                  </View>
                  {ACTIVE_STATUSES.includes(item.status) ? (
                    <Pressable
                      testID={`track-button-${item.id}`}
                      style={styles.trackBtn}
                      onPress={() => router.push(`/track/${item.id}`)}
                    >
                      <Text style={styles.trackBtnText}>Track Order</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.actionRow}>
                      {item.status === "DELIVERED" && !item.review ? (
                        <Pressable
                          testID={`rate-button-${item.id}`}
                          style={styles.outlineBtn}
                          onPress={() => router.push(`/order/${item.id}`)}
                        >
                          <Ionicons name="star-outline" size={14} color={colors.brandPrimary} />
                          <Text style={styles.outlineBtnText}>Rate</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        testID={`reorder-button-${item.id}`}
                        style={styles.trackBtn}
                        onPress={() => reorder(item)}
                      >
                        <Text style={styles.trackBtnText}>Reorder</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <EmptyState
                icon="receipt-outline"
                title={tab === "active" ? "No active orders" : "No past orders"}
                subtitle="You have not placed any orders yet. Start your culinary journey!"
                actionLabel="Browse Restaurants"
                onAction={() => router.push("/home")}
                testID="orders-empty"
              />
            }
          />
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: typeScale.xxl,
    color: colors.onSurface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    letterSpacing: -0.4,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.sm,
  },
  segmentBtn: { flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  segmentBtnActive: { backgroundColor: colors.surface },
  segmentText: { fontFamily: fonts.textMedium, fontSize: typeScale.base, color: colors.muted },
  segmentTextActive: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardTop: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  cardInfo: { flex: 1, gap: 2 },
  restaurantName: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg, color: colors.onSurface },
  meta: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { color: "#FFFFFF", fontFamily: fonts.displaySemiBold, fontSize: 11 },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
  },
  total: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface },
  totalWrap: { gap: 2 },
  ratedRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratedText: { fontFamily: fonts.textMedium, fontSize: typeScale.sm, color: colors.muted },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: "center",
  },
  outlineBtnText: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.base },
  trackBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 40,
    justifyContent: "center",
  },
  trackBtnText: { color: "#FFFFFF", fontFamily: fonts.displaySemiBold, fontSize: typeScale.base },
}));
