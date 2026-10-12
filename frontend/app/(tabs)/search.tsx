import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { apiFetch } from "@/src/api/client";
import { EmptyState, inr, showToast } from "@/src/components/ui";
import { RestaurantCard, Restaurant } from "@/src/components/restaurant-card";
import { MenuItem, MenuItemRow } from "@/src/components/menu-item-row";
import { useCart } from "@/src/context/cart";

type Mode = "restaurants" | "dishes";

export default function Search() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const cart = useCart();

  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode>("restaurants");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) {
      setRestaurants([]);
      setDishes([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const data = await apiFetch<{ restaurants: Restaurant[]; dishes: MenuItem[] }>(
          `/api/search?q=${encodeURIComponent(q.trim())}`,
        );
        setRestaurants(data.restaurants);
        setDishes(data.dishes);
        setSearched(true);
      } catch {
        setRestaurants([]);
        setDishes([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  const addDish = (item: MenuItem) => {
    const result = cart.addItem(
      { id: item.id, name: item.name, price: item.price, image: item.image, veg: item.veg },
      { id: item.restaurant_id, name: item.restaurant_name ?? "Restaurant" },
    );
    if (result === "replaced") showToast("Started a new cart with this restaurant", "info");
    else showToast(`${item.name} added to cart`, "success");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="search-screen">
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#7A746A" />
          <TextInput
            testID="search-input"
            style={styles.input}
            placeholder="Search restaurants or dishes"
            placeholderTextColor="#7A746A"
            value={q}
            onChangeText={setQ}
            autoFocus
            returnKeyType="search"
          />
          {q.length > 0 ? (
            <Pressable testID="search-clear" onPress={() => setQ("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#7A746A" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.segment} testID="search-mode-tabs">
        {(["restaurants", "dishes"] as Mode[]).map((m) => (
          <Pressable
            key={m}
            testID={`search-tab-${m}`}
            style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
              {m === "restaurants" ? "Restaurants" : "Dishes"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center} testID="search-loading">
          <ActivityIndicator color="#D95325" />
        </View>
      ) : !q.trim() ? (
        <EmptyState
          icon="search-outline"
          title="Search DashBite"
          subtitle="Find restaurants, cuisines and your favourite dishes."
          testID="search-idle"
        />
      ) : mode === "restaurants" ? (
        <FlatList
          data={restaurants}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <RestaurantCard restaurant={item} />}
          contentContainerStyle={[styles.list, { paddingBottom: 32 + bottomChrome }]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searched ? (
              <EmptyState
                icon="restaurant-outline"
                title="No restaurants found"
                subtitle={`Nothing matches "${q}". Try dishes instead.`}
                testID="search-empty-restaurants"
              />
            ) : null
          }
        />
      ) : (
        <FlatList
          data={dishes}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <View>
              <Text style={styles.dishRestaurant} numberOfLines={1}>
                {item.restaurant_name}
              </Text>
              <MenuItemRow
                item={item}
                qty={cart.getQty(item.id)}
                onAdd={() => addDish(item)}
                onInc={() => cart.increment(item.id)}
                onDec={() => cart.decrement(item.id)}
              />
            </View>
          )}
          contentContainerStyle={[styles.list, { paddingBottom: 32 + bottomChrome }]}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searched ? (
              <EmptyState
                icon="fast-food-outline"
                title="No dishes found"
                subtitle={`No dishes match "${q}".`}
                testID="search-empty-dishes"
              />
            ) : null
          }
        />
      )}

      {cart.count > 0 ? (
        <Pressable
          testID="search-view-cart-bar"
          style={[styles.cartBar, { bottom: bottomChrome + 16 }]}
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
  searchRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  searchBox: {
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
  input: { flex: 1, fontFamily: fonts.text, fontSize: typeScale.lg, color: colors.onSurface, paddingVertical: spacing.md },
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.sm,
  },
  segmentBtn: { flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  segmentBtnActive: { backgroundColor: colors.surface },
  segmentText: { fontFamily: fonts.textMedium, fontSize: typeScale.base, color: colors.muted },
  segmentTextActive: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  dishRestaurant: {
    fontFamily: fonts.textMedium,
    fontSize: typeScale.sm,
    color: colors.muted,
    marginTop: spacing.md,
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
