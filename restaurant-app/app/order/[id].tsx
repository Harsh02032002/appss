import React, { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import dayjs from "dayjs";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { EmptyState, inr, VegBadge } from "@/src/components/ui";
import { OrderActionSheet } from "@/src/components/order-action-sheet";
import { useOrdersFeed } from "@/src/context/orders-feed";
import { STATUS_LABELS, statusColor } from "@/src/types";

export default function OrderDetails() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, loading, act } = useOrdersFeed();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"assign" | "reject" | null>(null);

  const order = orders.find((o) => o.id === id);

  const run = async (action: "accept" | "preparing" | "ready") => {
    if (!order) return;
    setBusy(true);
    await act(order, action);
    setBusy(false);
  };

  if (loading && !order) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (!order) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState icon="receipt-outline" title="Order not found" actionLabel="Go Back" onAction={() => router.back()} testID="order-not-found" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="order-details-screen">
      <View style={styles.header}>
        <Pressable testID="order-back" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Order #{order.id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.subtitle}>{dayjs(order.created_at).format("D MMM, h:mm A")}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor(order.status, colors) }]}>
          <Text style={styles.badgeText}>{STATUS_LABELS[order.status] ?? order.status}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        {/* Customer */}
        <View style={styles.card} testID="customer-card">
          <Text style={styles.cardTitle}>Customer</Text>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.strong}>{order.customer?.name ?? "Customer"}</Text>
              <Text style={styles.meta}>
                {order.address.label} · {order.address.line1}
                {order.address.landmark ? `, ${order.address.landmark}` : ""}
              </Text>
            </View>
            {order.customer?.phone ? (
              <Pressable testID="call-customer" style={styles.iconBtn} onPress={() => Linking.openURL(`tel:${order.customer?.phone}`)}>
                <Ionicons name="call" size={18} color={colors.brandPrimary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Items */}
        <View style={styles.card} testID="items-card">
          <Text style={styles.cardTitle}>Items</Text>
          {order.items.map((it) => (
            <View key={it.item_id} style={styles.itemRow}>
              <Image source={{ uri: it.image }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <View style={styles.itemNameRow}>
                  <VegBadge veg={it.veg} />
                  <Text style={styles.strong} numberOfLines={1}>
                    {it.name}
                  </Text>
                </View>
                <Text style={styles.meta}>
                  {it.qty} × {inr(it.price)}
                  {it.notes ? ` · “${it.notes}”` : ""}
                </Text>
              </View>
              <Text style={styles.strong}>{inr(it.price * it.qty)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <Row label="Item total" value={inr(order.amounts.subtotal)} />
          {order.amounts.discount ? <Row label={`Coupon (${order.coupon_code})`} value={`-${inr(order.amounts.discount)}`} /> : null}
          <Row label="Delivery fee" value={order.amounts.delivery_fee ? inr(order.amounts.delivery_fee) : "FREE"} />
          <Row label="Taxes" value={inr(order.amounts.taxes)} />
          {order.amounts.tip ? <Row label="Tip" value={inr(order.amounts.tip)} /> : null}
          <View style={styles.rowBetween}>
            <Text style={styles.totalLabel}>Total · {order.payment_method === "cod" ? "Cash on delivery" : "Paid online"}</Text>
            <Text style={styles.totalValue}>{inr(order.amounts.total)}</Text>
          </View>
        </View>

        {/* Rider */}
        <View style={styles.card} testID="rider-card">
          <Text style={styles.cardTitle}>Delivery</Text>
          {order.rider ? (
            <View style={styles.rowBetween}>
              <View style={styles.avatar}>
                <Ionicons name="bicycle" size={18} color={colors.onBrandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.strong}>{order.rider.name}</Text>
                <Text style={styles.meta}>{order.rider.vehicle}</Text>
              </View>
              <Pressable testID="call-rider" style={styles.iconBtn} onPress={() => Linking.openURL(`tel:${order.rider?.phone}`)}>
                <Ionicons name="call" size={18} color={colors.brandPrimary} />
              </Pressable>
            </View>
          ) : (
            <Text style={styles.meta}>No rider assigned yet.</Text>
          )}
          {order.cancel_reason ? <Text style={[styles.meta, { color: colors.error }]}>Rejected: {order.cancel_reason}</Text> : null}
        </View>

        {/* Timeline */}
        <View style={styles.card} testID="timeline-card">
          <Text style={styles.cardTitle}>Timeline</Text>
          {order.timeline.map((t, i) => (
            <View key={`${t.status}-${i}`} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: statusColor(t.status, colors) }]} />
              <Text style={styles.strong}>{STATUS_LABELS[t.status] ?? t.status}</Text>
              <Text style={styles.meta}>{dayjs(t.at).format("h:mm A")}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky actions */}
      {["PLACED", "CONFIRMED", "PREPARING", "READY"].includes(order.status) ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]} testID="order-actions">
          {busy ? (
            <ActivityIndicator color={colors.brandPrimary} />
          ) : (
            <View style={styles.actionRow}>
              {order.status === "PLACED" ? (
                <>
                  <Pressable testID="detail-reject" style={styles.secondaryBtn} onPress={() => setMode("reject")}>
                    <Text style={styles.secondaryText}>Reject</Text>
                  </Pressable>
                  <Pressable testID="detail-accept" style={styles.primaryBtn} onPress={() => run("accept")}>
                    <Text style={styles.primaryText}>Accept order</Text>
                  </Pressable>
                </>
              ) : null}
              {order.status === "CONFIRMED" ? (
                <Pressable testID="detail-preparing" style={styles.primaryBtn} onPress={() => run("preparing")}>
                  <Text style={styles.primaryText}>Start preparing</Text>
                </Pressable>
              ) : null}
              {order.status === "PREPARING" ? (
                <Pressable testID="detail-ready" style={styles.primaryBtn} onPress={() => run("ready")}>
                  <Text style={styles.primaryText}>Mark ready for pickup</Text>
                </Pressable>
              ) : null}
              {order.status !== "PLACED" && !order.rider ? (
                <Pressable testID="detail-assign" style={styles.secondaryBtn} onPress={() => setMode("assign")}>
                  <Ionicons name="bicycle" size={16} color={colors.brandPrimary} />
                  <Text style={styles.secondaryText}>Assign rider</Text>
                </Pressable>
              ) : null}
              {order.status === "READY" && order.rider ? (
                <Text style={styles.meta}>Waiting for {order.rider.name} to pick up…</Text>
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      <OrderActionSheet order={mode ? order : null} mode={mode} onClose={() => setMode(null)} />
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: colors.onSurface },
  subtitle: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeText: { color: colors.onBrandPrimary, fontFamily: fonts.displaySemiBold, fontSize: 11 },
  scroll: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: typeScale.base, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  strong: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  meta: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, lineHeight: 18 },
  rowValue: { fontFamily: fonts.textMedium, fontSize: typeScale.base, color: colors.onSurface },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  itemNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.xs },
  totalLabel: { fontFamily: fonts.displayBold, fontSize: typeScale.base, color: colors.onSurface, flex: 1 },
  totalValue: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 28 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
  },
  actionRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" },
  primaryBtn: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary, borderRadius: radius.md, paddingHorizontal: spacing.md },
  primaryText: { color: colors.onBrandPrimary, fontFamily: fonts.displayBold, fontSize: typeScale.base },
  secondaryBtn: { flex: 1, minHeight: 48, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.brandPrimary, borderRadius: radius.md, paddingHorizontal: spacing.md },
  secondaryText: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.base },
}));
