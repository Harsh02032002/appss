import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { useRider } from "@/src/context/rider";
import { Order, STATUS_LABELS, inrFromPaise } from "@/src/types";

dayjs.extend(relativeTime);

/** A delivery request: from the open pool (accept) or assigned by the restaurant (accept/decline). */
export function RequestCard({ order, assigned }: { order: Order; assigned?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { act, activeOrder, dashboard } = useRider();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const online = dashboard?.rider.online ?? false;
  const itemCount = order.items.reduce((n, i) => n + i.qty, 0);

  const run = async (action: "accept" | "reject") => {
    setBusy(action);
    await act(order.id, action);
    setBusy(null);
  };

  return (
    <View style={[styles.card, assigned && styles.cardAssigned]} testID={`request-card-${order.id}`}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          {assigned ? <Text style={styles.assignedTag}>ASSIGNED TO YOU BY RESTAURANT</Text> : null}
          <Text style={styles.name} numberOfLines={1}>
            {order.restaurant.name}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {order.restaurant.address}
          </Text>
        </View>
        <View style={styles.earnBox}>
          <Text style={styles.earn}>{inrFromPaise(order.earning ?? order.amounts.delivery_fee + order.amounts.tip)}</Text>
          <Text style={styles.earnLabel}>earning</Text>
        </View>
      </View>

      <View style={styles.meta}>
        <Ionicons name="location" size={13} color={colors.muted} />
        <Text style={styles.metaText} numberOfLines={1}>
          Drop: {order.address.line1}
        </Text>
      </View>
      <View style={styles.meta}>
        <Ionicons name="bag-handle" size={13} color={colors.muted} />
        <Text style={styles.metaText}>
          {itemCount} item{itemCount > 1 ? "s" : ""} · {order.payment_method === "cod" ? `Collect ${inrFromPaise(order.amounts.total)} cash` : "Paid online"}
        </Text>
        {order.distance_km != null ? <Text style={styles.metaText}>· {order.distance_km} km away</Text> : null}
      </View>
      <View style={styles.meta}>
        <Ionicons name="time" size={13} color={colors.muted} />
        <Text style={styles.metaText}>
          {STATUS_LABELS[order.status] ?? order.status} · {dayjs(order.created_at).fromNow()}
        </Text>
      </View>

      {assigned && order.rider ? (
        <Text style={styles.hint} testID={`assigned-hint-${order.id}`}>
          Open it from Home to start the delivery.
        </Text>
      ) : (
        <View style={styles.actions}>
          {busy ? (
            <ActivityIndicator color={colors.brandPrimary} />
          ) : (
            <Pressable
              testID={`accept-${order.id}`}
              style={[styles.primaryBtn, (!online || !!activeOrder) && { opacity: 0.5 }]}
              disabled={!online || !!activeOrder}
              onPress={() => run("accept")}
            >
              <Ionicons name="checkmark-circle" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.primaryText}>{!online ? "Go online to accept" : activeOrder ? "Finish current delivery" : "Accept delivery"}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardAssigned: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  assignedTag: { fontFamily: fonts.displayBold, fontSize: 10, color: colors.brandPrimary, letterSpacing: 0.8, marginBottom: 2 },
  name: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface },
  sub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  earnBox: { alignItems: "flex-end" },
  earn: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: colors.success },
  earnLabel: { fontFamily: fonts.text, fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.onSurfaceSecondary, flexShrink: 1 },
  hint: { fontFamily: fonts.textMedium, fontSize: typeScale.sm, color: colors.brandPrimary },
  actions: { marginTop: spacing.xs, minHeight: 48, justifyContent: "center" },
  primaryBtn: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brandPrimary, borderRadius: radius.md },
  primaryText: { color: colors.onBrandPrimary, fontFamily: fonts.displayBold, fontSize: typeScale.base },
}));
