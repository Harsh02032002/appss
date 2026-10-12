import React, { useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, Text, View, ViewToken } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, spacing, typeScale } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";
import { storage } from "@/src/utils/storage";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    image:
      "https://images.unsplash.com/photo-1526367790999-0150786686a2?q=80&w=1000&auto=format&fit=crop",
    title: "Lightning-fast delivery",
    subtitle: "Hot meals from your favourite restaurants, delivered in minutes.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1000&auto=format&fit=crop",
    title: "The city's best kitchens",
    subtitle: "Handpicked restaurants and master chefs, all in one place.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=1000&auto=format&fit=crop",
    title: "Track every bite",
    subtitle: "Watch your order live, from the kitchen flame to your door.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
    },
  ).current;

  const finish = async (destination: "/login" | "/home") => {
    await storage.setItem("dashbite_onboarded", true);
    router.replace(destination);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]} testID="onboarding-screen">
      <FlatList
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" transition={200} />
            <View style={styles.copy}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>
        )}
      />
      <View style={styles.dots} testID="onboarding-dots">
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <View style={styles.actions}>
        <PrimaryButton title="Get Started" onPress={() => finish("/login")} testID="onboarding-get-started" />
        <Pressable testID="onboarding-skip" onPress={() => finish("/home")} style={styles.skip}>
          <Text style={styles.skipText}>Explore as guest</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  image: { width, height: "58%", backgroundColor: colors.surfaceTertiary },
  copy: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.sm },
  title: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.onSurface, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.text, fontSize: typeScale.lg, color: colors.muted, lineHeight: 24 },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginVertical: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotActive: { width: 24, backgroundColor: colors.brandPrimary },
  actions: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  skip: { alignItems: "center", paddingVertical: spacing.md, minHeight: 44, justifyContent: "center" },
  skipText: { color: colors.brandPrimary, fontFamily: fonts.displaySemiBold, fontSize: typeScale.base },
}));
