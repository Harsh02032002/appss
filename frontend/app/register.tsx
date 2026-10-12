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

export default function Register() {
  const router = useRouter();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const params = useLocalSearchParams<{ redirect?: string }>();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signUp(name.trim(), email.trim(), phone.trim(), password);
      router.replace((params.redirect as any) || "/home");
    } catch (e: any) {
      setError(e.message || "Registration failed. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="register-screen">
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Pressable testID="register-back" onPress={() => router.back()} style={styles.back} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={styles.backIcon.color} />
        </Pressable>
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join DashBite and start ordering</Text>
        </View>

        <View style={styles.form}>
          <FormField label="Full Name" value={name} onChangeText={setName} placeholder="Asha Verma" testID="register-name-input" />
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="register-email-input"
          />
          <FormField
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            placeholder="98765 43210"
            keyboardType="phone-pad"
            testID="register-phone-input"
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Minimum 6 characters"
            secureTextEntry
            autoCapitalize="none"
            testID="register-password-input"
          />
          {error ? (
            <Text style={styles.error} testID="register-error">
              {error}
            </Text>
          ) : null}
          <PrimaryButton title="Create Account" onPress={submit} loading={loading} testID="register-submit-button" />
        </View>

        <Pressable
          testID="register-login-link"
          onPress={() => router.back()}
          style={styles.loginLink}
        >
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.link}>Log in</Text>
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, padding: spacing.xl },
  back: { width: 44, height: 44, justifyContent: "center" },
  backIcon: { color: colors.onSurface },
  header: { gap: spacing.sm, marginBottom: spacing.xl, marginTop: spacing.md },
  title: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.onSurface, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.text, fontSize: typeScale.lg, color: colors.muted },
  form: { gap: spacing.lg },
  error: { color: colors.error, fontFamily: fonts.textMedium, fontSize: typeScale.base },
  loginLink: { marginTop: spacing.xl, alignItems: "center", minHeight: 44, justifyContent: "center" },
  footerText: { color: colors.muted, fontFamily: fonts.text, fontSize: typeScale.base },
  link: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold },
}));
