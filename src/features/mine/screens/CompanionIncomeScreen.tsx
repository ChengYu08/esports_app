import { usePullToRefresh } from "@/shared/hooks/use-pull-to-refresh";
import { colors, radius, spacing } from "@/shared/theme/tokens";
import { EmptyState, ErrorState } from "@/shared/ui/AsyncStates";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { companionManagementApi as api } from "../api/companion-management.api";
import {
  formatManagementNumber as format,
  walletNextPage,
  type WalletEntry,
} from "../api/companion-management.contract";
import { CompanionDashboardHeader } from "../components/CompanionDashboardHeader";
import { CompanionIncomeEntry } from "../components/CompanionIncomeEntry";
import { useManagementAccount } from "../hooks/use-companion-management";

const tabs = [
  { key: "settled", label: "已结算竹子" },
  { key: "pending", label: "待结算竹子" },
] as const;
type IncomeTab = (typeof tabs)[number]["key"];

export default function CompanionIncomeScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const account = useManagementAccount();
  const [tab, setTab] = useState<IncomeTab>("settled");
  const listRef = useRef<FlatList<WalletEntry>>(null);
  const enabled = account.enabled && focused;
  const settled = tab === "settled";
  const wallet = useQuery({
    queryKey: [...account.queryKey, "wallet"],
    queryFn: ({ signal }) => api.wallet(account.token, signal),
    enabled: enabled && !settled,
    staleTime: 0,
  });
  const ledger = useInfiniteQuery({
    queryKey: [...account.queryKey, "ledger", undefined],
    initialPageParam: 1,
    queryFn: ({ signal, pageParam }) =>
      api.walletPage(account.token, pageParam, undefined, signal),
    getNextPageParam: (last, _pages, page) => walletNextPage(last, page),
    enabled: enabled && settled,
    staleTime: 0,
  });
  const entries =
    ledger.data?.pages.flatMap((page) => page.records ?? []) ?? [];
  const pullToRefresh = usePullToRefresh(
    () => (settled ? ledger.refetch() : wallet.refetch()),
    tab,
  );
  const changeTab = (next: IncomeTab) => {
    if (next === tab) return;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    setTab(next);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <CompanionDashboardHeader title="竹子明细" />
        <View style={styles.tabs}>
          {tabs.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.key }}
              onPress={() => changeTab(item.key)}
              style={styles.tab}
            >
              <Text
                style={[styles.tabLabel, tab === item.key && styles.activeTab]}
              >
                {item.label}
              </Text>
              {tab === item.key ? <View style={styles.indicator} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
      {!account.enabled ? (
        <EmptyState message={account.unavailable ?? "暂无法查看竹子明细"} />
      ) : (
        <FlatList
          ref={listRef}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          style={styles.list}
          data={settled ? entries : []}
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
            if (
              settled &&
              ledger.hasNextPage &&
              !ledger.isFetching &&
              !ledger.isError
            )
              void ledger.fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            !settled ? (
              wallet.isError ? (
                <ErrorState
                  message={wallet.error.message}
                  onRetry={() => void wallet.refetch()}
                />
              ) : wallet.isPending ? (
                <ActivityIndicator
                  color={colors.brand}
                  style={styles.loading}
                />
              ) : (
                <View style={styles.pendingSummary}>
                  <Text style={styles.pendingLabel}>待结算竹子</Text>
                  <Text style={styles.pendingAmount}>
                    {format(wallet.data?.pendingPan)}
                  </Text>
                  <Text style={styles.pendingHint}>
                    订单完成后进入待结算，72小时锁定期结束后可提现
                  </Text>
                  <Text style={styles.pendingHint}>
                    暂不支持查看逐笔待结算明细
                  </Text>
                </View>
              )
            ) : ledger.isPending ? (
              <ActivityIndicator color={colors.brand} style={styles.loading} />
            ) : !ledger.isError ? (
              <EmptyState message="暂无已结算竹子明细" />
            ) : null
          }
          ListFooterComponent={
            !settled ? null : ledger.isError ? (
              <ErrorState
                message={ledger.error.message}
                onRetry={() =>
                  void (ledger.isFetchNextPageError
                    ? ledger.fetchNextPage()
                    : ledger.refetch())
                }
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
  tabs: {
    height: 54,
    paddingLeft: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl + spacing.xs,
  },
  tab: { minHeight: 44, justifyContent: "center", paddingVertical: 11 },
  tabLabel: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "400",
    color: "#656566",
  },
  activeTab: { fontSize: 16, fontWeight: "600", color: "#0D0D0F" },
  indicator: {
    height: 3,
    width: 12,
    borderRadius: 2,
    backgroundColor: "#FE1F4C",
    position: "absolute",
    bottom: 7,
    alignSelf: "center",
  },
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
  pendingSummary: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pendingLabel: { fontSize: 12, lineHeight: 18, color: "#7F7F80" },
  pendingAmount: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "600",
    color: "#0D0D0F",
  },
  pendingHint: { fontSize: 12, lineHeight: 18, color: "#999" },
});
