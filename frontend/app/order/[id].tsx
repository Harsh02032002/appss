import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import dayjs from "dayjs";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { apiFetch } from "@/src/api/client";
import { EmptyState, inr, VegBadge } from "@/src/components/ui";
import { ACTIVE_STATUSES, Order, STATUS_LABELS, statusColor } from "../(tabs)/orders";

export default function OrderDetails() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const o = await apiFetch<Order>(`/api/orders/${id}`);
        setOrder(o);
      } catch (e: any) {
        setError(e.message || "Failed to fetch order details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="order-details-screen">
      <View style={styles.header}>
        <Pressable testID="order-details-back" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1917" />
        </Pressable>
        <Text style={styles.title}>Order Details</Text>
      </View>

      {loading ? (
        <View style={styles.center} testID="order-details-loading">
          <ActivityIndicator color="#D95325" />
        </View>
      ) : error || !order ? (
        <EmptyState icon="alert-circle-outline" title="Order not found" subtitle={error} testID="order-details-error" />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Restaurant header */}
          <View style={styles.card}>
            <View style={styles.restaurantRow}>
              <Image source={{ uri: order.restaurant.image }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.restaurantName}>{order.restaurant.name}</Text>
                <Text style={styles.meta}>{order.restaurant.address}</Text>
                <Text style={styles.meta}>{dayjs(order.created_at).format("D MMM YYYY, h:mm A")}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: statusColor(order.status, colors) }]}>
                <Text style={styles.badgeText}>{STATUS_LABELS[order.status] ?? order.status}</Text>
              </View>
            </View>
          </View>

          {/* Timeline */}
          <Text style={styles.sectionTitle}>Status Timeline</Text>
          <View style={styles.card} testID="order-timeline">
            {order.timeline.length === 0 ? (
              <Text style={styles.meta}>Awaiting updates...</Text>
            ) : (
              order.timeline.map((t, i) => (
                <View key={i} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineStatus}>{STATUS_LABELS[t.status] ?? t.status}</Text>
                    <Text style={styles.meta}>{dayjs(t.at).format("h:mm A")}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Items */}
          <Text style={styles.sectionTitle}>Items ({order.items.reduce((a, i) => a + i.qty, 0)})</Text>
          <View style={styles.card} testID="order-items">
            {order.items.map((item, i) => (
              <View key={i} style={[styles.itemRow, i > 0 && styles.itemRowBorder]}>
                <VegBadge veg={item.veg} />
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.meta}>x{item.qty}</Text>
                <Text style={styles.itemPrice}>{inr(item.price * item.qty)}</Text>
              </View>
            ))}
          </View>

          {/* Bill */}
          <Text style={styles.sectionTitle}>Bill Details</Text>
          <View style={styles.card} testID="order-bill">
            <Row label="Item total" value={inr(order.amounts.subtotal)} />
            <Row label="Delivery fee" value={inr(order.amounts.delivery_fee)} />
            <Row label="Taxes & charges" value={inr(order.amounts.taxes)} />
            <Row label="Tip" value={order.amounts.tip ? inr(order.amounts.tip) : "—"} />
            <View style={styles.divider} />
            <View style={styles.rowBetween}>
              <Text style={styles.totalLabel}>
                Total ({order.payment_method === "cod" ? "Cash on Delivery" : "Paid Online"})
              </Text>
              <Text style={styles.totalValue}>{inr(order.amounts.total)}</Text>
            </View>
          </View>

          {/* Address */}
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.card} testID="order-address">
            <View style={styles.addressRow}>
              <Ionicons name="location" size={18} color="#D95325" />
              <View style={{ flex: 1 }}>
                <Text style={styles.addressLabel}>{order.address.label}</Text>
                <Text style={styles.meta}>
                  {[order.address.line1, order.address.landmark, order.address.city, order.address.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>
            </View>
          </View>

          {ACTIVE_STATUSES.includes(order.status) ? (
            <Pressable
              testID="order-details-track-button"
              style={styles.trackBtn}
              onPress={() => router.push(`/track/${order.id}`)}
            >
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
              <Text style={styles.trackBtnText}>Track Live</Text>
            </Pressable>
          ) : null}

          <Pressable testID="order-help-link" style={styles.helpLink} onPress={() => router.push("/help")}>
            <Text style={styles.helpText}>Need help with this order?</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  restaurantRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  restaurantName: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg, color: colors.onSurface },
  meta: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeText: { color: "#FFFFFF", fontFamily: fonts.displaySemiBold, fontSize: 11 },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: typeScale.lg,
    color: colors.onSurface,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  timelineRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  timelineStatus: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  itemName: { flex: 1, fontFamily: fonts.textMedium, fontSize: typeScale.base, color: colors.onSurface },
  itemPrice: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowValue: { fontFamily: fonts.textMedium, fontSize: typeScale.base, color: colors.onSurface },
  divider: { height: 1, backgroundColor: colors.borderStrong, marginVertical: spacing.xs },
  totalLabel: { fontFamily: fonts.displayBold, fontSize: typeScale.base, color: colors.onSurface },
  totalValue: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface },
  addressRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  addressLabel: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    minHeight: 52,
    marginTop: spacing.lg,
  },
  trackBtnText: { color: "#FFFFFF", fontFamily: fonts.displayBold, fontSize: typeScale.lg },
  helpLink: { alignItems: "center", minHeight: 48, justifyContent: "center", marginTop: spacing.sm },
  helpText: { color: colors.info, fontFamily: fonts.textMedium, fontSize: typeScale.base },
}));
