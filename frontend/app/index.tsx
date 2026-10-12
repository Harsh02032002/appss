import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, spacing, typeScale } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export default function Splash() {
  const router = useRouter();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const seen = await storage.getItem("dashbite_onboarded", false);
      await new Promise((r) => setTimeout(r, 1200));
      if (mounted) router.replace(seen ? "/home" : "/onboarding");
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]} testID="splash-screen">
      <View style={styles.center}>
        <View style={styles.logoMark}>
          <Ionicons name="fast-food" size={44} color="#FFFFFF" />
        </View>
        <Text style={styles.brand}>DashBite</Text>
        <Text style={styles.tagline}>Crave. Tap. Delivered.</Text>
      </View>
      <View style={styles.footer}>
        <ActivityIndicator color="#D95325" />
        <Text style={styles.footerText}>From our kitchen partners to your door</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  logoMark: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brandSecondary,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  brand: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.onSurface, letterSpacing: -0.5 },
  tagline: { fontFamily: fonts.text, fontSize: typeScale.lg, color: colors.muted },
  footer: { alignItems: "center", gap: spacing.sm, paddingBottom: spacing.xl },
  footerText: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
}));
