import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { apiFetch } from "@/src/api/client";
import { Chip, EmptyState, inr, showToast } from "@/src/components/ui";
import { RestaurantCard, Restaurant } from "@/src/components/restaurant-card";
import { MenuItem, MenuItemRow } from "@/src/components/menu-item-row";
import { useCart } from "@/src/context/cart";

type Mode = "restaurants" | "dishes";
type Sort = "" | "rating" | "time" | "price_low" | "price_high";

const SORT_OPTIONS: { key: Sort; label: string }[] = [
  { key: "", label: "Relevance" },
  { key: "rating", label: "Rating" },
  { key: "time", label: "Delivery time" },
  { key: "price_low", label: "Price: low to high" },
  { key: "price_high", label: "Price: high to low" },
];

export default function Search() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const cart = useCart();

  const [q, setQ] = useState("");
  const [mode] = useState<Mode>("dishes");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sort, setSort] = useState<Sort>("");
  const [vegOnly, setVegOnly] = useState(false);
  const [topRated, setTopRated] = useState(false);
  const [cuisine, setCuisine] = useState("");
  const [cuisines] = useState<string[]>([]);
  const [sortOpen, setSortOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtersActive = !!sort || vegOnly || topRated || !!cuisine;
  const active = !!q.trim() || filtersActive;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!active) {
      setRestaurants([]);
      setDishes([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (sort) params.set("sort", sort);
        if (vegOnly) params.set("veg_only", "true");
        if (topRated) params.set("rating_min", "4");
        if (cuisine) params.set("cuisine", cuisine);
        const d = q.trim()
          ? await apiFetch<{ dishes: MenuItem[] }>(`/api/search?q=${encodeURIComponent(q.trim())}`)
          : { dishes: [] as MenuItem[] };
        setRestaurants([]);
        setDishes(vegOnly ? d.dishes.filter((x) => x.veg) : d.dishes);
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
  }, [q, sort, vegOnly, topRated, cuisine, active]);

  const clearFilters = () => {
    setSort("");
    setVegOnly(false);
    setTopRated(false);
    setCuisine("");
    setSortOpen(false);
  };

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
            placeholder="Search our menu"
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

      {/* Single-restaurant: dishes-only search, mode tabs hidden */}

      {mode === "restaurants" ? (
        <View testID="search-filters">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Chip
              label={sort ? `Sort: ${SORT_OPTIONS.find((o) => o.key === sort)?.label}` : "Sort"}
              icon="swap-vertical"
              active={!!sort || sortOpen}
              onPress={() => setSortOpen((v) => !v)}
              testID="filter-sort"
            />
            <Chip label="Pure Veg" icon="leaf" active={vegOnly} onPress={() => setVegOnly((v) => !v)} testID="filter-veg" />
            <Chip label="Rating 4.0+" icon="star" active={topRated} onPress={() => setTopRated((v) => !v)} testID="filter-rating" />
            {cuisines.map((c) => (
              <Chip
                key={c}
                label={c}
                active={cuisine === c}
                onPress={() => setCuisine((cur) => (cur === c ? "" : c))}
                testID={`filter-cuisine-${c.replace(/\s+/g, "-").toLowerCase()}`}
              />
            ))}
            {filtersActive ? (
              <Chip label="Clear" icon="close" active={false} onPress={clearFilters} testID="filter-clear" />
            ) : null}
          </ScrollView>
          {sortOpen ? (
            <View style={styles.sortSheet} testID="sort-options">
              {SORT_OPTIONS.map((o) => (
                <Pressable
                  key={o.key || "relevance"}
                  testID={`sort-option-${o.key || "relevance"}`}
                  style={styles.sortRow}
                  onPress={() => {
                    setSort(o.key);
                    setSortOpen(false);
                  }}
                >
                  <Text style={[styles.sortLabel, sort === o.key && styles.sortLabelActive]}>{o.label}</Text>
                  {sort === o.key ? <Ionicons name="checkmark" size={18} color="#D95325" /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center} testID="search-loading">
          <ActivityIndicator color="#D95325" />
        </View>
      ) : !active ? (
        <EmptyState
          icon="search-outline"
          title="Search DashBite"
          subtitle="Find biryanis, kebabs, curries and desserts."
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
                subtitle={q.trim() ? `Nothing matches "${q}". Try dishes instead.` : "No restaurants match these filters."}
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
  filterRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  sortSheet: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sortLabel: { fontFamily: fonts.textMedium, fontSize: typeScale.base, color: colors.onSurface },
  sortLabelActive: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold },
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
