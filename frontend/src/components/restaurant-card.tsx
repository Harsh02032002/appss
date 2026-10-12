import React from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { RatingBadge } from "@/src/components/ui";
import { FavoriteButton } from "@/src/components/favorite-button";

export type Restaurant = {
  id: string;
  name: string;
  cuisines: string[];
  rating: number;
  rating_count: string;
  delivery_time: string;
  price_for_two: number;
  image: string;
  offer?: string;
  address: string;
  lat?: number;
  lng?: number;
};

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Pressable
      testID={`restaurant-card-${restaurant.id}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      onPress={() => router.push(`/restaurant/${restaurant.id}`)}
    >
      <View>
        <Image source={{ uri: restaurant.image }} style={styles.image} contentFit="cover" transition={200} />
        {restaurant.offer ? (
          <View style={styles.offer}>
            <Text style={styles.offerText}>{restaurant.offer}</Text>
          </View>
        ) : null}
        <View style={styles.heart}>
          <FavoriteButton restaurantId={restaurant.id} />
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <RatingBadge rating={restaurant.rating} />
        </View>
        <Text style={styles.cuisines} numberOfLines={1}>
          {restaurant.cuisines.join(" • ")}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={colors.muted} />
          <Text style={styles.meta}>{restaurant.delivery_time}</Text>
          <View style={styles.dot} />
          <Text style={styles.meta}>₹{restaurant.price_for_two} for two</Text>
          <View style={styles.dot} />
          <Text style={styles.meta} numberOfLines={1}>
            {restaurant.address.split(",")[0]}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: "100%", height: 170, backgroundColor: colors.surfaceTertiary },
  offer: {
    position: "absolute",
    left: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  offerText: { color: colors.onBrandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm },
  heart: { position: "absolute", top: spacing.md, right: spacing.md },
  body: { padding: spacing.md, gap: spacing.xs },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: {
    color: colors.onSurface,
    fontFamily: fonts.displayBold,
    fontSize: typeScale.lg,
    flex: 1,
  },
  cuisines: { color: colors.muted, fontFamily: fonts.text, fontSize: typeScale.base },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  meta: { color: colors.onSurfaceTertiary, fontFamily: fonts.textMedium, fontSize: typeScale.sm, flexShrink: 1 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.borderStrong },
}));
