import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { inr } from "@/src/components/ui";
import { Order, STATUS_LABELS, statusColor } from "@/src/types";

dayjs.extend(relativeTime);

type Props = {
  order: Order;
  busy?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onPreparing?: () => void;
  onReady?: () => void;
  onAssign?: () => void;
};

export function OrderCard({ order, busy, onAccept, onReject, onPreparing, onReady, onAssign }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const itemCount = order.items.reduce((n, i) => n + i.qty, 0);

  return (
    <Pressable
      testID={`order-card-${order.id}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
      onPress={() => router.push(`/order/${order.id}`)}
    >
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.customer} numberOfLines={1}>
            {order.customer?.name ?? "Customer"} · {dayjs(order.created_at).fromNow()}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor(order.status, colors) }]}>
          <Text style={styles.badgeText}>{STATUS_LABELS[order.status] ?? order.status}</Text>
        </View>
      </View>

      <Text style={styles.items} numberOfLines={2}>
        {order.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
      </Text>

      <View style={styles.meta}>
        <Text style={styles.total}>{inr(order.amounts.total)}</Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.metaText}>
          {itemCount} item{itemCount > 1 ? "s" : ""}
        </Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.metaText}>{order.payment_method === "cod" ? "Cash on delivery" : "Paid online"}</Text>
        {order.rider ? (
          <>
            <Text style={styles.dot}>•</Text>
            <Ionicons name="bicycle" size={13} color={colors.muted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {order.rider.name}
            </Text>
          </>
        ) : null}
      </View>

      {busy ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.sm }} />
      ) : (
        <View style={styles.actions}>
          {order.status === "PLACED" ? (
            <>
              <Pressable testID={`reject-${order.id}`} style={styles.secondaryBtn} onPress={onReject}>
                <Text style={styles.secondaryText}>Reject</Text>
              </Pressable>
              <Pressable testID={`accept-${order.id}`} style={styles.primaryBtn} onPress={onAccept}>
                <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.primaryText}>Accept</Text>
              </Pressable>
            </>
          ) : null}
          {order.status === "CONFIRMED" ? (
            <Pressable testID={`preparing-${order.id}`} style={styles.primaryBtn} onPress={onPreparing}>
              <Ionicons name="flame" size={16} color={colors.onBrandPrimary} />
              <Text style={styles.primaryText}>Start preparing</Text>
            </Pressable>
          ) : null}
          {order.status === "PREPARING" ? (
            <Pressable testID={`ready-${order.id}`} style={styles.primaryBtn} onPress={onReady}>
              <Ionicons name="bag-check" size={16} color={colors.onBrandPrimary} />
              <Text style={styles.primaryText}>Mark ready</Text>
            </Pressable>
          ) : null}
          {["CONFIRMED", "PREPARING", "READY"].includes(order.status) && !order.rider ? (
            <Pressable testID={`assign-${order.id}`} style={styles.secondaryBtn} onPress={onAssign}>
              <Ionicons name="bicycle" size={16} color={colors.brandPrimary} />
              <Text style={styles.secondaryText}>Assign rider</Text>
            </Pressable>
          ) : null}
          {order.status === "READY" && order.rider ? (
            <Text style={styles.waiting} testID={`waiting-${order.id}`}>
              Waiting for {order.rider.name} to pick up…
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  orderId: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface },
  customer: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, marginTop: 2 },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeText: { color: colors.onBrandPrimary, fontFamily: fonts.displaySemiBold, fontSize: 11 },
  items: { fontFamily: fonts.textMedium, fontSize: typeScale.base, color: colors.onSurfaceSecondary, lineHeight: 20 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  total: { fontFamily: fonts.displayBold, fontSize: typeScale.base, color: colors.onSurface },
  dot: { color: colors.muted, fontSize: typeScale.sm },
  metaText: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.xs },
  primaryBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  primaryText: { color: colors.onBrandPrimary, fontFamily: fonts.displayBold, fontSize: typeScale.base },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  secondaryText: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.base },
  waiting: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, alignSelf: "center" },
}));
