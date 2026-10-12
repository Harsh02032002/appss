import React, { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { apiFetch } from "@/src/api/client";
import { Chip, EmptyState, inr } from "@/src/components/ui";
import { RestaurantCard, Restaurant } from "@/src/components/restaurant-card";
import { useAuth } from "@/src/context/auth";
import { useCart } from "@/src/context/cart";
import { useLocationContext } from "@/src/context/location";

const { width } = Dimensions.get("window");

type HomeData = {
  categories: { name: string; image: string }[];
  banners: { title: string; subtitle: string; image: string }[];
};

export default function Home() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const { user } = useAuth();
  const { location } = useLocationContext();
  const { count, subtotal, restaurantName } = useCart();

  const [home, setHome] = useState<HomeData | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [cuisine, setCuisine] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const qs = cuisine ? `?cuisine=${encodeURIComponent(cuisine)}` : "";
      const [h, r] = await Promise.all([
        apiFetch<HomeData>("/api/home"),
        apiFetch<{ restaurants: Restaurant[] }>(`/api/restaurants${qs}`),
      ]);
      setHome(h);
      setRestaurants(r.restaurants);
      setError("");
    } catch (e: any) {
      setError(e.message || "Unable to load home feed. Please check connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuisine]);

  return (
    <View style={styles.container} testID="home-screen">
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable
            testID="home-location-button"
            style={styles.locationBtn}
            onPress={() => router.push("/address")}
          >
            <Ionicons name="location" size={20} color="#D95325" />
            <View style={styles.locationText}>
              <View style={styles.locationLabelRow}>
                <Text style={styles.locationLabel} numberOfLines={1}>
                  {location.label}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#1A1917" />
              </View>
              <Text style={styles.locationSub} numberOfLines={1}>
                {location.sublabel}
              </Text>
            </View>
          </Pressable>
          <Pressable
            testID="home-profile-button"
            style={styles.avatar}
            onPress={() => router.push("/profile")}
          >
            <Ionicons name={user ? "person" : "person-outline"} size={20} color="#D95325" />
          </Pressable>
        </View>
        <Pressable testID="home-search-bar" style={styles.searchBar} onPress={() => router.push("/search")}>
          <Ionicons name="search" size={18} color="#7A746A" />
          <Text style={styles.searchPlaceholder}>Search for biryani, pizza, desserts...</Text>
        </Pressable>
      </View>

      {/* Category chips (single horizontal row, sticky above list) */}
      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRowContent}
        >
          <Chip
            label="All"
            active={cuisine === ""}
            onPress={() => setCuisine("")}
            testID="category-chip-all"
          />
          {(home?.categories ?? []).map((c) => (
            <Chip
              key={c.name}
              label={c.name}
              active={cuisine === c.name}
              onPress={() => setCuisine(cuisine === c.name ? "" : c.name)}
              testID={`category-chip-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center} testID="home-loading">
          <ActivityIndicator color="#D95325" size="large" />
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Unable to load feed"
          subtitle={error}
          actionLabel="Retry"
          onAction={() => {
            setLoading(true);
            load();
          }}
          testID="home-error"
        />
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <RestaurantCard restaurant={item} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor="#D95325"
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.greeting}>
                {user ? `Hungry, ${user.name.split(" ")[0]}?` : "What are you craving?"}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}
              >
                {(home?.banners ?? []).map((b, i) => (
                  <View key={i} style={styles.banner} testID={`banner-${i}`}>
                    <Image source={{ uri: b.image }} style={styles.bannerImage} contentFit="cover" />
                    <View style={styles.bannerScrim} />
                    <View style={styles.bannerCopy}>
                      <Text style={styles.bannerTitle}>{b.title}</Text>
                      <Text style={styles.bannerSubtitle}>{b.subtitle}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <Text style={styles.sectionTitle}>
                {cuisine ? `${cuisine} spots near you` : "All restaurants near you"}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="restaurant-outline"
              title="No restaurants found"
              subtitle="No restaurants available in your delivery zone for this filter."
              testID="home-empty"
            />
          }
        />
      )}

      {count > 0 ? (
        <Pressable
          testID="view-cart-bar"
          style={[styles.cartBar, { bottom: bottomChrome + 16 }]}
          onPress={() => router.push("/cart")}
        >
          <View>
            <Text style={styles.cartBarMeta}>
              {count} item{count > 1 ? "s" : ""} | {inr(subtotal)}
            </Text>
            <Text style={styles.cartBarRestaurant} numberOfLines={1}>
              {restaurantName}
            </Text>
          </View>
          <View style={styles.cartBarRight}>
            <Text style={styles.cartBarAction}>View Cart</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  locationBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1, minHeight: 44 },
  locationText: { flex: 1 },
  locationLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationLabel: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface, flexShrink: 1 },
  locationSub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  searchPlaceholder: { fontFamily: fonts.text, fontSize: typeScale.base, color: colors.muted, flex: 1 },
  chipRow: { height: 56, justifyContent: "center" },
  chipRowContent: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  listHeader: { gap: spacing.lg, marginBottom: spacing.lg },
  greeting: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  banner: { width: width * 0.78, height: 150, borderRadius: radius.lg, overflow: "hidden" },
  bannerImage: { width: "100%", height: "100%" },
  bannerScrim: { position: "absolute", inset: 0, backgroundColor: "rgba(26,25,23,0.42)" } as any,
  bannerCopy: { position: "absolute", left: spacing.lg, bottom: spacing.lg, right: spacing.lg },
  bannerTitle: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: "#FFFFFF" },
  bannerSubtitle: { fontFamily: fonts.text, fontSize: typeScale.sm, color: "#FDFBF7", marginTop: 2 },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: colors.onSurface },
  cartBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: colors.brandSecondary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cartBarMeta: { color: "#FFFFFF", fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm },
  cartBarRestaurant: { color: "#FBEAE5", fontFamily: fonts.text, fontSize: typeScale.sm, maxWidth: 160 },
  cartBarRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  cartBarAction: { color: "#FFFFFF", fontFamily: fonts.displayBold, fontSize: typeScale.base },
}));
