import React from "react";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useFonts } from "expo-font";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { AuthProvider } from "@/src/context/auth";
import { RiderProvider } from "@/src/context/rider";
import { ToastHost } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const { colors } = useTheme();
  const [fontsLoaded] = useFonts({
    "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "PlusJakartaSans-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "Geist-Regular": require("../assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("../assets/fonts/Geist-Medium.ttf"),
    Ionicons: require("@react-native-vector-icons/ionicons/fonts/Ionicons.ttf"),
  });

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <KeyboardProvider>
        <AuthProvider>
          <RiderProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
            <ToastHost />
          </RiderProvider>
        </AuthProvider>
      </KeyboardProvider>
    </ErrorBoundary>
  );
}
