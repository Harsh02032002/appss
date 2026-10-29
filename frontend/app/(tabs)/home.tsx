import React, { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { apiFetch } from "@/src/api/client";
import { Chip, EmptyState, inr, RatingBadge, showToast } from "@/src/components/ui";
import { Restaurant } from "@/src/components/restaurant-card";
import { MenuItem, MenuItemRow } from "@/src/components/menu-item-row";
import { useAuth } from "@/src/context/auth";
import { useCart } from "@/src/context/cart";
import { useLocationContext } from "@/src/context/location";

const { width } = Dimensions.get("window");

type StoreData = {
  restaurant: Restaurant;
  menu: MenuItem[];
  banners: { title: string; subtitle: string; image: string }[];
};

/** Single-restaurant storefront: hero + bestsellers + full menu, straight on the Home tab. */
export default function Home() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const { user } = useAuth();
  const { location } = useLocationContext();
  const cart = useCart();
  const { count, subtotal, restaurantName } = cart;

  const [store, setStore] = useState<StoreData | null>(null);
  const [category, setCategory] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setStore(await apiFetch<StoreData>("/api/restaurant"));
      setError("");
    } catch (e: any) {
      setError(e.message || "Unable to load the menu. Please check connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const restaurant = store?.restaurant;
  const categories = Array.from(new Set((store?.menu ?? []).map((m) => m.category)));
  const visible = (store?.menu ?? []).filter((m) => (!category || m.category === category) && (!vegOnly || m.veg));
  const bestsellers = (store?.menu ?? []).filter((m) => m.bestseller && m.available !== false).slice(0, 6);

  const add = (item: MenuItem) => {
    if (!restaurant) return;
    if (restaurant.is_open === false) {
      showToast(`${restaurant.name} is currently closed`, "error");
      return;
    }
    cart.addItem({ id: item.id, name: item.name, price: item.price, image: item.image, veg: item.veg }, { id: restaurant.id, name: restaurant.name });
  };

  return (
    <View style={styles.container} testID="home-screen">
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable testID="home-location-button" style={styles.locationBtn} onPress={() => router.push("/address")}>
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
          <Pressable testID="home-profile-button" style={styles.avatar} onPress={() => router.push("/profile")}>
            <Ionicons name={user ? "person" : "person-outline"} size={20} color="#D95325" />
          </Pressable>
        </View>
        <Pressable testID="home-search-bar" style={styles.searchBar} onPress={() => router.push("/search")}>
          <Ionicons name="search" size={18} color="#7A746A" />
          <Text style={styles.searchPlaceholder}>Search our menu — biryani, kebabs, desserts...</Text>
        </Pressable>
      </View>

      {/* Menu category chips */}
      <View style={styles.chipRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent}>
          <Chip label="All" active={category === ""} onPress={() => setCategory("")} testID="category-chip-all" />
          <Chip label="Veg" icon="leaf" active={vegOnly} onPress={() => setVegOnly((v) => !v)} testID="category-chip-veg" />
          {categories.map((c) => (
            <Chip
              key={c}
              label={c}
              active={category === c}
              onPress={() => setCategory(category === c ? "" : c)}
              testID={`category-chip-${c.toLowerCase().replace(/\s+/g, "-")}`}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center} testID="home-loading">
          <ActivityIndicator color="#D95325" size="large" />
        </View>
      ) : error || !restaurant ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Unable to load menu"
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
          data={visible}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MenuItemRow item={item} qty={cart.getQty(item.id)} onAdd={() => add(item)} onInc={() => cart.increment(item.id)} onDec={() => cart.decrement(item.id)} />
          )}
          contentContainerStyle={styles.list}
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
              <Text style={styles.greeting}>{user ? `Hungry, ${user.name.split(" ")[0]}?` : "What are you craving?"}</Text>

              {/* Restaurant hero */}
              <View style={styles.storeCard} testID="store-card">
                <Image source={{ uri: restaurant.image }} style={styles.storeImage} contentFit="cover" transition={200} />
                <View style={styles.storeScrim} />
                <View style={styles.storeCopy}>
                  <View style={styles.storeTop}>
                    <Text style={styles.storeName} numberOfLines={1}>
                      {restaurant.name}
                    </Text>
                    <RatingBadge rating={restaurant.rating} />
                  </View>
                  <Text style={styles.storeMeta} numberOfLines={1}>
                    {restaurant.cuisines.join(" • ")} · {restaurant.delivery_time} · {restaurant.address}
                  </Text>
                  {restaurant.is_open === false ? (
                    <View style={styles.closedPill} testID="store-closed">
                      <Ionicons name="moon" size={12} color="#FFFFFF" />
                      <Text style={styles.pillText}>Currently closed · not accepting orders</Text>
                    </View>
                  ) : restaurant.offer ? (
                    <View style={styles.offerPill}>
                      <Ionicons name="pricetag" size={12} color="#FFFFFF" />
                      <Text style={styles.pillText}>{restaurant.offer}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {store?.banners?.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
                  {store.banners.map((b, i) => (
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
              ) : null}

              {!category && !vegOnly && bestsellers.length ? (
                <>
                  <Text style={styles.sectionTitle}>Bestsellers</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }} testID="bestsellers">
                    {bestsellers.map((m) => (
                      <Pressable key={m.id} testID={`bestseller-${m.id}`} style={styles.bestCard} onPress={() => router.push(`/item/${m.id}`)}>
                        <Image source={{ uri: m.image }} style={styles.bestImage} contentFit="cover" />
                        <Text style={styles.bestName} numberOfLines={1}>
                          {m.name}
                        </Text>
                        <View style={styles.bestRow}>
                          <Text style={styles.bestPrice}>{inr(m.price)}</Text>
                          <Pressable testID={`bestseller-add-${m.id}`} style={styles.bestAdd} onPress={() => add(m)} hitSlop={8}>
                            <Ionicons name="add" size={16} color="#D95325" />
                          </Pressable>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              <Text style={styles.sectionTitle}>
                {category || "Full menu"}
                {vegOnly ? " · Veg" : ""}
              </Text>
            </View>
          }
          ListEmptyComponent={<EmptyState icon="restaurant-outline" title="No dishes here" subtitle="Try another category or turn off the veg filter." testID="home-empty" />}
        />
      )}

      {count > 0 ? (
        <Pressable testID="view-cart-bar" style={[styles.cartBar, { bottom: bottomChrome + 16 }]} onPress={() => router.push("/cart")}>
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
  header: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  locationBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1, minHeight: 44 },
  locationText: { flex: 1 },
  locationLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationLabel: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface, flexShrink: 1 },
  locationSub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
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
  listHeader: { gap: spacing.lg, marginBottom: spacing.sm },
  greeting: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  storeCard: { height: 170, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  storeImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  storeScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" },
  storeCopy: { flex: 1, justifyContent: "flex-end", padding: spacing.lg, gap: 4 },
  storeTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  storeName: { flex: 1, color: "#FFFFFF", fontFamily: fonts.displayBold, fontSize: typeScale.xl, letterSpacing: -0.3 },
  storeMeta: { color: "#FFFFFF", opacity: 0.9, fontFamily: fonts.text, fontSize: typeScale.sm },
  offerPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, marginTop: 4 },
  closedPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.error, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, marginTop: 4 },
  pillText: { color: "#FFFFFF", fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm },
  bestCard: { width: 140, gap: 2 },
  bestImage: { width: 140, height: 110, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  bestName: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface, marginTop: 6 },
  bestRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bestPrice: { fontFamily: fonts.textMedium, fontSize: typeScale.sm, color: colors.onSurfaceSecondary },
  bestAdd: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  banner: { width: width * 0.78, height: 150, borderRadius: radius.lg, overflow: "hidden" },
  bannerImage: { width: "100%", height: "100%" },
  bannerScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(26,25,23,0.42)" },
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
