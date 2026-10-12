import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { apiFetch } from "@/src/api/client";
import { Chip, EmptyState, inr, RatingBadge, showToast } from "@/src/components/ui";
import { FavoriteButton } from "@/src/components/favorite-button";
import { MenuItem, MenuItemRow } from "@/src/components/menu-item-row";
import { Restaurant } from "@/src/components/restaurant-card";
import { useCart } from "@/src/context/cart";

type Review = { id: string; user_name: string; rating: number; comment: string; created_at: string };
type RestaurantPayload = { restaurant: Restaurant; menu: MenuItem[]; reviews: Review[] };

export default function RestaurantDetails() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cart = useCart();

  const [data, setData] = useState<RestaurantPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [activeCat, setActiveCat] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const chipsY = useRef(0);

  const load = async () => {
    try {
      const d = await apiFetch<RestaurantPayload>(`/api/restaurants/${id}`);
      setData(d);
      setError("");
    } catch (e: any) {
      setError(e.message || "Failed to load restaurant profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]} testID="restaurant-loading">
        <ActivityIndicator color="#D95325" size="large" />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't load restaurant"
          subtitle={error}
          actionLabel="Retry"
          onAction={() => {
            setLoading(true);
            load();
          }}
          testID="restaurant-error"
        />
      </View>
    );
  }

  const { restaurant, menu, reviews } = data;
  const filteredMenu = vegOnly ? menu.filter((m) => m.veg) : menu;
  const categories: string[] = [];
  const grouped: Record<string, MenuItem[]> = {};
  for (const item of filteredMenu) {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
      categories.push(item.category);
    }
    grouped[item.category].push(item);
  }

  const add = (item: MenuItem) => {
    const result = cart.addItem(
      { id: item.id, name: item.name, price: item.price, image: item.image, veg: item.veg },
      { id: restaurant.id, name: restaurant.name },
    );
    if (result === "replaced") showToast("Started a new cart with this restaurant", "info");
  };

  return (
    <View style={styles.container} testID="restaurant-screen">
      <Pressable
        testID="restaurant-back"
        style={[styles.backBtn, { top: insets.top + spacing.sm }]}
        onPress={() => router.back()}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={20} color="#1A1917" />
      </Pressable>
      <View style={[styles.heartBtn, { top: insets.top + spacing.sm }]}>
        <FavoriteButton restaurantId={restaurant.id} size={40} />
      </View>

      <ScrollView ref={scrollRef} stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
        <View>
          <Image source={{ uri: restaurant.image }} style={styles.hero} contentFit="cover" transition={200} />
          <View style={styles.infoCard} testID="restaurant-info">
            <View style={styles.infoTop}>
              <Text style={styles.name}>{restaurant.name}</Text>
              <RatingBadge rating={restaurant.rating} />
            </View>
            <Text style={styles.cuisines}>{restaurant.cuisines.join(" • ")}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color="#7A746A" />
              <Text style={styles.meta}>{restaurant.delivery_time}</Text>
              <View style={styles.dot} />
              <Ionicons name="location-outline" size={14} color="#7A746A" />
              <Text style={styles.meta}>{restaurant.address}</Text>
            </View>
            {restaurant.offer ? (
              <View style={styles.offerRow}>
                <Ionicons name="pricetag" size={13} color="#D95325" />
                <Text style={styles.offerText}>{restaurant.offer}</Text>
              </View>
            ) : null}
          </View>
          {reviews.length > 0 ? (
            <View style={styles.reviewsWrap} testID="restaurant-reviews">
              <Text style={styles.reviewsTitle}>What customers say</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewsRow}>
                {reviews.map((r) => (
                  <View key={r.id} style={styles.reviewCard}>
                    <View style={styles.reviewTop}>
                      <Text style={styles.reviewUser} numberOfLines={1}>
                        {r.user_name}
                      </Text>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Ionicons key={s} name={s <= r.rating ? "star" : "star-outline"} size={11} color="#F57C00" />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.reviewComment} numberOfLines={3}>
                      {r.comment || "Loved it!"}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {/* Sticky category chips */}
        <View
          style={styles.chipRow}
          onLayout={(e) => {
            chipsY.current = e.nativeEvent.layout.y;
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRowContent}
          >
            <Chip
              label="Veg"
              active={vegOnly}
              onPress={() => setVegOnly((v) => !v)}
              testID="restaurant-veg-filter"
            />
            {categories.map((c) => (
              <Chip
                key={c}
                label={c}
                active={activeCat === c}
                onPress={() => {
                  setActiveCat(c);
                  const y = sectionY.current[c];
                  if (y != null) scrollRef.current?.scrollTo({ y: y + chipsY.current - 60, animated: true });
                }}
                testID={`restaurant-category-${c.toLowerCase().replace(/\s+/g, "-")}`}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.menuWrap}>
          {categories.length === 0 ? (
            <EmptyState
              icon="leaf-outline"
              title="No items here"
              subtitle="No items found in this category."
              testID="menu-empty"
            />
          ) : (
            categories.map((cat) => (
              <View
                key={cat}
                onLayout={(e) => {
                  sectionY.current[cat] = e.nativeEvent.layout.y;
                }}
              >
                <Text style={styles.catTitle}>
                  {cat} ({grouped[cat].length})
                </Text>
                {grouped[cat].map((item) => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    qty={cart.getQty(item.id)}
                    onAdd={() => add(item)}
                    onInc={() => cart.increment(item.id)}
                    onDec={() => cart.decrement(item.id)}
                  />
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {cart.count > 0 ? (
        <Pressable
          testID="restaurant-view-cart"
          style={[styles.cartBar, { bottom: insets.bottom + 16 }]}
          onPress={() => router.push("/cart")}
        >
          <Text style={styles.cartBarMeta}>
            {cart.count} item{cart.count > 1 ? "s" : ""} | {inr(cart.subtotal)}
          </Text>
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
  center: { alignItems: "center", justifyContent: "center" },
  backBtn: {
    position: "absolute",
    left: spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.onSurface,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  hero: { width: "100%", height: 240, backgroundColor: colors.surfaceTertiary },
  heartBtn: { position: "absolute", right: spacing.lg, zIndex: 10 },
  reviewsWrap: { marginTop: spacing.lg },
  reviewsTitle: {
    fontFamily: fonts.displayBold,
    fontSize: typeScale.lg,
    color: colors.onSurface,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  reviewsRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  reviewCard: {
    width: 220,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  reviewTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  reviewUser: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface, flex: 1 },
  reviewStars: { flexDirection: "row", gap: 1 },
  reviewComment: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, lineHeight: 18 },
  infoCard: {
    marginHorizontal: spacing.lg,
    marginTop: -28,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  infoTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, flex: 1, letterSpacing: -0.4 },
  cuisines: { fontFamily: fonts.text, fontSize: typeScale.base, color: colors.muted },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  meta: { fontFamily: fonts.textMedium, fontSize: typeScale.sm, color: colors.onSurfaceTertiary },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.borderStrong },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    backgroundColor: colors.brandTertiary,
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  offerText: { color: colors.onBrandTertiary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm },
  chipRow: { height: 56, justifyContent: "center", backgroundColor: colors.surface },
  chipRowContent: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  menuWrap: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  catTitle: {
    fontFamily: fonts.displayBold,
    fontSize: typeScale.xl,
    color: colors.onSurface,
    marginTop: spacing.lg,
  },
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
    elevation: 8,
  },
  cartBarMeta: { color: "#FFFFFF", fontFamily: fonts.displaySemiBold, fontSize: typeScale.base },
  cartBarRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  cartBarAction: { color: "#FFFFFF", fontFamily: fonts.displayBold, fontSize: typeScale.base },
}));
