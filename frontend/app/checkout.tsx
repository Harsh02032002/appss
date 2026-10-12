import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { API_URL, apiFetch } from "@/src/api/client";
import { Chip, EmptyState, inr, showToast } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useCart } from "@/src/context/cart";
import { useLocationContext } from "@/src/context/location";

const DELIVERY_FEE = 3500;
const TIPS = [
  { label: "No tip", value: 0 },
  { label: "₹20", value: 2000 },
  { label: "₹30", value: 3000 },
  { label: "₹50", value: 5000 },
];

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load payment gateway"));
    document.body.appendChild(s);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Coupon = { code: string; title: string; description: string; min_order: number };
type AppliedCoupon = { code: string; discount: number; free_delivery: boolean; title: string };

export default function Checkout() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const cart = useCart();
  const { location } = useLocationContext();

  const [tip, setTip] = useState(0);
  const [payment, setPayment] = useState<"cod" | "razorpay">("cod");
  const [placing, setPlacing] = useState(false);
  const [webViewOrderId, setWebViewOrderId] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    apiFetch<{ coupons: Coupon[] }>("/api/coupons").then((d) => setCoupons(d.coupons)).catch(() => {});
  }, []);

  // Re-validate coupon if the cart changes (min order may no longer be met)
  useEffect(() => {
    if (!applied) return;
    apiFetch<AppliedCoupon>("/api/coupons/validate", {
      method: "POST",
      body: JSON.stringify({ code: applied.code, subtotal: cart.subtotal }),
    })
      .then(setApplied)
      .catch((e) => {
        setApplied(null);
        showToast(e.message || "Coupon removed", "info");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.subtotal]);

  const applyCoupon = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setApplying(true);
    try {
      const res = await apiFetch<AppliedCoupon>("/api/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code: clean, subtotal: cart.subtotal }),
      });
      setApplied(res);
      setCouponInput("");
      showToast(`${res.code} applied — ${res.title}`, "success");
    } catch (e: any) {
      showToast(e.message || "Invalid coupon", "error");
    } finally {
      setApplying(false);
    }
  };

  const taxes = Math.round(cart.subtotal * 0.05);
  const deliveryFee = applied?.free_delivery ? 0 : DELIVERY_FEE;
  const discount = applied?.discount ?? 0;
  const total = cart.subtotal + deliveryFee + taxes + tip - discount;

  const finishOrder = (orderId: string) => {
    cart.clear();
    router.replace({ pathname: "/order-confirmation", params: { order_id: orderId } });
  };

  const confirmPaid = async (orderId: string) => {
    for (let i = 0; i < 3; i++) {
      try {
        const o = await apiFetch<any>(`/api/orders/${orderId}`);
        if (o.payment_status === "paid") return true;
      } catch {}
      await sleep(800);
    }
    return false;
  };

  const startWebCheckout = async (orderId: string, rp: any) => {
    await loadRazorpayScript();
    const rzp = new (window as any).Razorpay({
      key: rp.key_id,
      amount: rp.amount,
      currency: rp.currency,
      order_id: rp.order_id,
      name: "DashBite",
      description: "Food order payment",
      prefill: { name: user?.name ?? "", email: user?.email ?? "" },
      theme: { color: "#D95325" },
      handler: async (resp: any) => {
        try {
          await apiFetch("/api/payments/verify", {
            method: "POST",
            body: JSON.stringify({ order_id: orderId, ...resp }),
          });
          finishOrder(orderId);
        } catch {
          showToast("Payment verification failed", "error");
        } finally {
          setPlacing(false);
        }
      },
      modal: { ondismiss: () => setPlacing(false) },
    });
    rzp.open();
  };

  const placeOrder = async () => {
    if (!user) {
      router.push({ pathname: "/login", params: { redirect: "/checkout" } });
      return;
    }
    if (location.source === "none") {
      showToast("Please select a delivery address", "error");
      return;
    }
    if (cart.count === 0) return;

    setPlacing(true);
    try {
      const payload = {
        items: cart.items.map((i) => ({ item_id: i.id, qty: i.qty, notes: i.notes ?? "" })),
        address: {
          label: location.label,
          line1: location.sublabel,
          lat: location.lat,
          lng: location.lng,
        },
        payment_method: payment,
        tip,
        coupon_code: applied?.code ?? "",
      };
      const res = await apiFetch<{ order: { id: string }; razorpay: any }>("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (payment === "cod") {
        finishOrder(res.order.id);
        return;
      }
      if (Platform.OS === "web") {
        await startWebCheckout(res.order.id, res.razorpay);
      } else {
        setWebViewOrderId(res.order.id);
      }
    } catch (e: any) {
      showToast(e.message || "Order placement failed. Please try again.", "error");
      setPlacing(false);
    }
  };

  const handleWebViewNav = (req: { url: string }) => {
    const url = req.url;
    if (url.startsWith("feastwave://payment-success")) {
      const orderId = webViewOrderId;
      setWebViewOrderId(null);
      (async () => {
        const paid = orderId ? await confirmPaid(orderId) : false;
        if (orderId && paid) finishOrder(orderId);
        else showToast("Could not confirm payment. Check My Orders.", "error");
        setPlacing(false);
      })();
      return false;
    }
    if (url.startsWith("feastwave://payment-cancelled") || url.startsWith("feastwave://payment-failed")) {
      setWebViewOrderId(null);
      setPlacing(false);
      showToast(
        url.includes("cancelled") ? "Payment cancelled" : "Payment failed. Amount will be auto-refunded if debited.",
        "error",
      );
      return false;
    }
    return true;
  };

  if (cart.count === 0 && !placing) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState
          icon="cart-outline"
          title="Cart is empty"
          subtitle="Add items before checking out."
          actionLabel="Browse Restaurants"
          onAction={() => router.replace("/home")}
          testID="checkout-empty"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="checkout-screen">
      <View style={styles.header}>
        <Pressable testID="checkout-back" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1917" />
        </Pressable>
        <Text style={styles.title}>Checkout</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Delivery address */}
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        <Pressable
          testID="checkout-address-tile"
          style={styles.card}
          onPress={() => router.push({ pathname: "/address", params: { mode: "select" } })}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="location" size={20} color="#D95325" />
          </View>
          <View style={{ flex: 1 }}>
            {location.source === "none" ? (
              <>
                <Text style={styles.cardTitle}>Select delivery address</Text>
                <Text style={styles.cardSub}>Choose where your food arrives</Text>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>{location.label}</Text>
                <Text style={styles.cardSub} numberOfLines={2}>
                  {location.sublabel}
                </Text>
              </>
            )}
          </View>
          <Text style={styles.changeText}>{location.source === "none" ? "Select" : "Change"}</Text>
        </Pressable>

        {/* Tip */}
        <Text style={styles.sectionTitle}>Tip your delivery partner</Text>
        <View style={styles.tipRow} testID="tip-selector">
          {TIPS.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              active={tip === t.value}
              onPress={() => setTip(t.value)}
              testID={`tip-chip-${t.value}`}
            />
          ))}
        </View>

        {/* Coupons */}
        <Text style={styles.sectionTitle}>Offers & Coupons</Text>
        {applied ? (
          <View style={styles.appliedCard} testID="coupon-applied">
            <View style={styles.cardIcon}>
              <Ionicons name="pricetag" size={20} color="#D95325" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{applied.code} applied</Text>
              <Text style={styles.cardSub}>
                {applied.free_delivery ? "Free delivery on this order" : `You save ${inr(applied.discount)}`}
              </Text>
            </View>
            <Pressable testID="coupon-remove" hitSlop={8} onPress={() => setApplied(null)} style={styles.removeBtn}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.couponInputRow}>
              <TextInput
                testID="coupon-input"
                style={styles.couponInput}
                placeholder="Enter coupon code"
                placeholderTextColor="#7A746A"
                autoCapitalize="characters"
                autoCorrect={false}
                value={couponInput}
                onChangeText={setCouponInput}
                onSubmitEditing={() => applyCoupon(couponInput)}
                returnKeyType="done"
              />
              <Pressable
                testID="coupon-apply"
                style={[styles.applyBtn, (!couponInput.trim() || applying) && { opacity: 0.5 }]}
                disabled={!couponInput.trim() || applying}
                onPress={() => applyCoupon(couponInput)}
              >
                {applying ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.applyText}>Apply</Text>}
              </Pressable>
            </View>
            {coupons.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.couponList}>
                {coupons.map((c) => {
                  const eligible = cart.subtotal >= c.min_order;
                  return (
                    <Pressable
                      key={c.code}
                      testID={`coupon-card-${c.code}`}
                      style={[styles.couponCard, !eligible && { opacity: 0.55 }]}
                      onPress={() => applyCoupon(c.code)}
                      disabled={applying}
                    >
                      <View style={styles.couponCodeRow}>
                        <Ionicons name="ticket-outline" size={14} color="#D95325" />
                        <Text style={styles.couponCode}>{c.code}</Text>
                      </View>
                      <Text style={styles.couponTitle}>{c.title}</Text>
                      <Text style={styles.couponDesc}>{c.description}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </>
        )}

        {/* Payment selection */}
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.paymentGroup} testID="payment-selection">
          <Pressable
            testID="payment-option-cod"
            style={[styles.paymentCard, payment === "cod" && styles.paymentCardActive]}
            onPress={() => setPayment("cod")}
          >
            <Ionicons name="cash-outline" size={22} color={payment === "cod" ? "#D95325" : "#7A746A"} />
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentTitle}>Cash on Delivery</Text>
              <Text style={styles.paymentSub}>Pay when your food arrives</Text>
            </View>
            <Ionicons
              name={payment === "cod" ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={payment === "cod" ? "#D95325" : "#C8BCAB"}
            />
          </Pressable>
          <Pressable
            testID="payment-option-razorpay"
            style={[styles.paymentCard, payment === "razorpay" && styles.paymentCardActive, { borderBottomWidth: 0 }]}
            onPress={() => setPayment("razorpay")}
          >
            <Ionicons name="card-outline" size={22} color={payment === "razorpay" ? "#D95325" : "#7A746A"} />
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentTitle}>Pay Online</Text>
              <Text style={styles.paymentSub}>UPI, Cards, Netbanking</Text>
              <View style={styles.secureRow}>
                <Ionicons name="shield-checkmark" size={11} color="#388E3C" />
                <Text style={styles.secureText}>Secure via Razorpay</Text>
              </View>
            </View>
            <Ionicons
              name={payment === "razorpay" ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={payment === "razorpay" ? "#D95325" : "#C8BCAB"}
            />
          </Pressable>
        </View>

        {/* Bill */}
        <Text style={styles.sectionTitle}>Bill Summary</Text>
        <View style={styles.billCard} testID="checkout-bill">
          <BillRow label={`Item total (${cart.count})`} value={inr(cart.subtotal)} />
          <BillRow label="Delivery fee" value={applied?.free_delivery ? "FREE" : inr(DELIVERY_FEE)} />
          <BillRow label="Taxes & charges (5%)" value={inr(taxes)} />
          <BillRow label="Delivery tip" value={tip === 0 ? "—" : inr(tip)} />
          {discount > 0 ? (
            <View style={styles.billRow} testID="bill-discount">
              <Text style={[styles.billLabel, { color: "#388E3C" }]}>Coupon discount ({applied?.code})</Text>
              <Text style={[styles.billValue, { color: "#388E3C" }]}>-{inr(discount)}</Text>
            </View>
          ) : null}
          <View style={styles.billDivider} />
          <View style={styles.billRow}>
            <Text style={styles.billTotalLabel}>To Pay</Text>
            <Text style={styles.billTotalValue}>{inr(total)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          testID="place-order-button"
          style={({ pressed }) => [styles.cta, (pressed || placing) && { opacity: 0.85 }]}
          onPress={placeOrder}
          disabled={placing}
        >
          {placing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.ctaText}>
                {payment === "cod" ? "Place Order" : `Pay ${inr(total)}`}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>

      {/* Razorpay checkout (native via hosted page in WebView) */}
      <Modal visible={webViewOrderId != null} animationType="slide" onRequestClose={() => setWebViewOrderId(null)}>
        <View style={[styles.webViewWrap, { paddingTop: insets.top }]}>
          <View style={styles.webViewHeader}>
            <Text style={styles.webViewTitle}>Razorpay Secure Checkout</Text>
            <Pressable
              testID="razorpay-close"
              onPress={() => {
                setWebViewOrderId(null);
                setPlacing(false);
                showToast("Payment cancelled", "info");
              }}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color="#1A1917" />
            </Pressable>
          </View>
          {webViewOrderId ? (
            <WebView
              testID="razorpay-webview"
              source={{ uri: `${API_URL}/api/payments/checkout-page/${webViewOrderId}` }}
              onShouldStartLoadWithRequest={handleWebViewNav}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.center}>
                  <ActivityIndicator color="#D95325" />
                </View>
              )}
            />
          ) : null}
        </View>
      </Modal>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: typeScale.lg,
    color: colors.onSurface,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg, color: colors.onSurface },
  cardSub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, marginTop: 2 },
  changeText: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.brandPrimary },
  tipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  appliedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  removeBtn: { minHeight: 44, justifyContent: "center" },
  removeText: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.error },
  couponInputRow: { flexDirection: "row", gap: spacing.sm },
  couponInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.textMedium,
    fontSize: typeScale.base,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
  applyBtn: {
    minHeight: 48,
    minWidth: 84,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { color: colors.onBrandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.base },
  couponList: { gap: spacing.sm, paddingTop: spacing.md },
  couponCard: {
    width: 170,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
    backgroundColor: colors.surfaceSecondary,
  },
  couponCodeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  couponCode: { fontFamily: fonts.displayBold, fontSize: typeScale.base, color: colors.brandPrimary, letterSpacing: 0.5 },
  couponTitle: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm, color: colors.onSurface },
  couponDesc: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  paymentGroup: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  paymentCardActive: { backgroundColor: colors.brandTertiary },
  paymentTitle: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg, color: colors.onSurface },
  paymentSub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  secureRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  secureText: { fontFamily: fonts.textMedium, fontSize: 11, color: colors.success },
  billCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
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
    justifyContent: "center",
    gap: spacing.sm,
  },
  ctaText: { color: "#FFFFFF", fontFamily: fonts.displayBold, fontSize: typeScale.lg },
  webViewWrap: { flex: 1, backgroundColor: colors.surface },
  webViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  webViewTitle: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg, color: colors.onSurface },
}));
