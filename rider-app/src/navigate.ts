import { Linking, Platform } from "react-native";

/** Opens turn-by-turn navigation in whatever maps app the device has — no API key needed. */
export function openNavigation(lat: number | undefined, lng: number | undefined, label: string) {
  if (lat == null || lng == null) {
    Linking.openURL(`https://www.openstreetmap.org/search?query=${encodeURIComponent(label)}`);
    return;
  }
  const url = Platform.select({
    ios: `maps://?daddr=${lat},${lng}&dirflg=d`,
    android: `google.navigation:q=${lat},${lng}&mode=d`,
    default: `https://www.openstreetmap.org/directions?route=;${lat},${lng}#map=15/${lat}/${lng}`,
  })!;
  Linking.openURL(url).catch(() => Linking.openURL(`geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`));
}
