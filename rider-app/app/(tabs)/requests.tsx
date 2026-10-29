import React, { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, spacing, typeScale, useTheme } from "@/src/theme";
import { EmptyState } from "@/src/components/ui";
import { RequestCard } from "@/src/components/request-card";
import { LocationBanner } from "@/src/components/location-banner";
import { useRider } from "@/src/context/rider";

export default function Requests() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { requests, assigned, activeOrder, loading, refresh, dashboard } = useRider();
  const [refreshing, setRefreshing] = useState(false);
  const online = dashboard?.rider.online ?? false;

  const data = [...assigned.filter((o) => o.id !== activeOrder?.id).map((o) => ({ o, assigned: true })), ...requests.map((o) => ({ o, assigned: false }))];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="requests-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Delivery requests</Text>
        <Text style={styles.subtitle}>
          {requests.length} open · {online ? "you're online" : "go online to accept"}
        </Text>
      </View>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <LocationBanner />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(x) => x.o.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await refresh();
                setRefreshing(false);
              }}
              tintColor={colors.brandPrimary}
            />
          }
          renderItem={({ item }) => <RequestCard order={item.o} assigned={item.assigned} />}
          ListEmptyComponent={<EmptyState icon="bicycle-outline" title="No requests right now" subtitle="Stay online — new delivery requests show up here instantly." testID="requests-empty" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { fontFamily: fonts.displayBold, fontSize: typeScale.xxl, color: colors.onSurface, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.text, fontSize: typeScale.sm, color: colors.muted },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
}));
