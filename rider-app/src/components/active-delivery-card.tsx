import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { Order, STATUS_LABELS, inrFromPaise } from "@/src/types";

export function ActiveDeliveryCard({ order }: { order: Order }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const pickupLeg = order.status !== "OUT_FOR_DELIVERY";
  return (
    <Pressable testID="active-delivery-card" style={styles.card} onPress={() => router.push(`/delivery/${order.id}`)}>
      <View style={styles.top}>
        <View style={styles.pill}>
          <View style={styles.dot} />
          <Text style={styles.pillText}>ACTIVE DELIVERY</Text>
        </View>
        <Text style={styles.earn}>+{inrFromPaise(order.amounts.delivery_fee + order.amounts.tip)}</Text>
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {pickupLeg ? `Pick up from ${order.restaurant.name}` : `Deliver to ${order.customer?.name ?? order.address.label}`}
      </Text>
      <Text style={styles.sub} numberOfLines={1}>
        {pickupLeg ? order.restaurant.address : `${order.address.line1}${order.address.landmark ? `, ${order.address.landmark}` : ""}`}
      </Text>
      <View style={styles.statusRow}>
        <Ionicons name={pickupLeg ? "restaurant" : "navigate"} size={14} color={colors.onBrandPrimary} />
        <Text style={styles.status}>{STATUS_LABELS[order.status] ?? order.status}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.onBrandPrimary} style={{ marginLeft: "auto" }} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.brandPrimary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.onBrandPrimary },
  pillText: { color: colors.onBrandPrimary, fontFamily: fonts.displayBold, fontSize: 10, letterSpacing: 1 },
  earn: { color: colors.onBrandPrimary, fontFamily: fonts.displayBold, fontSize: typeScale.lg },
  title: { color: colors.onBrandPrimary, fontFamily: fonts.displayBold, fontSize: typeScale.xl, marginTop: spacing.xs },
  sub: { color: colors.onBrandPrimary, opacity: 0.9, fontFamily: fonts.text, fontSize: typeScale.sm },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  status: { color: colors.onBrandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm },
}));
