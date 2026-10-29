import React, { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { useAuth } from "@/src/context/auth";
import { useRider } from "@/src/context/rider";
import { ActiveDeliveryCard } from "@/src/components/active-delivery-card";
import { LocationBanner } from "@/src/components/location-banner";
import { RequestCard } from "@/src/components/request-card";
import { inrFromPaise } from "@/src/types";

export default function Home() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rider } = useAuth();
  const { dashboard, requests, assigned, activeOrder, loading, connected, refresh, setOnline, position } = useRider();
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const online = dashboard?.rider.online ?? rider?.online ?? false;

  const toggle = async (v: boolean) => {
    setToggling(true);
    await setOnline(v);
    setToggling(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="home-screen">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
            tintColor={colors.brandPrimary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hi, {rider?.name.split(" ")[0]} 👋</Text>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: connected ? colors.success : colors.warning }]} />
              <Text style={styles.liveText}>{connected ? "Live" : "Reconnecting…"}</Text>
              {position ? <Text style={styles.liveText}> · GPS locked</Text> : null}
            </View>
          </View>
          <View style={[styles.onlineCard, online && styles.onlineCardOn]} testID="online-card">
            <Text style={[styles.onlineLabel, online && { color: colors.onBrandPrimary }]} testID="online-status">
              {online ? "ONLINE" : "OFFLINE"}
            </Text>
            {toggling ? (
              <ActivityIndicator color={online ? colors.onBrandPrimary : colors.brandPrimary} />
            ) : (
              <Switch testID="online-toggle" value={online} onValueChange={toggle} trackColor={{ true: "rgba(255,255,255,0.5)", false: colors.borderStrong }} thumbColor={colors.surface} />
            )}
          </View>
        </View>

        <LocationBanner />

        {/* Active delivery */}
        {activeOrder ? (
          <ActiveDeliveryCard order={activeOrder} />
        ) : !online ? (
          <View style={styles.offlineCard} testID="offline-card">
            <Ionicons name="moon" size={22} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineTitle}>You&apos;re offline</Text>
              <Text style={styles.offlineSub}>Go online to see nearby delivery requests and start earning.</Text>
            </View>
          </View>
        ) : null}

        {/* Stats */}
        <View style={styles.grid}>
          <Stat icon="cash" label="Today's earnings" value={dashboard ? inrFromPaise(dashboard.today_earnings) : "—"} testID="stat-today-earnings" accent />
          <Stat icon="checkmark-done" label="Deliveries today" value={dashboard ? String(dashboard.today_deliveries) : "—"} testID="stat-today-deliveries" />
          <Stat icon="notifications" label="Open requests" value={dashboard ? String(dashboard.pending_requests) : "—"} testID="stat-requests" onPress={() => router.push("/requests")} />
          <Stat icon="wallet" label="Lifetime earnings" value={dashboard ? inrFromPaise(dashboard.total_earnings) : "—"} testID="stat-total-earnings" onPress={() => router.push("/history")} />
        </View>

        {/* Assigned to me by restaurant (not yet active in dashboard until accepted? they are active) */}
        {assigned.filter((o) => o.id !== activeOrder?.id).map((o) => (
          <RequestCard key={o.id} order={o} assigned />
        ))}

        {/* Requests preview */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Nearby requests</Text>
          <Pressable testID="see-all-requests" onPress={() => router.push("/requests")} hitSlop={8}>
            <Text style={styles.link}>See all</Text>
          </Pressable>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} />
        ) : requests.length === 0 ? (
          <View style={styles.empty} testID="requests-empty-home">
            <Ionicons name="bicycle-outline" size={28} color={colors.muted} />
            <Text style={styles.emptyText}>No open requests right now. New ones appear instantly.</Text>
          </View>
        ) : (
          requests.slice(0, 2).map((o) => <RequestCard key={o.id} order={o} />)
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ icon, label, value, testID, accent, onPress }: { icon: string; label: string; value: string; testID: string; accent?: boolean; onPress?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} style={[styles.stat, accent && styles.statAccent]} onPress={onPress} disabled={!onPress}>
      <Ionicons name={icon as any} size={18} color={accent ? colors.brandPrimary : colors.muted} />
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  greeting: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  onlineCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingLeft: spacing.md, paddingRight: 6, paddingVertical: 4, minHeight: 44 },
  onlineCardOn: { backgroundColor: colors.success, borderColor: colors.success },
  onlineLabel: { fontFamily: fonts.displayBold, fontSize: typeScale.sm, color: colors.muted, letterSpacing: 0.8 },
  offlineCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg },
  offlineTitle: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface },
  offlineSub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  stat: { width: "47%", flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs, minHeight: 96 },
  statAccent: { backgroundColor: colors.brandTertiary, borderColor: colors.brandTertiary },
  statValue: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: colors.onSurface },
  statLabel: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface },
  link: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm, color: colors.brandPrimary },
  empty: { alignItems: "center", gap: spacing.sm, padding: spacing.xl, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: radius.lg },
  emptyText: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, textAlign: "center" },
}));
