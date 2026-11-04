import { usePullToRefresh } from "@/shared/hooks/use-pull-to-refresh";
import { colors, spacing } from "@/shared/theme/tokens";
import { EmptyState, ErrorState } from "@/shared/ui/AsyncStates";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { companionManagementApi as api } from "../api/companion-management.api";
import { walletNextPage } from "../api/companion-management.contract";
import { CompanionDashboardHeader } from "../components/CompanionDashboardHeader";
import { CompanionIncomeEntry } from "../components/CompanionIncomeEntry";
import { useManagementAccount } from "../hooks/use-companion-management";

export default function CompanionIncomeScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const account = useManagementAccount();
  const ledger = useInfiniteQuery({
    queryKey: [...account.queryKey, "ledger", undefined],
    initialPageParam: 1,
    queryFn: ({ signal, pageParam }) =>
      api.walletPage(account.token, pageParam, undefined, signal),
    getNextPageParam: (last, _pages, page) => walletNextPage(last, page),
    enabled: account.enabled && focused,
    staleTime: 0,
  });
  const entries = ledger.data?.pages.flatMap((page) => page.records ?? []) ?? [];
  const pullToRefresh = usePullToRefresh(() => ledger.refetch());

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <CompanionDashboardHeader title="竹子明细" />
      </View>
      {!account.enabled ? (
        <EmptyState message={account.unavailable ?? "暂无法查看竹子明细"} />
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          style={styles.list}
          data={entries}
          keyExtractor={(entry) => String(entry.id)}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={EntrySeparator}
          refreshing={focused && pullToRefresh.refreshing}
          onRefresh={pullToRefresh.onRefresh}
          onEndReached={() => {
            if (ledger.hasNextPage && !ledger.isFetching && !ledger.isError) {
              ledger.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            ledger.isPending ? (
              <ActivityIndicator color={colors.brand} style={styles.loading} />
            ) : !ledger.isError ? (
              <EmptyState message="暂无竹子明细" />
            ) : null
          }
          ListFooterComponent={
            ledger.isError ? (
              <ErrorState
                message={ledger.error.message}
                onRetry={() => {
                  if (ledger.isFetchNextPageError) {
                    ledger.fetchNextPage();
                  } else {
                    ledger.refetch();
                  }
                }}
              />
            ) : ledger.isFetchingNextPage ? (
              <ActivityIndicator color={colors.brand} style={styles.loading} />
            ) : entries.length > 0 && !ledger.hasNextPage ? (
              <Text style={styles.end}>没有更多啦～</Text>
            ) : null
          }
          renderItem={({ item }) => <CompanionIncomeEntry entry={item} />}
        />
      )}
    </View>
  );
}

function EntrySeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: { backgroundColor: colors.surface },
  list: { flex: 1 },
  listContent: { padding: spacing.md },
  separator: { height: spacing.sm },
  loading: { paddingVertical: spacing.xl },
  end: {
    textAlign: "center",
    color: "#999",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "300",
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
});
