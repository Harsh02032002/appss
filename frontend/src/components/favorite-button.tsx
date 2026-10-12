import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useTheme } from "@/src/theme";
import { useFavorites } from "@/src/context/favorites";

export function FavoriteButton({ restaurantId, size = 36 }: { restaurantId: string; size?: number }) {
  const { colors } = useTheme();
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(restaurantId);
  return (
    <Pressable
      testID={`favorite-button-${restaurantId}`}
      accessibilityLabel={fav ? "Remove from favourites" : "Add to favourites"}
      hitSlop={8}
      onPress={() => toggle(restaurantId)}
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={fav ? "heart" : "heart-outline"} size={size * 0.55} color={fav ? colors.brandPrimary : colors.onSurface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
