import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { apiFetch } from "@/src/api/client";
import { inr, showToast } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useOrdersFeed } from "@/src/context/orders-feed";
import type { Dashboard as DashboardData } from "@/src/types";

export default function Dashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { partner, signOut, setRestaurant } = useAuth();
  const { orders } = useOrdersFeed();
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<DashboardData>("/api/partner/dashboard");
      setData(d);
      setRestaurant({ is_open: d.restaurant.is_open });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, orders.length]),
  );

  const toggleOpen = async (is_open: boolean) => {
    setToggling(true);
    try {
      const r = await apiFetch<{ is_open: boolean }>("/api/partner/restaurant", { method: "PATCH", body: JSON.stringify({ is_open }) });
      setRestaurant({ is_open: r.is_open });
      setData((d) => (d ? { ...d, restaurant: { ...d.restaurant, is_open: r.is_open } } : d));
      showToast(r.is_open ? "You're open and accepting orders" : "Restaurant closed · new orders paused", r.is_open ? "success" : "info");
    } catch (e: any) {
      showToast(e.message || "Update failed", "error");
    } finally {
      setToggling(false);
    }
  };

  const isOpen = partner?.restaurant.is_open ?? true;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="dashboard-screen">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.brandPrimary}
          />
        }
      >
        <Text style={styles.title}>Dashboard</Text>

        {/* Restaurant card */}
        <View style={styles.restCard} testID="restaurant-card">
          <Image source={{ uri: partner?.restaurant.image }} style={styles.restImage} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.restName} numberOfLines={1}>
              {partner?.restaurant.name}
            </Text>
            <Text style={styles.restMeta} numberOfLines={1}>
              {partner?.restaurant.cuisines.join(" • ")}
            </Text>
            <View style={styles.openRow}>
              <View style={[styles.openDot, { backgroundColor: isOpen ? colors.success : colors.error }]} />
              <Text style={[styles.openText, { color: isOpen ? colors.success : colors.error }]} testID="open-status">
                {isOpen ? "Open · accepting orders" : "Closed"}
              </Text>
            </View>
          </View>
          {toggling ? (
            <ActivityIndicator color={colors.brandPrimary} />
          ) : (
            <Switch
              testID="open-toggle"
              value={isOpen}
              onValueChange={toggleOpen}
              trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }}
              thumbColor={colors.surface}
            />
          )}
        </View>

        {/* Stats */}
        <View style={styles.grid}>
          <Stat icon="receipt" label="Orders today" value={data ? String(data.today_orders) : "—"} testID="stat-today-orders" />
          <Stat icon="cash" label="Revenue today" value={data ? inr(data.today_revenue) : "—"} testID="stat-revenue" />
          <Stat
            icon="notifications"
            label="Awaiting action"
            value={data ? String(data.pending) : "—"}
            accent={!!data && data.pending > 0}
            testID="stat-pending"
            onPress={() => router.push("/orders")}
          />
          <Stat icon="flame" label="Active orders" value={data ? String(data.active) : "—"} testID="stat-active" />
          <Stat
            icon="star"
            label="Avg rating"
            value={data?.avg_rating != null ? `${data.avg_rating.toFixed(1)} (${data.review_count})` : "No ratings"}
            testID="stat-rating"
          />
          <Stat icon="checkmark-done" label="Delivered (all time)" value={data ? String(data.delivered_total) : "—"} testID="stat-delivered" />
        </View>

        {/* Account */}
        <View style={styles.accountCard}>
          <View style={styles.accountRow}>
            <Ionicons name="person-circle-outline" size={22} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>{partner?.name}</Text>
              <Text style={styles.accountEmail}>{partner?.email}</Text>
            </View>
          </View>
          <Pressable
            testID="logout-button"
            style={styles.logout}
            onPress={async () => {
              await signOut();
              router.replace("/login");
            }}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
  testID,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: boolean;
  testID: string;
  onPress?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} style={[styles.stat, accent && styles.statAccent]} onPress={onPress} disabled={!onPress}>
      <Ionicons name={icon as any} size={18} color={accent ? colors.onBrandPrimary : colors.brandPrimary} />
      <Text style={[styles.statValue, accent && { color: colors.onBrandPrimary }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, accent && { color: colors.onBrandPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  restCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  restImage: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  restName: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface },
  restMeta: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  openRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  openDot: { width: 8, height: 8, borderRadius: 4 },
  openText: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  stat: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    minHeight: 96,
  },
  statAccent: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  statValue: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: colors.onSurface },
  statLabel: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  accountCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  accountRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  accountName: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  accountEmail: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  logoutText: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.error },
}));
