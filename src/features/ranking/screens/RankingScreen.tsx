import { useCallback, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { colors } from "@/shared/theme/tokens";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { getRankingParams, getRankingProfileParams } from "../api/ranking.contract";
import type { RankingItem } from "../api/ranking.types";
import { MyRankingCard } from "../components/MyRankingCard";
import { RankingBoardTabs } from "../components/RankingBoardTabs";
import { RankingCard } from "../components/RankingCard";
import { RankingGameFilter } from "../components/RankingGameFilter";
import { RankingPeriodTabs } from "../components/RankingPeriodTabs";
import { RankingRulesSheet } from "../components/RankingRulesSheet";
import { useRankingData } from "../hooks/use-ranking-data";
import { DEFAULT_RANKING_FILTERS, getRankingBoard } from "../ranking.config";

const emptyRows: RankingItem[] = [];

export default function RankingScreen({
  embedded = false,
}: {
  /** 作为首页顶部 tab 内嵌时为 true：顶部留白交给首页导航栏，只保留少量间距 */
  embedded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState(DEFAULT_RANKING_FILTERS);
  const [rulesVisible, setRulesVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { top, games, myRank, user, isAuthenticated } = useRankingData(filters);
  const board = getRankingBoard(filters.boardCode);
  const params = getRankingParams(filters);
  const listKey = `${params.boardCode}-${params.rankType}-${params.gameId}`;

  const viewProfile = useCallback((item: RankingItem) => {
    const profileParams = getRankingProfileParams(item);
    if (profileParams) router.push({ pathname: "/profile", params: profileParams });
  }, []);
  const renderItem = useCallback(({ item }: { item: RankingItem }) => (
    <RankingCard item={item} board={filters.boardCode} onViewProfile={viewProfile} />
  ), [filters.boardCode, viewProfile]);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        top.refetch(),
        ...(board.hasGame ? [games.refetch()] : []),
        ...(isAuthenticated ? [myRank.refetch()] : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  let emptyContent;
  if (top.data === undefined) {
    if (top.isError) {
      emptyContent = <ErrorState message={top.error.message} onRetry={() => void top.refetch()} />;
    } else if (top.fetchStatus === "paused") {
      emptyContent = <ErrorState message="网络未连接，请连接后重试" onRetry={() => void top.refetch()} />;
    } else {
      emptyContent = <LoadingState message="榜单加载中…" />;
    }
  } else {
    emptyContent = (
      <View style={styles.empty}>
        <EmptyState message="本期暂无上榜用户" />
        <Text style={styles.emptyHint}>试试其他游戏或切换榜单周期</Text>
        {board.hasGame && filters.gameId !== "0" && (
          <Pressable accessibilityRole="button" style={styles.reset} onPress={() => setFilters((value) => ({ ...value, gameId: "0" }))}>
            <Text style={styles.resetLabel}>查看总榜</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: embedded ? 6 : insets.top, paddingBottom: 60 + insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={styles.boardRow}>
        <RankingBoardTabs value={filters.boardCode} onChange={(boardCode) => setFilters((value) => ({ ...value, boardCode }))} />
        <Pressable accessibilityRole="button" accessibilityLabel="查看榜单规则" onPress={() => setRulesVisible(true)} style={styles.rulesButton}>
          <View style={styles.infoIcon}><Text style={styles.infoLabel}>i</Text></View>
          <Text style={styles.rulesLabel}>榜单规则</Text>
        </Pressable>
      </View>
      {board.hasGame && (
        <>
          <RankingGameFilter games={games.data ?? []} value={filters.gameId} onChange={(gameId) => setFilters((value) => ({ ...value, gameId }))} />
          {games.isError ? (
            <RetryNotice message="游戏筛选加载失败" onRetry={() => void games.refetch()} />
          ) : games.data === undefined ? (
            <Text style={styles.gameStatus}>{games.fetchStatus === "paused" ? "网络未连接，暂无法加载游戏" : "游戏筛选加载中…"}</Text>
          ) : null}
        </>
      )}
      <View style={styles.periodRow}>
        <RankingPeriodTabs value={filters.rankType} onChange={(rankType) => setFilters((value) => ({ ...value, rankType }))} />
        <Text style={styles.sortLabel}>按{board.metricLabel}排序</Text>
      </View>
      <FlatList
        key={listKey}
        data={top.data ?? emptyRows}
        keyExtractor={(item) => item.userId}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.brand} colors={[colors.brand]} />}
        ListHeaderComponent={top.data !== undefined && top.isError ? (
          <RetryNotice message="刷新失败，当前显示上次榜单" onRetry={() => void top.refetch()} />
        ) : null}
        ListEmptyComponent={emptyContent}
        ListFooterComponent={top.data?.length ? <Text style={styles.endNote}>已展示本期上榜用户</Text> : null}
      />
      {isAuthenticated && myRank.isError && (
        <RetryNotice message="我的排名暂不可用" onRetry={() => void myRank.refetch()} />
      )}
      {isAuthenticated && myRank.data?.visible && (
        <MyRankingCard rank={myRank.data} board={filters.boardCode} avatar={user?.headImage} />
      )}
      <RankingRulesSheet visible={rulesVisible} board={filters.boardCode} period={filters.rankType} onClose={() => setRulesVisible(false)} />
    </View>
  );
}

function RetryNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${message}，点击重试`} onPress={onRetry} style={styles.notice}>
      <Text style={styles.noticeMessage}>{message}</Text>
      <Text style={styles.retryLabel}>重试</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  boardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rulesButton: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44, paddingHorizontal: 16 },
  rulesLabel: { fontFamily: DOUYIN_SANS, fontSize: 11, color: colors.textSecondary },
  infoIcon: { width: 13, height: 13, borderRadius: 7, borderWidth: 1, borderColor: colors.textMuted, justifyContent: "center", alignItems: "center" },
  infoLabel: { fontSize: 9, fontWeight: "600", color: colors.textMuted, lineHeight: 11 },
  gameStatus: { fontFamily: DOUYIN_SANS, fontSize: 10, color: colors.textMuted, paddingHorizontal: 20, paddingTop: 4 },
  periodRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
  sortLabel: { fontFamily: DOUYIN_SANS, fontSize: 11, color: colors.textMuted, flexShrink: 1 },
  list: { flex: 1, backgroundColor: "#F7F7F9" },
  listContent: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  empty: { alignItems: "center" },
  emptyHint: { fontFamily: DOUYIN_SANS, fontSize: 11, color: colors.textMuted, marginTop: -12 },
  reset: { minHeight: 44, paddingHorizontal: 16, justifyContent: "center", marginTop: 12 },
  resetLabel: { fontFamily: DOUYIN_SANS, fontSize: 12, color: colors.brand },
  endNote: { fontFamily: DOUYIN_SANS, fontSize: 10, color: "#B0B0B8", textAlign: "center", paddingVertical: 14 },
  notice: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, gap: 12, backgroundColor: "#FFF5F5", borderRadius: 8 },
  noticeMessage: { flex: 1, fontFamily: DOUYIN_SANS, fontSize: 11, lineHeight: 17, color: colors.textSecondary },
  retryLabel: { fontFamily: DOUYIN_SANS, fontSize: 12, color: colors.brand },
});
