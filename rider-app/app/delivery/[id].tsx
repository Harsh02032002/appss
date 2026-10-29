import React, { useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { EmptyState } from "@/src/components/ui";
import { LeafletMap } from "@/src/components/leaflet-map";
import { LocationBanner } from "@/src/components/location-banner";
import { useRider } from "@/src/context/rider";
import { openNavigation } from "@/src/navigate";
import { STATUS_LABELS, inrFromPaise } from "@/src/types";

export default function Delivery() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeOrder, assigned, act, position, loading } = useRider();
  const [busy, setBusy] = useState<string | null>(null);

  const order = activeOrder?.id === id ? activeOrder : assigned.find((o) => o.id === id) ?? null;

  if (!order) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} />
        ) : (
          <EmptyState icon="checkmark-done-outline" title="Delivery completed" subtitle="This delivery is no longer active." actionLabel="Back to Home" onAction={() => router.dismissTo("/home")} testID="delivery-done" />
        )}
      </View>
    );
  }

  const pickupLeg = order.status !== "OUT_FOR_DELIVERY";
  const ready = order.status === "READY";
  const restaurant = order.restaurant.lat != null && order.restaurant.lng != null ? { lat: order.restaurant.lat, lng: order.restaurant.lng } : null;
  const customer = order.address.lat != null && order.address.lng != null ? { lat: order.address.lat, lng: order.address.lng } : null;
  const dest = pickupLeg ? order.restaurant : order.address;
  const destLabel = pickupLeg ? order.restaurant.name : `${order.address.label} · ${order.address.line1}`;

  const run = async (action: "pickup" | "deliver" | "reject") => {
    if (action === "reject") {
      const ok =
        Platform.OS === "web"
          ? window.confirm("Decline this delivery? It will go back to other riders.")
          : await new Promise<boolean>((resolve) =>
              Alert.alert("Decline delivery?", "It will go back to other riders.", [
                { text: "Keep", style: "cancel", onPress: () => resolve(false) },
                { text: "Decline", style: "destructive", onPress: () => resolve(true) },
              ]),
            );
      if (!ok) return;
    }
    setBusy(action);
    const res = await act(order.id, action);
    setBusy(null);
    if (res && (action === "deliver" || action === "reject")) router.dismissTo("/home");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="delivery-screen">
      <View style={styles.header}>
        <Pressable testID="delivery-back" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{pickupLeg ? "Pickup" : "Drop-off"}</Text>
          <Text style={styles.subtitle} testID="delivery-status">
            {STATUS_LABELS[order.status] ?? order.status}
          </Text>
        </View>
        <Text style={styles.earn}>+{inrFromPaise(order.amounts.delivery_fee + order.amounts.tip)}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 140 }]} showsVerticalScrollIndicator={false}>
        <LocationBanner />
        <LeafletMap rider={position ? { lat: position.lat, lng: position.lng } : null} restaurant={restaurant} customer={customer} leg={pickupLeg ? "pickup" : "drop"} />
        {!position ? (
          <Text style={styles.gpsHint} testID="gps-waiting">
            Waiting for GPS fix… your live position will appear on the map.
          </Text>
        ) : null}

        {/* Steps */}
        <View style={styles.steps}>
          <Step n={1} title={order.restaurant.name} sub={order.restaurant.address} icon="restaurant" active={pickupLeg} done={!pickupLeg} phone={undefined} />
          <View style={styles.stepLine} />
          <Step n={2} title={order.customer?.name ?? "Customer"} sub={`${order.address.line1}${order.address.landmark ? `, ${order.address.landmark}` : ""}`} icon="home" active={!pickupLeg} done={order.status === "DELIVERED"} phone={order.customer?.phone} />
        </View>

        {/* Order summary */}
        <View style={styles.card} testID="delivery-items">
          <Text style={styles.cardTitle}>Order #{order.id.slice(-6).toUpperCase()}</Text>
          {order.items.map((i) => (
            <Text key={i.item_id} style={styles.item}>
              {i.qty} × {i.name}
            </Text>
          ))}
          <View style={[styles.payRow, { backgroundColor: order.payment_method === "cod" ? colors.surfaceTertiary : colors.brandTertiary }]}>
            <Ionicons name={order.payment_method === "cod" ? "cash" : "card"} size={16} color={order.payment_method === "cod" ? colors.warning : colors.brandPrimary} />
            <Text style={styles.payText}>{order.payment_method === "cod" ? `Collect ${inrFromPaise(order.amounts.total)} in cash` : "Paid online · nothing to collect"}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Big action buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]} testID="delivery-actions">
        <View style={styles.footerRow}>
          <Pressable testID="navigate-button" style={styles.navBtn} onPress={() => openNavigation(dest.lat, dest.lng, destLabel)}>
            <Ionicons name="navigate" size={20} color={colors.brandPrimary} />
            <Text style={styles.navText}>{pickupLeg ? "Navigate to restaurant" : "Navigate to customer"}</Text>
          </Pressable>
          {!pickupLeg && order.customer?.phone ? (
            <Pressable testID="call-customer" style={styles.callBtn} onPress={() => Linking.openURL(`tel:${order.customer?.phone}`)}>
              <Ionicons name="call" size={20} color={colors.onBrandPrimary} />
            </Pressable>
          ) : null}
        </View>
        {busy ? (
          <View style={styles.mainBtn}>
            <ActivityIndicator color={colors.onBrandPrimary} />
          </View>
        ) : pickupLeg ? (
          <>
            <Pressable testID="pickup-button" style={[styles.mainBtn, !ready && styles.mainBtnDisabled]} disabled={!ready} onPress={() => run("pickup")}>
              <Ionicons name="bag-check" size={20} color={colors.onBrandPrimary} />
              <Text style={styles.mainText}>{ready ? "Mark as picked up" : "Waiting for restaurant to mark ready…"}</Text>
            </Pressable>
            <Pressable testID="reject-button" style={styles.declineBtn} onPress={() => run("reject")}>
              <Text style={styles.declineText}>Decline this delivery</Text>
            </Pressable>
          </>
        ) : (
          <Pressable testID="deliver-button" style={[styles.mainBtn, { backgroundColor: colors.success }]} onPress={() => run("deliver")}>
            <Ionicons name="checkmark-done" size={20} color={colors.onBrandPrimary} />
            <Text style={styles.mainText}>Mark as delivered</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Step({ n, title, sub, icon, active, done, phone }: { n: number; title: string; sub: string; icon: string; active: boolean; done: boolean; phone?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.stepIcon, active && { backgroundColor: colors.brandPrimary }, done && { backgroundColor: colors.success }]}>
        <Ionicons name={(done ? "checkmark" : icon) as any} size={16} color={active || done ? colors.onBrandPrimary : colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepLabel}>STEP {n}</Text>
        <Text style={[styles.stepTitle, !active && !done && { color: colors.muted }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.stepSub} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      {phone && active ? (
        <Pressable testID="step-call" style={styles.stepCall} onPress={() => Linking.openURL(`tel:${phone}`)}>
          <Ionicons name="call" size={16} color={colors.brandPrimary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: colors.onSurface },
  subtitle: { fontFamily: fonts.textMedium, fontSize: typeScale.sm, color: colors.brandPrimary },
  earn: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.success },
  scroll: { padding: spacing.lg, gap: spacing.md },
  gpsHint: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, textAlign: "center" },
  steps: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg },
  step: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  stepLine: { width: 2, height: 20, backgroundColor: colors.border, marginLeft: 17, marginVertical: 4 },
  stepLabel: { fontFamily: fonts.displayBold, fontSize: 10, color: colors.muted, letterSpacing: 0.8 },
  stepTitle: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  stepSub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, lineHeight: 17 },
  stepCall: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: typeScale.base, color: colors.onSurface, marginBottom: 2 },
  item: { fontFamily: fonts.text, fontSize: typeScale.base, color: colors.onSurfaceSecondary },
  payRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm },
  payText: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm, color: colors.onSurface },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  footerRow: { flexDirection: "row", gap: spacing.sm },
  navBtn: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: colors.brandPrimary, borderRadius: radius.md },
  navText: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.brandPrimary },
  callBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  mainBtn: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brandPrimary, borderRadius: radius.md },
  mainBtnDisabled: { backgroundColor: colors.borderStrong },
  mainText: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onBrandPrimary },
  declineBtn: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  declineText: { fontFamily: fonts.textMedium, fontSize: typeScale.sm, color: colors.error },
}));
