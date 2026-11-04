import { useAuthStore } from "@esports/auth";
import { APP_LINKS } from "@/core/config/links";
import { fetchStarBalance } from "@/features/mine/api/companion-order.api";
import {
  chargeRecordsNextPage,
  fetchChargeRecords,
  type ChargeRecord,
} from "@/features/mine/api/recharge.api";
import { MyDiamondsBalanceCard } from "@/features/mine/components/MyDiamondsBalanceCard";
import { MyDiamondsEntry } from "@/features/mine/components/MyDiamondsEntry";
import { usePullToRefresh } from "@/shared/hooks/use-pull-to-refresh";
import { openInAppWebView } from "@/shared/navigation/open-web-view";
import { spacing } from "@/shared/theme/tokens";
import { EmptyState, ErrorState } from "@/shared/ui/AsyncStates";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useIsFocused } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const emptyIllustration = require("../../../../assets/svgs/my-diamonds-empty.svg");

const keyExtractor = (entry: ChargeRecord) => String(entry.id);

export default function MyDiamondsScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const accessToken = useAuthStore((state) => state.accessToken);
  const enabled = Boolean(accessToken) && focused;

  const balanceQuery = useQuery({
    queryKey: ["pay", "starBalance", accessToken],
    queryFn: () => fetchStarBalance(accessToken!),
    enabled,
    staleTime: 30_000,
  });

  const recordsQuery = useInfiniteQuery({
    queryKey: ["pay", "chargeRecords", accessToken],
    initialPageParam: 1,
    queryFn: ({ signal, pageParam }) =>
      fetchChargeRecords(accessToken!, pageParam, undefined, signal),
    getNextPageParam: (last, _pages, page) => chargeRecordsNextPage(last, page),
    enabled,
    staleTime: 30_000,
  });

  const entries = useMemo(
    () => recordsQuery.data?.pages.flatMap((page) => page.records ?? []) ?? [],
    [recordsQuery.data],
  );

  const pullToRefresh = usePullToRefresh(async () => {
    await Promise.all([balanceQuery.refetch(), recordsQuery.refetch()]);
  });

  const openRecharge = useCallback(() => {
    router.push("/star-recharge");
  }, []);

  const openAgreement = useCallback(() => {
    openInAppWebView(APP_LINKS.rechargeAgreement, "充值协议");
  }, []);

  const onEndReached = useCallback(() => {
    if (
      recordsQuery.hasNextPage &&
      !recordsQuery.isFetching &&
      !recordsQuery.isError
    ) {
      void recordsQuery.fetchNextPage();
    }
  }, [
    recordsQuery.hasNextPage,
    recordsQuery.isFetching,
    recordsQuery.isError,
    recordsQuery.fetchNextPage,
  ]);

  const renderItem = useCallback<ListRenderItem<ChargeRecord>>(
    ({ item }) => <MyDiamondsEntry entry={item} />,
    [],
  );

  const balance = balanceQuery.isError ? null : (balanceQuery.data ?? null);

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <View style={styles.cardWrap}>
          <MyDiamondsBalanceCard balance={balance} onRecharge={openRecharge} />
        </View>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>钻石明细</Text>
        </View>
      </View>
    ),
    [balance, openRecharge],
  );

  const listEmpty = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        {recordsQuery.isPending ? (
          <ActivityIndicator color="#FE1F4C" style={styles.loading} />
        ) : !recordsQuery.isError ? (
          <EmptyState
            message="空空如也～"
            style={styles.emptyState}
            illustration={
              <Image
                accessibilityIgnoresInvertColors
                contentFit="contain"
                source={emptyIllustration}
                style={styles.emptyIllustration}
              />
            }
          />
        ) : null}
      </View>
    ),
    [recordsQuery.isPending, recordsQuery.isError],
  );

  const listFooter = useMemo(() => {
    if (recordsQuery.isError && entries.length === 0) {
      return (
        <ErrorState
          message={recordsQuery.error.message}
          onRetry={() => recordsQuery.refetch()}
        />
      );
    }
    if (recordsQuery.isError) {
      return (
        <ErrorState
          message={recordsQuery.error.message}
          onRetry={() => {
            if (recordsQuery.isFetchNextPageError) {
              void recordsQuery.fetchNextPage();
            } else {
              void recordsQuery.refetch();
            }
          }}
        />
      );
    }
    if (recordsQuery.isFetchingNextPage) {
      return <ActivityIndicator color="#FE1F4C" style={styles.loading} />;
    }
    if (entries.length > 0 && !recordsQuery.hasNextPage) {
      return <Text style={styles.end}>没有更多啦～</Text>;
    }
    return null;
  }, [
    entries.length,
    recordsQuery.error,
    recordsQuery.fetchNextPage,
    recordsQuery.hasNextPage,
    recordsQuery.isError,
    recordsQuery.isFetchNextPageError,
    recordsQuery.isFetchingNextPage,
    recordsQuery.refetch,
  ]);

  const contentContainerStyle = useMemo(
    () => [
      styles.listContent,
      { paddingBottom: Math.max(insets.bottom, spacing.lg) },
      entries.length === 0 ? styles.listContentEmpty : null,
    ],
    [entries.length, insets.bottom],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="钻石"
        onBack={() => router.back()}
        backgroundColor="#FFFFFF"
        style={{ paddingTop: insets.top, height: insets.top + 44 }}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="充值协议"
            hitSlop={8}
            onPress={openAgreement}
            style={styles.agreementBtn}
          >
            <Text style={styles.agreementText}>充值协议</Text>
          </Pressable>
        }
      />

      {!enabled ? (
        <EmptyState message="请先登录后查看钻石" />
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          style={styles.list}
          data={entries}
          keyExtractor={keyExtractor}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={EntrySeparator}
          refreshing={focused && pullToRefresh.refreshing}
          onRefresh={pullToRefresh.onRefresh}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          renderItem={renderItem}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
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
  agreementBtn: {
    paddingRight: 16,
    paddingLeft: 12,
    height: "100%",
    justifyContent: "center",
  },
  agreementText: {
    color: "#0A0A0A",
    fontSize: 12,
    lineHeight: 18,
  },
  list: { flex: 1 },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  headerBlock: {
    marginHorizontal: -12,
    backgroundColor: "#FFFFFF",
  },
  cardWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  sectionTitleWrap: {
    paddingTop: 24,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 12,
    backgroundColor: "#F7F7F7",
  },
  sectionTitle: {
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  separator: { height: 8 },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    minHeight: 0,
    flexGrow: 0,
  },
  loading: { paddingVertical: spacing.xl },
  emptyIllustration: { width: 120, height: 120 },
  end: {
    textAlign: "center",
    color: "#999999",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "300",
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
});
