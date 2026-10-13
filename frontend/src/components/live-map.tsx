import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import Ionicons from "@react-native-vector-icons/ionicons";

import { radius, useTheme } from "@/src/theme";

export type LatLng = { lat: number; lng: number };

type Props = {
  restaurant: LatLng;
  destination: LatLng;
  rider: LatLng | null;
  showRider: boolean;
};

/** Native live map (Apple Maps on iOS, Google Maps on Android). Web uses live-map.web.tsx. */
export function LiveMap({ restaurant, destination, rider, showRider }: Props) {
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const coords = [
      { latitude: restaurant.lat, longitude: restaurant.lng },
      { latitude: destination.lat, longitude: destination.lng },
    ];
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: false,
    });
  }, [restaurant.lat, restaurant.lng, destination.lat, destination.lng]);

  return (
    <View style={[styles.wrap, { borderColor: colors.border }]} testID="track-map">
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: (restaurant.lat + destination.lat) / 2,
          longitude: (restaurant.lng + destination.lng) / 2,
          latitudeDelta: Math.abs(restaurant.lat - destination.lat) * 2 + 0.01,
          longitudeDelta: Math.abs(restaurant.lng - destination.lng) * 2 + 0.01,
        }}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Polyline
          coordinates={[
            { latitude: restaurant.lat, longitude: restaurant.lng },
            { latitude: destination.lat, longitude: destination.lng },
          ]}
          strokeColor={colors.brandPrimary}
          strokeWidth={3}
          lineDashPattern={[8, 6]}
        />
        <Marker coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }} title="Restaurant" anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.pin, { backgroundColor: colors.surface, borderColor: colors.brandSecondary }]}>
            <Ionicons name="storefront" size={16} color={colors.brandSecondary} />
          </View>
        </Marker>
        <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }} title="Delivery address" anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.pin, { backgroundColor: colors.surface, borderColor: colors.success }]}>
            <Ionicons name="home" size={16} color={colors.success} />
          </View>
        </Marker>
        {showRider && rider ? (
          <Marker coordinate={{ latitude: rider.lat, longitude: rider.lng }} title="Your rider" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.riderPin, { backgroundColor: colors.brandPrimary, borderColor: colors.surface }]} testID="rider-marker">
              <Ionicons name="bicycle" size={16} color={colors.onBrandPrimary} />
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 220, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1 },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  riderPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
