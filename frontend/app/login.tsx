import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, spacing, typeScale } from "@/src/theme";
import { FormField } from "@/src/components/form";
import { PrimaryButton } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";

export default function Login() {
  const router = useRouter();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ redirect?: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn(email.trim(), password);
      router.replace((params.redirect as any) || "/home");
    } catch (e: any) {
      setError(e.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="login-screen">
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Ionicons name="fast-food" size={30} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to order your favourites</Text>
        </View>

        <View style={styles.form}>
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="login-email-input"
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            autoCapitalize="none"
            testID="login-password-input"
          />
          {error ? (
            <Text style={styles.error} testID="login-error">
              {error}
            </Text>
          ) : null}
          <PrimaryButton title="Log In" onPress={submit} loading={loading} testID="login-submit-button" />
        </View>

        <View style={styles.footer}>
          <Pressable
            testID="login-register-link"
            onPress={() => router.push({ pathname: "/register", params: { redirect: params.redirect ?? "" } })}
            style={styles.linkBtn}
          >
            <Text style={styles.footerText}>
              New to DashBite? <Text style={styles.link}>Create account</Text>
            </Text>
          </Pressable>
          <Pressable
            testID="login-guest-link"
            onPress={() => router.replace("/home")}
            style={styles.linkBtn}
          >
            <Text style={styles.guest}>Continue as guest</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, padding: spacing.xl, justifyContent: "center" },
  header: { alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.xl },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.onSurface, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.text, fontSize: typeScale.lg, color: colors.muted },
  form: { gap: spacing.lg },
  error: { color: colors.error, fontFamily: fonts.textMedium, fontSize: typeScale.base },
  footer: { marginTop: spacing.xl, alignItems: "center", gap: spacing.xs },
  linkBtn: { minHeight: 44, justifyContent: "center" },
  footerText: { color: colors.muted, fontFamily: fonts.text, fontSize: typeScale.base },
  link: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold },
  guest: { color: colors.onSurfaceTertiary, fontFamily: fonts.textMedium, fontSize: typeScale.base },
}));
