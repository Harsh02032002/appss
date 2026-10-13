import React from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale } from "@/src/theme";
import { inr, VegBadge } from "@/src/components/ui";

export type MenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  veg: boolean;
  category: string;
  image: string;
  bestseller?: boolean;
  rating?: number;
  restaurant_name?: string;
  available?: boolean;
};

export function QtyStepper({
  qty,
  onInc,
  onDec,
  testID,
}: {
  qty: number;
  onInc: () => void;
  onDec: () => void;
  testID: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.stepper} testID={testID}>
      <Pressable testID={`${testID}-minus`} onPress={onDec} hitSlop={8} style={styles.stepBtn}>
        <Ionicons name="remove" size={16} color="#FFFFFF" />
      </Pressable>
      <Text style={styles.stepQty}>{qty}</Text>
      <Pressable testID={`${testID}-plus`} onPress={onInc} hitSlop={8} style={styles.stepBtn}>
        <Ionicons name="add" size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

export function MenuItemRow({
  item,
  qty,
  onAdd,
  onInc,
  onDec,
}: {
  item: MenuItem;
  qty: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const styles = useStyles();
  const router = useRouter();
  const unavailable = item.available === false;

  return (
    <Pressable
      testID={`menu-item-${item.id}`}
      style={[styles.row, unavailable && styles.rowDisabled]}
      onPress={() => router.push(`/item/${item.id}`)}
      disabled={unavailable}
    >
      <View style={styles.info}>
        <View style={styles.badgeRow}>
          <VegBadge veg={item.veg} />
          {item.bestseller ? <Text style={styles.bestseller}>Bestseller</Text> : null}
        </View>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>{inr(item.price)}</Text>
        {item.rating ? (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={11} color="#F57C00" />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        ) : null}
        <Text style={styles.desc} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      <View style={styles.imageWrap}>
        <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" transition={150} />
        <View style={styles.addWrap}>
          {unavailable ? (
            <View style={[styles.addBtn, styles.addBtnDisabled]} testID={`unavailable-${item.id}`}>
              <Text style={styles.unavailableText}>Unavailable</Text>
            </View>
          ) : qty > 0 ? (
            <QtyStepper qty={qty} onInc={onInc} onDec={onDec} testID={`stepper-${item.id}`} />
          ) : (
            <Pressable testID={`add-${item.id}`} style={styles.addBtn} onPress={onAdd}>
              <Text style={styles.addText}>ADD</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  row: {
    flexDirection: "row",
    paddingVertical: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowDisabled: { opacity: 0.55 },
  info: { flex: 1, gap: spacing.xs },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bestseller: {
    color: colors.warning,
    fontFamily: fonts.textMedium,
    fontSize: typeScale.sm,
  },
  name: { color: colors.onSurface, fontFamily: fonts.displaySemiBold, fontSize: typeScale.lg },
  price: { color: colors.onSurface, fontFamily: fonts.textMedium, fontSize: typeScale.base },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { color: colors.muted, fontFamily: fonts.text, fontSize: typeScale.sm },
  desc: { color: colors.muted, fontFamily: fonts.text, fontSize: typeScale.sm, lineHeight: 17 },
  imageWrap: { width: 108 },
  image: { width: 108, height: 96, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  addWrap: { position: "absolute", bottom: -14, left: 8, right: 8 },
  addBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    borderRadius: radius.sm,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.onSurface,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  addText: { color: colors.brandPrimary, fontFamily: fonts.displayBold, fontSize: typeScale.base },
  addBtnDisabled: { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  unavailableText: { color: colors.muted, fontFamily: fonts.displaySemiBold, fontSize: typeScale.sm },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.sm,
    height: 36,
    paddingHorizontal: spacing.sm,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stepBtn: { padding: spacing.xs },
  stepQty: { color: "#FFFFFF", fontFamily: fonts.displayBold, fontSize: typeScale.base },
}));
