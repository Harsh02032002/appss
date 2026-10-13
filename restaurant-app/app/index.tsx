import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, spacing, typeScale, useTheme } from "@/src/theme";
import { useAuth } from "@/src/context/auth";

export default function Splash() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { partner, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => router.replace(partner ? "/orders" : "/login"), 600);
    return () => clearTimeout(t);
  }, [loading, partner, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <View style={styles.logoMark}>
        <Ionicons name="storefront" size={40} color={colors.onBrandPrimary} />
      </View>
      <Text style={styles.brand}>DashBite Partner</Text>
      <Text style={styles.tagline}>Manage orders. Delight customers.</Text>
      <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  logoMark: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  brand: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.onSurface, letterSpacing: -0.5 },
  tagline: { fontFamily: fonts.text, fontSize: typeScale.lg, color: colors.muted },
}));
