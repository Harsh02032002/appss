import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import dayjs from "dayjs";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { apiFetch } from "@/src/api/client";
import { EmptyState } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useRider } from "@/src/context/rider";
import { Order, inrFromPaise } from "@/src/types";

export default function History() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { rider } = useAuth();
  const { dashboard } = useRider();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!rider) return;
      apiFetch<{ orders: Order[] }>("/api/rider/history")
        .then((d) => setOrders(d.orders))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [rider]),
  );

  const delivered = orders.filter((o) => o.status === "DELIVERED");
  const pendingPayout = delivered.filter((o) => o.payout_status !== "paid").reduce((s, o) => s + (o.earning ?? 0), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="history-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Earnings</Text>
      </View>

      <View style={styles.summary} testID="earnings-summary">
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryLabel}>Total earned</Text>
          <Text style={styles.summaryValue}>{dashboard ? inrFromPaise(dashboard.total_earnings) : "—"}</Text>
          <Text style={styles.summarySub}>{dashboard?.total_deliveries ?? 0} deliveries · delivery fee + tips</Text>
        </View>
        <View style={styles.payoutBox}>
          <Text style={styles.payoutLabel}>Pending payout</Text>
          <Text style={styles.payoutValue}>{inrFromPaise(pendingPayout)}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`history-row-${item.id}`}>
              <View style={[styles.icon, { backgroundColor: item.status === "DELIVERED" ? colors.brandTertiary : colors.surfaceTertiary }]}>
                <Ionicons name={item.status === "DELIVERED" ? "checkmark-done" : "close"} size={18} color={item.status === "DELIVERED" ? colors.brandPrimary : colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.restaurant.name} → {item.address.label}
                </Text>
                <Text style={styles.rowSub}>
                  {dayjs(item.delivered_at ?? item.created_at).format("D MMM, h:mm A")} · {item.status === "DELIVERED" ? "Delivered" : "Cancelled"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.amount, item.status !== "DELIVERED" && { color: colors.muted }]}>{item.status === "DELIVERED" ? `+${inrFromPaise(item.earning ?? 0)}` : "₹0"}</Text>
                {item.status === "DELIVERED" ? (
                  <Text style={[styles.payout, { color: item.payout_status === "paid" ? colors.success : colors.warning }]}>{item.payout_status === "paid" ? "Paid" : "Payout pending"}</Text>
                ) : null}
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="wallet-outline" title="No deliveries yet" subtitle="Your completed deliveries and earnings will appear here." testID="history-empty" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  summary: { marginHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.lg, padding: spacing.lg },
  summaryLabel: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.onBrandPrimary, opacity: 0.9 },
  summaryValue: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.onBrandPrimary, letterSpacing: -0.5 },
  summarySub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.onBrandPrimary, opacity: 0.85 },
  payoutBox: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: radius.md, padding: spacing.md, alignItems: "flex-end" },
  payoutLabel: { fontFamily: fonts.text, fontSize: 11, color: colors.onBrandPrimary },
  payoutValue: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onBrandPrimary },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, flexGrow: 1 },
  sep: { height: 1, backgroundColor: colors.divider },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  rowSub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, marginTop: 2 },
  amount: { fontFamily: fonts.displayBold, fontSize: typeScale.base, color: colors.success },
  payout: { fontFamily: fonts.textMedium, fontSize: 11, marginTop: 2 },
}));
