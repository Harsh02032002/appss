import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { EmptyState, inr, VegBadge } from "@/src/components/ui";
import { QtyStepper } from "@/src/components/menu-item-row";
import { useAuth } from "@/src/context/auth";
import { useCart } from "@/src/context/cart";

const DELIVERY_FEE = 3500;

export default function Cart() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { user } = useAuth();

  const taxes = Math.round(cart.subtotal * 0.05);
  const total = cart.subtotal + (cart.count > 0 ? DELIVERY_FEE : 0) + taxes;

  const proceed = () => {
    if (!user) {
      router.push({ pathname: "/login", params: { redirect: "/checkout" } });
      return;
    }
    router.push("/checkout");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="cart-screen">
      <View style={styles.header}>
        <Pressable testID="cart-close" onPress={() => router.back()} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#1A1917" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Your Cart</Text>
          {cart.restaurantName ? <Text style={styles.subtitle}>{cart.restaurantName}</Text> : null}
        </View>
        {cart.count > 0 ? (
          <Pressable testID="cart-clear" onPress={cart.clear} hitSlop={8}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {cart.count === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          subtitle="Explore restaurants to add delicious meals."
          actionLabel="Browse Restaurants"
          onAction={() => {
            router.dismissAll();
            router.replace("/home");
          }}
          testID="cart-empty"
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.itemsCard}>
              {cart.items.map((item, idx) => (
                <View
                  key={item.id}
                  style={[styles.itemRow, idx > 0 && styles.itemRowBorder]}
                  testID={`cart-item-${item.id}`}
                >
                  <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
                  <View style={styles.itemInfo}>
                    <View style={styles.itemTitleRow}>
                      <VegBadge veg={item.veg} />
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                    </View>
                    {item.notes ? (
                      <Text style={styles.itemNotes} numberOfLines={1}>
                        “{item.notes}”
                      </Text>
                    ) : null}
                    <Text style={styles.itemPrice}>{inr(item.price)}</Text>
                  </View>
                  <View style={styles.itemRight}>
                    <QtyStepper
                      qty={item.qty}
                      onInc={() => cart.increment(item.id)}
                      onDec={() => cart.decrement(item.id)}
                      testID={`cart-stepper-${item.id}`}
                    />
                    <Text style={styles.lineTotal}>{inr(item.price * item.qty)}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.billCard} testID="cart-bill">
              <Text style={styles.billTitle}>Bill Details</Text>
              <BillRow label="Item total" value={inr(cart.subtotal)} />
              <BillRow label="Delivery fee" value={inr(DELIVERY_FEE)} />
              <BillRow label="Taxes & charges (5%)" value={inr(taxes)} />
              <View style={styles.billDivider} />
              <View style={styles.billRow}>
                <Text style={styles.billTotalLabel}>To Pay</Text>
                <Text style={styles.billTotalValue}>{inr(total)}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <Pressable testID="proceed-checkout-button" style={styles.cta} onPress={proceed}>
              <View>
                <Text style={styles.ctaPrice}>{inr(total)}</Text>
                <Text style={styles.ctaMeta}>TOTAL</Text>
              </View>
              <View style={styles.ctaRight}>
                <Text style={styles.ctaText}>Proceed to Checkout</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </View>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function BillRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.billRow}>
      <Text style={styles.billLabel}>{label}</Text>
      <Text style={styles.billValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  closeBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  clearText: { color: colors.error, fontFamily: fonts.textMedium, fontSize: typeScale.base },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  itemsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  itemRow: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md, alignItems: "center" },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  itemInfo: { flex: 1, gap: 2 },
  itemTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  itemName: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface, flex: 1 },
  itemNotes: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, fontStyle: "italic" },
  itemPrice: { fontFamily: fonts.textMedium, fontSize: typeScale.sm, color: colors.onSurfaceTertiary },
  itemRight: { alignItems: "flex-end", gap: spacing.xs, width: 96 },
  lineTotal: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  billCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  billTitle: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface, marginBottom: spacing.xs },
  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  billLabel: { fontFamily: fonts.text, fontSize: typeScale.base, color: colors.onSurfaceSecondary },
  billValue: { fontFamily: fonts.textMedium, fontSize: typeScale.base, color: colors.onSurface },
  billDivider: { height: 1, backgroundColor: colors.borderStrong, marginVertical: spacing.xs },
  billTotalLabel: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface },
  billTotalValue: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface },
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
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
  },
  ctaPrice: { color: "#FFFFFF", fontFamily: fonts.displayBold, fontSize: typeScale.lg },
  ctaMeta: { color: "#FBEAE5", fontFamily: fonts.text, fontSize: 10, letterSpacing: 1 },
  ctaRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  ctaText: { color: "#FFFFFF", fontFamily: fonts.displaySemiBold, fontSize: typeScale.base },
}));
