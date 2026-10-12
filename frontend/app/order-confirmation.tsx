import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { apiFetch } from "@/src/api/client";
import { PrimaryButton } from "@/src/components/ui";
import { Order } from "./(tabs)/orders";

export default function OrderConfirmation() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { order_id } = useLocalSearchParams<{ order_id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    (async () => {
      try {
        const o = await apiFetch<Order>(`/api/orders/${order_id}`);
        setOrder(o);
      } catch {
        // confirmation screen still works with just the id
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order_id]);

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}
      testID="order-confirmation-screen"
    >
      <View style={styles.center}>
        <Animated.View style={[styles.checkCircle, { transform: [{ scale }] }]} testID="order-success-icon">
          <Ionicons name="checkmark" size={44} color="#FFFFFF" />
        </Animated.View>
        <Text style={styles.title}>Order placed!</Text>
        <Text style={styles.subtitle}>
          {order
            ? `${order.restaurant.name} is confirming your order.`
            : "Your order is being confirmed by the restaurant."}
        </Text>

        <View style={styles.card} testID="order-summary-card">
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Order ID</Text>
            <Text style={styles.cardValue}>#{(order_id ?? "").slice(-8).toUpperCase()}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Estimated delivery</Text>
            <Text style={styles.cardValueAccent}>35-40 min</Text>
          </View>
          {order ? (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Amount {order.payment_method === "cod" ? "(COD)" : "(Paid)"}</Text>
              <Text style={styles.cardValue}>₹{Math.round(order.amounts.total / 100)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          title="Track Order"
          icon="navigate"
          onPress={() => router.replace(`/track/${order_id}`)}
          testID="confirmation-track-button"
        />
        <PrimaryButtonGhost
          title="Back to Home"
          onPress={() => router.replace("/home")}
          testID="confirmation-home-button"
        />
      </View>
    </View>
  );
}

function PrimaryButtonGhost({ title, onPress, testID }: { title: string; onPress: () => void; testID: string }) {
  const styles = useStyles();
  return (
    <View style={styles.ghostWrap}>
      <Text onPress={onPress} testID={testID} style={styles.ghostText} suppressHighlighting>
        {title}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.success,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    marginBottom: spacing.md,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.onSurface, letterSpacing: -0.5 },
  subtitle: {
    fontFamily: fonts.text,
    fontSize: typeScale.lg,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 24,
  },
  card: {
    alignSelf: "stretch",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel: { fontFamily: fonts.text, fontSize: typeScale.base, color: colors.muted },
  cardValue: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  cardValueAccent: { fontFamily: fonts.displayBold, fontSize: typeScale.base, color: colors.brandPrimary },
  actions: { gap: spacing.xs },
  ghostWrap: { alignItems: "center", minHeight: 52, justifyContent: "center" },
  ghostText: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg },
}));
