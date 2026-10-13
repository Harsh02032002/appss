import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";

export const inr = (paise: number) => `₹${Math.round(paise / 100)}`;

// ---------------------------------------------------------------- Toasts
type ToastType = "info" | "success" | "error";
type ToastListener = (message: string, type: ToastType) => void;
const listeners = new Set<ToastListener>();

export function showToast(message: string, type: ToastType = "info") {
  listeners.forEach((l) => l(message, type));
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const translateY = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    const listener: ToastListener = (message, type) => {
      setToast({ message, type });
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(translateY, { toValue: -80, duration: 220, useNativeDriver: true }).start(
          () => setToast(null),
        );
      }, 2400);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [translateY]);

  if (!toast) return null;
  const bg =
    toast.type === "success" ? colors.success : toast.type === "error" ? colors.error : colors.surfaceInverse;
  const fg = toast.type === "info" ? colors.onSurfaceInverse : colors.onSuccess;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        toastStyles.wrap,
        { top: insets.top + spacing.sm, backgroundColor: bg, transform: [{ translateY }] },
      ]}
      testID="toast-banner"
    >
      <Text style={[toastStyles.text, { color: fg }]} numberOfLines={2}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignSelf: "center",
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    zIndex: 999,
    ...(Platform.OS === "web" ? { position: "fixed" as any } : {}),
  },
  text: { fontFamily: fonts.textMedium, fontSize: typeScale.base, textAlign: "center" },
});

// ---------------------------------------------------------------- Buttons
export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  testID,
  icon,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const styles = useButtonStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primary,
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={colors.onBrandPrimary} /> : null}
      <Text style={styles.primaryText}>{loading ? "Please wait..." : title}</Text>
    </Pressable>
  );
}

const useButtonStyles = makeStyles((colors) => ({
  primary: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  primaryText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.lg,
  },
}));

// ---------------------------------------------------------------- Chips (P0: one horizontal row, never wraps)
export function Chip({
  label,
  active,
  onPress,
  testID,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
  icon?: string;
}) {
  const styles = useChipStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      {icon ? <Ionicons name={icon as any} size={14} color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useChipStyles = makeStyles((colors) => ({
  chip: {
    flexShrink: 0,
    flexDirection: "row",
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.textMedium, fontSize: typeScale.base },
  chipTextActive: { color: colors.onBrandPrimary },
}));

// ---------------------------------------------------------------- Misc
export function VegBadge({ veg }: { veg: boolean }) {
  const { colors } = useTheme();
  const color = veg ? colors.success : colors.error;
  return (
    <View style={[miscStyles.veg, { borderColor: color }]} testID={veg ? "veg-badge" : "nonveg-badge"}>
      <View style={[miscStyles.vegDot, { backgroundColor: color }]} />
    </View>
  );
}

export function RatingBadge({ rating }: { rating: number }) {
  const { colors } = useTheme();
  return (
    <View style={[miscStyles.rating, { backgroundColor: colors.success }]} testID="rating-badge">
      <Text style={[miscStyles.ratingText, { color: colors.onSuccess }]}>{rating.toFixed(1)}</Text>
      <Ionicons name="star" size={10} color={colors.onSuccess} />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={miscStyles.empty} testID={testID}>
      <Ionicons name={icon} size={48} color={colors.muted} />
      <Text style={[miscStyles.emptyTitle, { color: colors.onSurface }]}>{title}</Text>
      {subtitle ? (
        <Text style={[miscStyles.emptySubtitle, { color: colors.muted }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.lg, alignSelf: "stretch" }}>
          <PrimaryButton title={actionLabel} onPress={onAction} testID={`${testID}-action`} />
        </View>
      ) : null}
    </View>
  );
}

const miscStyles = StyleSheet.create({
  veg: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: { fontFamily: fonts.displaySemiBold, fontSize: 11 },
  empty: { alignItems: "center", justifyContent: "center", padding: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg, textAlign: "center", marginTop: spacing.sm },
  emptySubtitle: { fontFamily: fonts.text, fontSize: typeScale.base, textAlign: "center" },
});
