import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, spacing, typeScale, useTheme } from "@/src/theme";
import { apiFetch } from "@/src/api/client";
import { EmptyState } from "@/src/components/ui";
import { Restaurant, RestaurantCard } from "@/src/components/restaurant-card";
import { useAuth } from "@/src/context/auth";
import { useFavorites } from "@/src/context/favorites";

export default function Favorites() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { ids } = useFavorites();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setLoading(false);
        return;
      }
      (async () => {
        try {
          const data = await apiFetch<{ restaurants: Restaurant[] }>("/api/favorites");
          setRestaurants(data.restaurants);
        } catch {
          // keep stale
        } finally {
          setLoading(false);
        }
      })();
    }, [user]),
  );

  const visible = restaurants.filter((r) => ids.includes(r.id));

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="favorites-screen">
      <View style={styles.header}>
        <Pressable testID="favorites-back" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Favourites</Text>
      </View>

      {!user ? (
        <EmptyState
          icon="heart-outline"
          title="Log in to see favourites"
          subtitle="Save restaurants you love and find them here."
          actionLabel="Log In"
          onAction={() => router.push({ pathname: "/login", params: { redirect: "/favorites" } })}
          testID="favorites-guest"
        />
      ) : loading ? (
        <View style={styles.center} testID="favorites-loading">
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}
          renderItem={({ item }) => <RestaurantCard restaurant={item} />}
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="No favourites yet"
              subtitle="Tap the heart on any restaurant to save it here."
              actionLabel="Browse Restaurants"
              onAction={() => router.replace("/home")}
              testID="favorites-empty"
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
}));
