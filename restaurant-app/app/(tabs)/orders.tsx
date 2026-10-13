import React, { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { EmptyState } from "@/src/components/ui";
import { OrderCard } from "@/src/components/order-card";
import { OrderActionSheet } from "@/src/components/order-action-sheet";
import { useAuth } from "@/src/context/auth";
import { useOrdersFeed } from "@/src/context/orders-feed";
import type { Order } from "@/src/types";

type Segment = "new" | "kitchen" | "delivery" | "past";
const SEGMENTS: { key: Segment; label: string; statuses: string[] }[] = [
  { key: "new", label: "New", statuses: ["PLACED"] },
  { key: "kitchen", label: "In kitchen", statuses: ["CONFIRMED", "PREPARING"] },
  { key: "delivery", label: "Ready & out", statuses: ["READY", "OUT_FOR_DELIVERY"] },
  { key: "past", label: "Past", statuses: ["DELIVERED", "CANCELLED"] },
];

export default function Orders() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { partner } = useAuth();
  const { orders, loading, connected, refresh, act } = useOrdersFeed();

  const [segment, setSegment] = useState<Segment>("new");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ order: Order; mode: "assign" | "reject" } | null>(null);

  const current = SEGMENTS.find((s) => s.key === segment)!;
  const visible = orders.filter((o) => current.statuses.includes(o.status));
  const counts = Object.fromEntries(
    SEGMENTS.map((s) => [s.key, orders.filter((o) => s.statuses.includes(o.status)).length]),
  ) as Record<Segment, number>;

  const run = async (order: Order, action: "accept" | "preparing" | "ready") => {
    setBusyId(order.id);
    await act(order, action);
    setBusyId(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="orders-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Orders</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {partner?.restaurant.name}
          </Text>
        </View>
        <View style={[styles.liveBadge, { opacity: connected ? 1 : 0.5 }]} testID="live-badge">
          <View style={[styles.liveDot, { backgroundColor: connected ? colors.success : colors.warning }]} />
          <Text style={styles.liveText}>{connected ? "LIVE" : "RECONNECTING"}</Text>
        </View>
      </View>

      <View style={styles.segment} testID="orders-segments">
        {SEGMENTS.map((s) => (
          <Pressable
            key={s.key}
            testID={`segment-${s.key}`}
            style={[styles.segmentBtn, segment === s.key && styles.segmentBtnActive]}
            onPress={() => setSegment(s.key)}
          >
            <Text style={[styles.segmentText, segment === s.key && styles.segmentTextActive]} numberOfLines={1}>
              {s.label}
            </Text>
            {s.key !== "past" && counts[s.key] > 0 ? (
              <View style={[styles.count, s.key === "new" && { backgroundColor: colors.brandPrimary }]}>
                <Text style={[styles.countText, s.key === "new" && { color: colors.onBrandPrimary }]}>{counts[s.key]}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center} testID="orders-loading">
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(o) => o.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              busy={busyId === item.id}
              onAccept={() => run(item, "accept")}
              onPreparing={() => run(item, "preparing")}
              onReady={() => run(item, "ready")}
              onReject={() => setSheet({ order: item, mode: "reject" })}
              onAssign={() => setSheet({ order: item, mode: "assign" })}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={segment === "new" ? "notifications-outline" : "receipt-outline"}
              title={segment === "new" ? "No new orders" : "Nothing here yet"}
              subtitle={segment === "new" ? "New orders will appear here instantly." : "Orders in this stage will show up here."}
              testID={`orders-empty-${segment}`}
            />
          }
        />
      )}

      <OrderActionSheet order={sheet?.order ?? null} mode={sheet?.mode ?? null} onClose={() => setSheet(null)} />
      {!connected && !loading ? (
        <View style={styles.offline} testID="offline-banner">
          <Ionicons name="cloud-offline-outline" size={14} color={colors.onSurfaceInverse} />
          <Text style={styles.offlineText}>Live updates paused · pull to refresh</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
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
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.sm,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 4,
  },
  segmentBtnActive: { backgroundColor: colors.surface },
  segmentText: { fontFamily: fonts.textMedium, fontSize: typeScale.sm, color: colors.muted },
  segmentTextActive: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold },
  count: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  countText: { fontFamily: fonts.displayBold, fontSize: 10, color: colors.onSurfaceSecondary },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  offline: {
    position: "absolute",
    bottom: spacing.lg,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  offlineText: { color: colors.onSurfaceInverse, fontFamily: fonts.textMedium, fontSize: typeScale.sm },
}));
