import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Location from "expo-location";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { apiFetch } from "@/src/api/client";
import { Chip, PrimaryButton, showToast } from "@/src/components/ui";
import { FormField } from "@/src/components/form";
import { useAuth } from "@/src/context/auth";

const LABELS = ["Home", "Work", "Other"];

export default function AddAddress() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    id?: string;
    label?: string;
    line1?: string;
    landmark?: string;
    city?: string;
    pincode?: string;
  }>();
  const editingId = params.id;

  const [label, setLabel] = useState(params.label || "Home");
  const [line1, setLine1] = useState(params.line1 || "");
  const [landmark, setLandmark] = useState(params.landmark || "");
  const [city, setCity] = useState(params.city || "");
  const [pincode, setPincode] = useState(params.pincode || "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const fillCurrentLocation = async () => {
    setLocating(true);
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let granted = existing.granted;
      if (!granted && existing.canAskAgain) {
        granted = (await Location.requestForegroundPermissionsAsync()).granted;
      }
      if (!granted) {
        showToast("Location permission denied — fill the form manually", "info");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const places = await Location.reverseGeocodeAsync(pos.coords);
      const p = places[0];
      if (p) {
        if (p.city) setCity(p.city);
        if (p.postalCode) setPincode(p.postalCode);
        if (!line1 && (p.name || p.street)) setLine1([p.name, p.street].filter(Boolean).join(", "));
      }
      showToast("Location filled from GPS", "success");
    } catch {
      showToast("Could not detect location", "error");
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!line1.trim()) {
      showToast("Please enter your house / flat / street", "error");
      return;
    }
    setSaving(true);
    try {
      const body = {
        label,
        line1: line1.trim(),
        landmark: landmark.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      };
      if (editingId) {
        await apiFetch(`/api/addresses/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
        showToast("Address updated", "success");
      } else {
        await apiFetch("/api/addresses", { method: "POST", body: JSON.stringify(body) });
        showToast("Address saved", "success");
      }
      router.back();
    } catch (e: any) {
      showToast(e.message || "Failed to save address", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loginNote}>Log in to save addresses.</Text>
        <View style={{ alignSelf: "stretch", padding: spacing.xl }}>
          <PrimaryButton title="Log In" onPress={() => router.push("/login")} testID="add-address-login" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="add-address-screen">
      <View style={styles.header}>
        <Pressable testID="add-address-back" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1917" />
        </Pressable>
        <Text style={styles.title}>{editingId ? "Edit Address" : "Add Address"}</Text>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Pressable
          testID="fill-current-location"
          style={styles.gpsBtn}
          onPress={fillCurrentLocation}
          disabled={locating}
        >
          <Ionicons name="navigate-outline" size={18} color="#D95325" />
          <Text style={styles.gpsText}>{locating ? "Detecting..." : "Fill from my current location"}</Text>
        </Pressable>

        <Text style={styles.fieldLabel}>Save as</Text>
        <View style={styles.labelRow} testID="address-tag-selector">
          {LABELS.map((l) => (
            <Chip
              key={l}
              label={l}
              active={label === l}
              onPress={() => setLabel(l)}
              testID={`address-tag-${l.toLowerCase()}`}
            />
          ))}
        </View>

        <FormField
          label="House / Flat / Street"
          value={line1}
          onChangeText={setLine1}
          placeholder="e.g. 402, Lotus Apartments, 5th Main Road"
          testID="address-line1-input"
          multiline
        />
        <FormField
          label="Landmark (optional)"
          value={landmark}
          onChangeText={setLandmark}
          placeholder="e.g. Near City Mall"
          testID="address-landmark-input"
        />
        <View style={styles.rowFields}>
          <View style={{ flex: 1 }}>
            <FormField label="City" value={city} onChangeText={setCity} placeholder="Bengaluru" testID="address-city-input" />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label="Pincode"
              value={pincode}
              onChangeText={setPincode}
              placeholder="560095"
              keyboardType="number-pad"
              testID="address-pincode-input"
            />
          </View>
        </View>

        <PrimaryButton
          title={editingId ? "Update Address" : "Save Address"}
          onPress={save}
          loading={saving}
          testID="address-save-button"
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  loginNote: { fontFamily: fonts.text, fontSize: typeScale.lg, color: colors.muted },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    borderRadius: radius.md,
    minHeight: 48,
  },
  gpsText: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.base },
  fieldLabel: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurfaceSecondary },
  labelRow: { flexDirection: "row", gap: spacing.sm },
  rowFields: { flexDirection: "row", gap: spacing.md },
}));
