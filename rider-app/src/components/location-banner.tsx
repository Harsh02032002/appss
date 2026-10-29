import React from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { useRider } from "@/src/context/rider";

/** Shown when location permission is missing — never dead-ends the rider. */
export function LocationBanner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { locationState, requestLocation, openSettings } = useRider();
  if (locationState === "granted" || locationState === "idle" || locationState === "requesting") return null;

  const blocked = locationState === "blocked";
  return (
    <View style={styles.banner} testID="location-banner">
      <Ionicons name="location-outline" size={20} color={colors.error} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{locationState === "error" ? "GPS unavailable" : "Location access needed"}</Text>
        <Text style={styles.sub}>
          {locationState === "error"
            ? "Turn on GPS so customers can see you on the map."
            : "We share your live position with the customer only during a delivery."}
        </Text>
      </View>
      <Pressable testID="location-action" style={styles.btn} onPress={blocked ? openSettings : requestLocation}>
        <Text style={styles.btnText}>{blocked ? "Open Settings" : "Allow"}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  title: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  sub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.onSurfaceSecondary, lineHeight: 17 },
  btn: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  btnText: { color: colors.onBrandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm },
}));
