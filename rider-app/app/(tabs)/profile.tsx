import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { useAuth } from "@/src/context/auth";
import { useRider } from "@/src/context/rider";
import { inrFromPaise } from "@/src/types";

export default function Profile() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rider, signOut } = useAuth();
  const { dashboard, locationState, position } = useRider();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="profile-screen">
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{rider?.name.charAt(0)}</Text>
          </View>
          <Text style={styles.name} testID="profile-name">
            {rider?.name}
          </Text>
          <Text style={styles.sub}>{rider?.email}</Text>
          <View style={[styles.statusPill, { backgroundColor: rider?.online ? colors.success : colors.surfaceTertiary }]}>
            <Text style={[styles.statusText, { color: rider?.online ? colors.onBrandPrimary : colors.muted }]}>{rider?.online ? "ONLINE" : "OFFLINE"}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Row icon="call-outline" label="Phone" value={rider?.phone ?? "—"} />
          <Row icon="bicycle-outline" label="Vehicle" value={rider?.vehicle ?? "—"} />
          <Row icon="checkmark-done-outline" label="Total deliveries" value={String(dashboard?.total_deliveries ?? 0)} />
          <Row icon="wallet-outline" label="Lifetime earnings" value={dashboard ? inrFromPaise(dashboard.total_earnings) : "—"} />
          <Row
            icon="location-outline"
            label="Location sharing"
            value={locationState === "granted" ? (position ? "Active · GPS locked" : "Allowed") : locationState === "blocked" ? "Blocked in settings" : locationState === "denied" ? "Denied" : "Off"}
          />
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
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={18} color={colors.muted} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  hero: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 32, color: colors.onBrandPrimary },
  name: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: colors.onSurface },
  sub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4, marginTop: spacing.xs },
  statusText: { fontFamily: fonts.displayBold, fontSize: 10, letterSpacing: 1 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowLabel: { fontFamily: fonts.text, fontSize: typeScale.base, color: colors.muted, flex: 1 },
  rowValue: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface, maxWidth: "55%" },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  logoutText: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.error },
}));
