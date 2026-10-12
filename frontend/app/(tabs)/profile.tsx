import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, ThemeColors, useTheme } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { PrimaryButton, showToast } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  testID: string;
  colors: ThemeColors;
  styles: any;
};

function MenuRow({ icon, label, subtitle, onPress, testID, colors, styles }: RowProps) {
  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSecondary }]}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.brandPrimary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function Profile() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const { user, signOut } = useAuth();
  const { colors } = useTheme();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: 32 + bottomChrome,
        gap: spacing.lg,
      }}
      testID="profile-screen"
    >
      <Text style={styles.title}>Profile</Text>

      {user ? (
        <View style={styles.userCard} testID="profile-user-card">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userMeta}>{user.email}</Text>
            {user.phone ? <Text style={styles.userMeta}>{user.phone}</Text> : null}
          </View>
          <View style={styles.memberBadge}>
            <Ionicons name="star" size={12} color="#FFFFFF" />
            <Text style={styles.memberText}>Gold</Text>
          </View>
        </View>
      ) : (
        <View style={styles.guestCard} testID="profile-guest-card">
          <Text style={styles.guestTitle}>You’re browsing as guest</Text>
          <Text style={styles.guestSubtitle}>
            Log in to save addresses, track orders and check out faster.
          </Text>
          <PrimaryButton
            title="Log In / Sign Up"
            onPress={() => router.push("/login")}
            testID="profile-login-button"
          />
        </View>
      )}

      <View style={styles.section}>
        <MenuRow
          icon="location-outline"
          label="Saved Addresses"
          subtitle="Home, Work and more"
          onPress={() => router.push("/address")}
          testID="profile-addresses-row"
          colors={colors}
          styles={styles}
        />
        <MenuRow
          icon="heart-outline"
          label="Favourites"
          subtitle="Restaurants you love"
          onPress={() => router.push("/favorites")}
          testID="profile-favorites-row"
          colors={colors}
          styles={styles}
        />
        <MenuRow
          icon="receipt-outline"
          label="My Orders"
          subtitle="Track and reorder"
          onPress={() => router.push("/orders")}
          testID="profile-orders-row"
          colors={colors}
          styles={styles}
        />
        <MenuRow
          icon="help-circle-outline"
          label="Help & Support"
          subtitle="FAQs and order help"
          onPress={() => router.push("/help")}
          testID="profile-help-row"
          colors={colors}
          styles={styles}
        />
        <MenuRow
          icon="information-circle-outline"
          label="About DashBite"
          subtitle="Version 1.0.0"
          onPress={() => showToast("DashBite v1.0.0 — made with love and ghee.", "info")}
          testID="profile-about-row"
          colors={colors}
          styles={styles}
        />
      </View>

      {user ? (
        <Pressable
          testID="profile-logout-button"
          style={styles.logout}
          onPress={async () => {
            await signOut();
            showToast("Logged out", "info");
          }}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontFamily: fonts.displayBold, fontSize: typeScale.xxl },
  userName: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: colors.onSurface },
  userMeta: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.warning,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  memberText: { color: "#FFFFFF", fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm },
  guestCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  guestTitle: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: colors.onSurface },
  guestSubtitle: { fontFamily: fonts.text, fontSize: typeScale.base, color: colors.muted, lineHeight: 20 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    minHeight: 56,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg, color: colors.onSurface },
  rowSubtitle: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    minHeight: 52,
  },
  logoutText: { color: colors.error, fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg },
}));
