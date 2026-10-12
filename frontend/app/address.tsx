import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { apiFetch } from "@/src/api/client";
import { EmptyState, showToast } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useLocationContext } from "@/src/context/location";

type Address = {
  id: string;
  label: string;
  line1: string;
  landmark?: string;
  city?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  is_default?: boolean;
};

const labelIcon = (label: string) =>
  label === "Home" ? "home-outline" : label === "Work" ? "briefcase-outline" : "location-outline";

export default function AddressScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isSelect = params.mode === "select";
  const { user } = useAuth();
  const { detect, detecting, setLocation } = useLocationContext();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);

  const load = async () => {
    if (!user) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<{ addresses: Address[] }>("/api/addresses");
      setAddresses(data.addresses);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]),
  );

  const useCurrentLocation = async () => {
    const result = await detect();
    if (result === "granted") {
      showToast("Location detected", "success");
      if (isSelect) router.back();
    } else if (result === "blocked") {
      setBlocked(true);
      showToast("Location permission is disabled", "error");
    } else if (result === "denied") {
      showToast("Location permission denied. You can add an address manually.", "info");
    } else {
      showToast("Could not detect location", "error");
    }
  };

  const selectAddress = (addr: Address) => {
    setLocation({
      label: addr.label,
      sublabel: [addr.line1, addr.landmark, addr.city, addr.pincode].filter(Boolean).join(", "),
      lat: addr.lat ?? null,
      lng: addr.lng ?? null,
      source: "saved",
    });
    if (isSelect) {
      router.back();
    } else {
      showToast("Delivery address set", "success");
    }
  };

  const deleteAddress = async (addr: Address) => {
    try {
      await apiFetch(`/api/addresses/${addr.id}`, { method: "DELETE" });
      setAddresses((prev) => prev.filter((a) => a.id !== addr.id));
      showToast("Address deleted", "info");
    } catch {
      showToast("Failed to delete address", "error");
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="address-screen">
      <View style={styles.header}>
        <Pressable testID="address-back" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1917" />
        </Pressable>
        <Text style={styles.title}>{isSelect ? "Select Address" : "Saved Addresses"}</Text>
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <Pressable testID="use-current-location" style={styles.gpsCard} onPress={useCurrentLocation}>
              <View style={styles.gpsIcon}>
                {detecting ? (
                  <ActivityIndicator color="#D95325" size="small" />
                ) : (
                  <Ionicons name="navigate" size={20} color="#D95325" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gpsTitle}>
                  {detecting ? "Detecting your location..." : "Use current location"}
                </Text>
                <Text style={styles.gpsSub}>Enable GPS for accurate doorstep delivery</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#7A746A" />
            </Pressable>

            {blocked ? (
              <Pressable
                testID="open-settings-button"
                style={styles.settingsBtn}
                onPress={() => Linking.openSettings()}
              >
                <Ionicons name="settings-outline" size={16} color="#D95325" />
                <Text style={styles.settingsText}>
                  Location is disabled — open Settings to enable
                </Text>
              </Pressable>
            ) : null}

            {user ? (
              <Pressable
                testID="add-address-button"
                style={styles.addBtn}
                onPress={() => router.push("/add-address")}
              >
                <Ionicons name="add" size={20} color="#D95325" />
                <Text style={styles.addText}>Add New Address</Text>
              </Pressable>
            ) : (
              <View style={styles.guestNote} testID="address-guest-note">
                <Text style={styles.guestNoteText}>
                  Log in to save and reuse delivery addresses.
                </Text>
                <Pressable testID="address-login-link" onPress={() => router.push("/login")} hitSlop={8}>
                  <Text style={styles.guestNoteLink}>Log in</Text>
                </Pressable>
              </View>
            )}

            {user && addresses.length > 0 ? <Text style={styles.sectionTitle}>Saved Addresses</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`address-card-${item.id}`}
            style={({ pressed }) => [styles.addressCard, pressed && { opacity: 0.94 }]}
            onPress={() => selectAddress(item)}
          >
            <View style={styles.addressIcon}>
              <Ionicons name={labelIcon(item.label) as any} size={18} color="#D95325" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.addressLabelRow}>
                <Text style={styles.addressLabel}>{item.label}</Text>
                {item.is_default ? (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.addressText} numberOfLines={2}>
                {[item.line1, item.landmark, item.city, item.pincode].filter(Boolean).join(", ")}
              </Text>
            </View>
            <Pressable
              testID={`address-edit-${item.id}`}
              hitSlop={8}
              style={styles.actionBtn}
              onPress={() =>
                router.push({
                  pathname: "/add-address",
                  params: {
                    id: item.id,
                    label: item.label,
                    line1: item.line1,
                    landmark: item.landmark ?? "",
                    city: item.city ?? "",
                    pincode: item.pincode ?? "",
                  },
                })
              }
            >
              <Ionicons name="pencil-outline" size={18} color="#7A746A" />
            </Pressable>
            <Pressable
              testID={`address-delete-${item.id}`}
              hitSlop={8}
              style={styles.actionBtn}
              onPress={() => deleteAddress(item)}
            >
              <Ionicons name="trash-outline" size={18} color="#D32F2F" />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading && user ? (
            <EmptyState
              icon="location-outline"
              title="No saved addresses"
              subtitle="Add a delivery location for faster checkout."
              testID="address-empty"
            />
          ) : null
        }
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  headerContent: { gap: spacing.md, marginBottom: spacing.xs },
  gpsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 64,
  },
  gpsIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsTitle: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg, color: colors.brandPrimary },
  gpsSub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  settingsText: { color: colors.brandPrimary, fontFamily: fonts.textMedium, fontSize: typeScale.base, flex: 1 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  addText: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg },
  guestNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  guestNoteText: { flex: 1, fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  guestNoteLink: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: typeScale.lg,
    color: colors.onSurface,
    marginTop: spacing.sm,
  },
  addressCard: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  addressLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  addressLabel: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg, color: colors.onSurface },
  defaultBadge: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  defaultBadgeText: { color: "#FFFFFF", fontFamily: fonts.displaySemiBold, fontSize: 10 },
  addressText: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, marginTop: 2 },
  actionBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
}));
