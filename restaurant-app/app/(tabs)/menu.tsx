import React, { useCallback, useState } from "react";
import { ActivityIndicator, SectionList, Switch, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { apiFetch } from "@/src/api/client";
import { EmptyState, inr, showToast, VegBadge } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import type { MenuItem } from "@/src/types";

export default function Menu() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { partner } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!partner) return;
      apiFetch<{ menu: MenuItem[] }>("/api/partner/menu")
        .then((d) => setItems(d.menu))
        .catch((e) => setError(e.message || "Could not load menu"))
        .finally(() => setLoading(false));
    }, [partner]),
  );

  const toggle = async (item: MenuItem, available: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available } : i)));
    try {
      await apiFetch(`/api/partner/menu/${item.id}`, { method: "PATCH", body: JSON.stringify({ available }) });
      showToast(`${item.name} marked ${available ? "available" : "out of stock"}`, "success");
    } catch (e: any) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available: !available } : i)));
      showToast(e.message || "Update failed", "error");
    }
  };

  const sections = Object.entries(
    items.reduce<Record<string, MenuItem[]>>((acc, i) => {
      (acc[i.category] ||= []).push(i);
      return acc;
    }, {}),
  ).map(([title, data]) => ({ title, data }));
  const outOfStock = items.filter((i) => !i.available).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="menu-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <Text style={styles.subtitle} testID="menu-summary">
          {items.length} items · {outOfStock} out of stock
        </Text>
      </View>

      {loading ? (
        <View style={styles.center} testID="menu-loading">
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load menu" subtitle={error} testID="menu-error" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}
          renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
          renderItem={({ item }) => (
            <View style={[styles.row, !item.available && styles.rowOff]} testID={`menu-row-${item.id}`}>
              <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.nameRow}>
                  <VegBadge veg={item.veg} />
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <Text style={styles.price}>{inr(item.price)}</Text>
                <Text style={[styles.state, { color: item.available ? colors.success : colors.error }]}>
                  {item.available ? "Available" : "Out of stock"}
                </Text>
              </View>
              <Switch
                testID={`menu-toggle-${item.id}`}
                value={item.available}
                onValueChange={(v) => toggle(item, v)}
                trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }}
                thumbColor={colors.surface}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  list: { paddingHorizontal: spacing.lg },
  section: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowOff: { opacity: 0.7 },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface, flex: 1 },
  price: { fontFamily: fonts.textMedium, fontSize: typeScale.sm, color: colors.onSurfaceSecondary },
  state: { fontFamily: fonts.textMedium, fontSize: 11 },
}));
