import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, typeScale, useTheme } from "@/src/theme";
import { useOrdersFeed } from "@/src/context/orders-feed";
import type { Order } from "@/src/types";

/** Bottom sheets for Assign Rider and Reject Order. Control with `mode`. */
export function OrderActionSheet({
  order,
  mode,
  onClose,
}: {
  order: Order | null;
  mode: "assign" | "reject" | null;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { riders, act } = useOrdersFeed();
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = !!order && !!mode;

  const assign = async (riderId: string) => {
    if (!order) return;
    setBusyId(riderId);
    const res = await act(order, "assign", { rider_id: riderId });
    setBusyId(null);
    if (res) onClose();
  };

  const reject = async () => {
    if (!order) return;
    setBusyId("reject");
    const res = await act(order, "reject", { reason });
    setBusyId(null);
    if (res) {
      setReason("");
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} testID="sheet-backdrop" />
        <View style={styles.sheet} testID={mode === "assign" ? "assign-rider-sheet" : "reject-sheet"}>
        <View style={styles.handle} />
        {mode === "assign" ? (
          <>
            <Text style={styles.title}>Assign a rider</Text>
            <Text style={styles.subtitle}>Order #{order?.id.slice(-6).toUpperCase()} · choose who delivers it</Text>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: spacing.sm }}>
              {riders.map((r) => {
                const available = r.status === "available";
                return (
                  <Pressable
                    key={r.id}
                    testID={`rider-${r.id}`}
                    style={[styles.riderRow, !available && { opacity: 0.5 }]}
                    disabled={!available || !!busyId}
                    onPress={() => assign(r.id)}
                  >
                    <View style={styles.avatar}>
                      <Ionicons name="bicycle" size={18} color={colors.onBrandPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.riderName}>{r.name}</Text>
                      <Text style={styles.riderSub}>{r.vehicle}</Text>
                    </View>
                    {busyId === r.id ? (
                      <ActivityIndicator color={colors.brandPrimary} />
                    ) : (
                      <View style={[styles.statusPill, { backgroundColor: available ? colors.brandTertiary : colors.surfaceTertiary }]}>
                        <Text style={[styles.statusText, { color: available ? colors.success : colors.muted }]}>
                          {available ? "Available" : "Busy"}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <>
            <Text style={styles.title}>Reject this order?</Text>
            <Text style={styles.subtitle}>The customer will be notified and any payment refunded.</Text>
            <TextInput
              testID="reject-reason"
              style={styles.input}
              placeholder="Reason (e.g. item out of stock)"
              placeholderTextColor={colors.muted}
              value={reason}
              onChangeText={setReason}
              maxLength={200}
            />
            <View style={styles.row}>
              <Pressable testID="reject-cancel" style={styles.secondaryBtn} onPress={onClose}>
                <Text style={styles.secondaryText}>Keep order</Text>
              </Pressable>
              <Pressable testID="reject-confirm" style={[styles.dangerBtn, busyId && { opacity: 0.6 }]} onPress={reject} disabled={!!busyId}>
                {busyId ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.dangerText}>Reject order</Text>}
              </Pressable>
            </View>
          </>
        )}
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xl, color: colors.onSurface },
  subtitle: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted, marginTop: -spacing.sm },
  riderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 64,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  riderName: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  riderSub: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusText: { fontFamily: fonts.displaySemiBold, fontSize: 11 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.text,
    fontSize: typeScale.base,
    color: colors.onSurface,
  },
  row: { flexDirection: "row", gap: spacing.sm },
  secondaryBtn: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  secondaryText: { fontFamily: fonts.displaySemiBold, fontSize: typeScale.base, color: colors.onSurface },
  dangerBtn: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.error, borderRadius: radius.md },
  dangerText: { fontFamily: fonts.displayBold, fontSize: typeScale.base, color: colors.onBrandPrimary },
}));
