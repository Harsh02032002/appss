import React, { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { FormField } from "@/src/components/form";
import { PrimaryButton } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";

export default function Login() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your rider email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn(email.trim(), password);
      router.replace("/home");
    } catch (e: any) {
      setError(e.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="login-screen">
      <KeyboardAwareScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Ionicons name="bicycle" size={28} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.title}>Rider login</Text>
          <Text style={styles.subtitle}>Sign in to start accepting deliveries</Text>
        </View>
        <View style={styles.form}>
          <FormField label="Rider email" value={email} onChangeText={setEmail} placeholder="you@rider.dashbite.in" keyboardType="email-address" autoCapitalize="none" testID="login-email-input" />
          <FormField label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry autoCapitalize="none" testID="login-password-input" />
          {error ? (
            <Text style={styles.error} testID="login-error">
              {error}
            </Text>
          ) : null}
          <PrimaryButton title="Log In" onPress={submit} loading={loading} testID="login-submit-button" />
        </View>
        <View style={styles.hint} testID="login-hint">
          <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
          <Text style={styles.hintText}>
            Demo: <Text style={styles.hintStrong}>ravi@rider.dashbite.in</Text> / rider123
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, padding: spacing.xl, justifyContent: "center" },
  header: { gap: spacing.sm, marginBottom: spacing.xl },
  logoMark: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  title: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.onSurface, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.text, fontSize: typeScale.lg, color: colors.muted },
  form: { gap: spacing.lg },
  error: { color: colors.error, fontFamily: fonts.textMedium, fontSize: typeScale.base },
  hint: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  hintText: { flex: 1, fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, lineHeight: 18 },
  hintStrong: { fontFamily: fonts.textMedium, color: colors.onSurfaceSecondary },
}));
