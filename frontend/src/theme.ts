// Design tokens for DashBite. Light theme only.
// Values filled from /app/design_guidelines.json (iOS-Native Clean personality).

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces: warm sand palette
  surface: "#FDFBF7",
  onSurface: "#1A1917",
  surfaceSecondary: "#F4EFE6",
  onSurfaceSecondary: "#2C2A26",
  surfaceTertiary: "#EAE3D5",
  onSurfaceTertiary: "#403D36",
  surfaceInverse: "#1A1917",
  onSurfaceInverse: "#FDFBF7",
  muted: "#7A746A",

  // Brand: terracotta
  brand: "#D95325",
  onBrand: "#FFFFFF",
  brandPrimary: "#D95325",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#B84018",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#FBEAE5",
  onBrandTertiary: "#D95325",

  // Status
  success: "#388E3C",
  onSuccess: "#FFFFFF",
  warning: "#F57C00",
  onWarning: "#FFFFFF",
  error: "#D32F2F",
  onError: "#FFFFFF",
  info: "#0288D1",
  onInfo: "#FFFFFF",

  // Lines
  border: "#E2DACB",
  borderStrong: "#C8BCAB",
  divider: "#EFEAE0",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Typography (Plus Jakarta Sans for display, Geist for text)
export const fonts = {
  displayBold: "PlusJakartaSans-Bold",
  displaySemiBold: "PlusJakartaSans-SemiBold",
  displayMedium: "PlusJakartaSans-Medium",
  text: "Geist-Regular",
  textMedium: "Geist-Medium",
};

export const typeScale = { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
