import React, { useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { EmptyState } from "@/src/components/ui";

const FAQS = [
  {
    category: "Orders",
    items: [
      { q: "How do I track my order?", a: "Open My Orders, tap any active order and hit Track Order. You'll see live status updates from the kitchen to your door." },
      { q: "Can I cancel my order?", a: "Orders can be cancelled within 60 seconds of placing them from the order details screen. Once the restaurant starts preparing, cancellation isn't possible." },
      { q: "My order is delayed. What do I do?", a: "Check the live ETA on the tracking screen. If it's significantly delayed, reach us via the contact options below and we'll make it right." },
    ],
  },
  {
    category: "Payments",
    items: [
      { q: "Which payment methods are accepted?", a: "We accept Cash on Delivery and online payments (UPI, cards, netbanking) via Razorpay's secure gateway." },
      { q: "My online payment failed but money was debited.", a: "Don't worry — failed payments are auto-refunded by Razorpay within 5-7 business days. Share the order ID with support for a faster resolution." },
    ],
  },
  {
    category: "Account",
    items: [
      { q: "How do I save multiple addresses?", a: "Go to Profile → Saved Addresses → Add New Address. You can tag addresses as Home, Work or Other." },
      { q: "Can I browse without an account?", a: "Yes! Guest browsing lets you explore restaurants and menus. You'll only need an account at checkout." },
    ],
  },
];

export default function Help() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const query = q.trim().toLowerCase();
  const filtered = FAQS.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (f) => !query || f.q.toLowerCase().includes(query) || f.a.toLowerCase().includes(query),
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="help-screen">
      <View style={styles.header}>
        <Pressable testID="help-back" onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1917" />
        </Pressable>
        <Text style={styles.title}>Help & Support</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#7A746A" />
          <TextInput
            testID="help-search-input"
            style={styles.searchInput}
            placeholder="Search help topics"
            placeholderTextColor="#7A746A"
            value={q}
            onChangeText={setQ}
          />
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            icon="help-circle-outline"
            title="No articles found"
            subtitle="Try a different keyword or contact us below."
            testID="help-empty"
          />
        ) : (
          filtered.map((cat) => (
            <View key={cat.category} style={styles.category}>
              <Text style={styles.categoryTitle}>{cat.category}</Text>
              <View style={styles.accordion}>
                {cat.items.map((f, i) => {
                  const key = `${cat.category}-${i}`;
                  const isOpen = open === key;
                  return (
                    <View key={key} style={[styles.faqItem, i > 0 && styles.faqBorder]}>
                      <Pressable
                        testID={`faq-${key}`}
                        style={styles.faqQuestion}
                        onPress={() => setOpen(isOpen ? null : key)}
                      >
                        <Text style={styles.faqQuestionText}>{f.q}</Text>
                        <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color="#7A746A" />
                      </Pressable>
                      {isOpen ? <Text style={styles.faqAnswer}>{f.a}</Text> : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}

        <View style={styles.contactCard} testID="help-contact-card">
          <View style={styles.contactIcon}>
            <Ionicons name="chatbubbles" size={22} color="#D95325" />
          </View>
          <Text style={styles.contactTitle}>Still need help?</Text>
          <Text style={styles.contactSub}>Our support team replies within minutes, 9 AM – 11 PM.</Text>
          <View style={styles.contactActions}>
            <Pressable
              testID="help-email-button"
              style={styles.contactBtn}
              onPress={() => Linking.openURL("mailto:support@dashbite.in")}
            >
              <Ionicons name="mail-outline" size={16} color="#FFFFFF" />
              <Text style={styles.contactBtnText}>Email Us</Text>
            </Pressable>
            <Pressable
              testID="help-call-button"
              style={[styles.contactBtn, styles.contactBtnGhost]}
              onPress={() => Linking.openURL("tel:+918047001234")}
            >
              <Ionicons name="call-outline" size={16} color="#D95325" />
              <Text style={styles.contactBtnGhostText}>Call Us</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontFamily: fonts.text, fontSize: typeScale.lg, color: colors.onSurface, paddingVertical: spacing.md },
  category: { gap: spacing.sm },
  categoryTitle: { fontFamily: fonts.displayBold, fontSize: typeScale.lg, color: colors.onSurface },
  accordion: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  faqItem: { padding: spacing.lg },
  faqBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  faqQuestion: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 32 },
  faqQuestionText: { flex: 1, fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  faqAnswer: { fontFamily: fonts.text, fontSize: typeScale.base, color: colors.muted, lineHeight: 21, marginTop: spacing.sm },
  contactCard: {
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  contactIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  contactTitle: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: colors.onSurface },
  contactSub: { fontFamily: fonts.text, fontSize: typeScale.base, color: colors.onSurfaceSecondary, textAlign: "center" },
  contactActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    minHeight: 48,
  },
  contactBtnText: { color: "#FFFFFF", fontFamily: fonts.displaySemiBold, fontSize: typeScale.base },
  contactBtnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.brandPrimary },
  contactBtnGhostText: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.base },
}));
