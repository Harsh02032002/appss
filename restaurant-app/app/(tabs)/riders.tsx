import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import dayjs from "dayjs";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { apiFetch } from "@/src/api/client";
import { EmptyState, inr, showToast } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";

type RiderPayout = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  online: boolean;
  status: string;
  pending_amount: number;
  pending_count: number;
  paid_amount: number;
  delivered_count: number;
  last_payout: { amount: number; at: string } | null;
};

export default function Riders() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { partner } = useAuth();
  const [riders, setRiders] = useState<RiderPayout[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!partner) return;
    try {
      const d = await apiFetch<{ riders: RiderPayout[]; total_pending: number }>("/api/partner/payouts");
      setRiders(d.riders);
      setTotalPending(d.total_pending);
    } catch {}
    setLoading(false);
  }, [partner]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const settle = async (r: RiderPayout) => {
    const msg = `Pay ${inr(r.pending_amount)} to ${r.name} for ${r.pending_count} deliver${r.pending_count > 1 ? "ies" : "y"}?`;
    const ok =
      Platform.OS === "web"
        ? window.confirm(msg)
        : await new Promise<boolean>((resolve) =>
            Alert.alert("Mark as paid", msg, [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Mark paid", onPress: () => resolve(true) },
            ]),
          );
    if (!ok) return;
    setSettling(r.id);
    try {
      const res = await apiFetch<{ amount: number }>(`/api/partner/payouts/${r.id}/settle`, { method: "POST" });
      showToast(`Paid ${inr(res.amount)} to ${r.name}`, "success");
      await load();
    } catch (e: any) {
      showToast(e.message || "Settlement failed", "error");
    } finally {
      setSettling(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="riders-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Riders & payouts</Text>
        <Text style={styles.subtitle} testID="total-pending">
          {inr(totalPending)} pending across {riders.filter((r) => r.pending_amount > 0).length} rider{riders.filter((r) => r.pending_amount > 0).length === 1 ? "" : "s"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={riders}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
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
          renderItem={({ item }) => (
            <View style={styles.card} testID={`rider-payout-${item.id}`}>
              <View style={styles.top}>
                <View style={styles.avatar}>
                  <Ionicons name="bicycle" size={18} color={colors.onBrandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.sub}>
                    {item.vehicle} · {item.delivered_count} deliveries
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: item.online ? colors.brandTertiary : colors.surfaceTertiary }]}>
                  <Text style={[styles.pillText, { color: item.online ? colors.brandPrimary : colors.muted }]}>{item.online ? (item.status === "busy" ? "On delivery" : "Online") : "Offline"}</Text>
                </View>
              </View>

              <View style={styles.amounts}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.amtLabel}>Pending</Text>
                  <Text style={[styles.amt, { color: item.pending_amount > 0 ? colors.warning : colors.muted }]} testID={`pending-${item.id}`}>
                    {inr(item.pending_amount)}
                  </Text>
                  <Text style={styles.sub}>{item.pending_count} unpaid</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.amtLabel}>Settled</Text>
                  <Text style={[styles.amt, { color: colors.success }]}>{inr(item.paid_amount)}</Text>
                  <Text style={styles.sub}>{item.last_payout ? `Last ${dayjs(item.last_payout.at).format("D MMM")}` : "No payouts yet"}</Text>
                </View>
              </View>

              <Pressable
                testID={`settle-${item.id}`}
                style={[styles.payBtn, (item.pending_amount === 0 || settling === item.id) && styles.payBtnDisabled]}
                disabled={item.pending_amount === 0 || settling === item.id}
                onPress={() => settle(item)}
              >
                {settling === item.id ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <>
                    <Ionicons name="cash-outline" size={18} color={colors.onBrandPrimary} />
                    <Text style={styles.payText}>{item.pending_amount > 0 ? `Mark ${inr(item.pending_amount)} as paid` : "All settled"}</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="bicycle-outline" title="No riders yet" testID="riders-empty" />}
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
  subtitle: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  list: { paddingHorizontal: spacing.lg, flexGrow: 1 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface },
  sub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  pillText: { fontFamily: fonts.displaySemiBold, fontSize: 11 },
  amounts: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  amtLabel: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  amt: { fontFamily: fonts.displayBold, fontSize: typeScale.xl },
  payBtn: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brandPrimary, borderRadius: radius.md },
  payBtnDisabled: { backgroundColor: colors.borderStrong },
  payText: { color: colors.onBrandPrimary, fontFamily: fonts.displayBold, fontSize: typeScale.base },
}));
