import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { apiFetch } from "@/src/api/client";
import { inr, showToast, VegBadge } from "@/src/components/ui";
import { MenuItem, QtyStepper } from "@/src/components/menu-item-row";
import { useCart } from "@/src/context/cart";

type ItemDetail = MenuItem & { restaurant?: { id: string; name: string } };

export default function ItemDetails() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cart = useCart();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const d = await apiFetch<ItemDetail>(`/api/menu-items/${id}`);
        setItem(d);
      } catch {
        showToast("Failed to load item", "error");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const addToCart = () => {
    if (!item) return;
    const restaurant = item.restaurant ?? { id: item.restaurant_id, name: "Restaurant" };
    const result = cart.addItem(
      { id: item.id, name: item.name, price: item.price, image: item.image, veg: item.veg, notes },
      { id: restaurant.id, name: restaurant.name },
      qty,
    );
    showToast(
      result === "replaced" ? "Started a new cart with this restaurant" : `${item.name} added to cart`,
      "success",
    );
    router.back();
  };

  return (
    <View style={styles.container} testID="item-screen">
      {loading || !item ? (
        <View style={styles.center} testID="item-loading">
          <ActivityIndicator color="#D95325" />
        </View>
      ) : (
        <>
          <KeyboardAwareScrollView
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            bottomOffset={96}
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Image source={{ uri: item.image }} style={styles.hero} contentFit="cover" transition={150} />
              <Pressable
                testID="item-close"
                style={[styles.closeBtn, { top: insets.top + spacing.sm }]}
                onPress={() => router.back()}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#1A1917" />
              </Pressable>
            </View>
            <View style={styles.body}>
              <View style={styles.badgeRow}>
                <VegBadge veg={item.veg} />
                {item.bestseller ? <Text style={styles.bestseller}>Bestseller</Text> : null}
                {item.rating ? (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#F57C00" />
                    <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.price}>{inr(item.price)}</Text>
              <Text style={styles.desc}>{item.description}</Text>
              {item.restaurant ? (
                <View style={styles.restaurantRow}>
                  <Ionicons name="storefront-outline" size={14} color="#7A746A" />
                  <Text style={styles.restaurantName}>{item.restaurant.name}</Text>
                </View>
              ) : null}

              <View style={styles.notesWrap}>
                <Text style={styles.notesLabel}>Special instructions</Text>
                <TextInput
                  testID="item-notes-input"
                  style={styles.notesInput}
                  placeholder="e.g. Less spicy, no onion..."
                  placeholderTextColor={colors.muted}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </View>

              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>Quantity</Text>
                <QtyStepper
                  qty={qty}
                  onInc={() => setQty((q) => Math.min(20, q + 1))}
                  onDec={() => setQty((q) => Math.max(1, q - 1))}
                  testID="item-qty-stepper"
                />
              </View>
            </View>
          </KeyboardAwareScrollView>

          <KeyboardStickyView>
            <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
              <Pressable testID="item-add-button" style={styles.cta} onPress={addToCart}>
                <Text style={styles.ctaText}>Add item</Text>
                <Text style={styles.ctaPrice}>{inr(item.price * qty)}</Text>
              </Pressable>
            </View>
          </KeyboardStickyView>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", height: 260, backgroundColor: colors.surfaceTertiary },
  closeBtn: {
    position: "absolute",
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  body: { padding: spacing.lg, gap: spacing.sm },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bestseller: { color: colors.warning, fontFamily: fonts.textMedium, fontSize: typeScale.sm },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { color: colors.muted, fontFamily: fonts.text, fontSize: typeScale.sm },
  name: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  price: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.xl, color: colors.onSurface },
  desc: { fontFamily: fonts.text, fontSize: typeScale.base, color: colors.muted, lineHeight: 21 },
  restaurantRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  restaurantName: { fontFamily: fonts.textMedium, fontSize: typeScale.sm, color: colors.onSurfaceTertiary },
  notesWrap: { marginTop: spacing.md, gap: spacing.xs },
  notesLabel: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurfaceSecondary },
  notesInput: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 72,
    textAlignVertical: "top",
    fontFamily: fonts.text,
    fontSize: typeScale.base,
    color: colors.onSurface,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  qtyLabel: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg, color: colors.onSurface },
  ctaBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cta: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
  },
  ctaText: { color: "#FFFFFF", fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg },
  ctaPrice: { color: "#FFFFFF", fontFamily: fonts.displayBold, fontSize: typeScale.lg },
}));
