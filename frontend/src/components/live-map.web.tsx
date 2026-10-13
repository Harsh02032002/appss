import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import { radius, spacing, useTheme } from "@/src/theme";
import type { LatLng } from "./live-map";

const { width } = Dimensions.get("window");
const MAP_WIDTH = width - spacing.lg * 2;
const START = { x: 24, y: 28 };
const END = { x: MAP_WIDTH - 64, y: 130 };

type Props = {
  restaurant: LatLng;
  destination: LatLng;
  rider: LatLng | null;
  showRider: boolean;
};

/** Web fallback: illustrated map. Rider position is interpolated between restaurant and destination. */
export function LiveMap({ restaurant, destination, rider, showRider }: Props) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!rider) return;
    const total = Math.hypot(destination.lat - restaurant.lat, destination.lng - restaurant.lng) || 1;
    const done = Math.hypot(rider.lat - restaurant.lat, rider.lng - restaurant.lng);
    progress.value = withTiming(Math.min(1, done / total), { duration: 4500 });
  }, [rider, restaurant, destination, progress]);

  const riderStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: START.x + (END.x - START.x) * progress.value },
      { translateY: START.y + (END.y - START.y) * progress.value },
    ],
  }));

  return (
    <View style={[styles.mapCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="track-map">
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={`h-${i}`} style={[styles.gridLineH, { top: 40 * (i + 1), backgroundColor: colors.divider }]} />
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={`v-${i}`} style={[styles.gridLineV, { left: (MAP_WIDTH / 7) * (i + 1), backgroundColor: colors.divider }]} />
      ))}
      <View style={[styles.routeLine, { borderColor: colors.brandPrimary }]} />
      <View style={[styles.pin, { left: START.x - 4, top: START.y - 10 }]}>
        <Ionicons name="storefront" size={18} color={colors.brandSecondary} />
      </View>
      <View style={[styles.pin, { left: END.x + 4, top: END.y + 6 }]}>
        <Ionicons name="home" size={18} color={colors.success} />
      </View>
      {showRider ? (
        <Animated.View style={[styles.riderMarker, { backgroundColor: colors.brandPrimary, borderColor: colors.surface }, riderStyle]} testID="rider-marker">
          <Ionicons name="bicycle" size={16} color={colors.onBrandPrimary} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapCard: { height: 200, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1 },
  gridLineH: { position: "absolute", left: 0, right: 0, height: 1 },
  gridLineV: { position: "absolute", top: 0, bottom: 0, width: 1 },
  routeLine: {
    position: "absolute",
    left: START.x + 10,
    top: START.y + 12,
    width: Math.hypot(END.x - START.x, END.y - START.y),
    borderTopWidth: 2,
    borderStyle: "dashed",
    transform: [{ rotate: `${Math.atan2(END.y - START.y, END.x - START.x)}rad` }],
    transformOrigin: "left top",
  },
  pin: { position: "absolute" },
  riderMarker: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
