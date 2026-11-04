import { SYSTEM_FONT } from "@/shared/theme/typography";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { Info16Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useIsFocused } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getRankingParams,
  getRankingProfileParams,
} from "../api/ranking.contract";
import type { RankingBoard, RankingItem } from "../api/ranking.types";
import { MyRankingCard } from "../components/MyRankingCard";
import { RankingBackground } from "../components/RankingBackground";
import { RankingBoardTabs } from "../components/RankingBoardTabs";
import { RankingCard } from "../components/RankingCard";
import { RankingGameFilter } from "../components/RankingGameFilter";
import { RankingPeriodTabs } from "../components/RankingPeriodTabs";
import { RankingRulesSheet } from "../components/RankingRulesSheet";
import { useRankingData } from "../hooks/use-ranking-data";
import { DEFAULT_RANKING_FILTERS, getRankingBoard } from "../ranking.config";

const godLabel = require("../../../../assets/svgs/ranking-title-god.svg");
const orderLabel = require("../../../../assets/svgs/ranking-title-order.svg");
const turnoverLabel = require("../../../../assets/svgs/ranking-title-turnover.svg");
const trophy = require("../../../../assets/svgs/ranking-trophy.svg");
const emptyRows: RankingItem[] = [];
const TAB_BAR_HEIGHT = 58;

export default function RankingScreen({
  embedded = false,
  active = true,
}: {
  /** 作为首页顶部 tab 内嵌时，安全区和首页大导航由父页面负责。 */
  embedded?: boolean;
  active?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [filters, setFilters] = useState(DEFAULT_RANKING_FILTERS);
  const [rulesVisible, setRulesVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { top, games, myRank, user, isAuthenticated } = useRankingData(
    filters,
    active && focused,
  );

  const board = getRankingBoard(filters.boardCode);
  const params = getRankingParams(filters);
  const listKey = `${params.boardCode}-${params.rankType}-${params.gameId}`;
  const visibleMyRank =
    isAuthenticated && myRank.data?.visible === true ? myRank.data : undefined;

  const viewProfile = useCallback((item: RankingItem) => {
    const profileParams = getRankingProfileParams(item);
    if (profileParams) {
      router.push({ pathname: "/profile", params: profileParams });
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: RankingItem }) => (
      <RankingCard
        item={item}
        board={filters.boardCode}
        onViewProfile={viewProfile}
      />
    ),
    [filters.boardCode, viewProfile],
  );

  const changeBoard = (boardCode: RankingBoard) => {
    setFilters((value) => ({ ...value, boardCode }));
  };

  const retryTop = () => {
    top.refetch();
  };

  const retryGames = () => {
    games.refetch();
  };

  const retryMyRank = () => {
    myRank.refetch();
  };

  const openRules = () => {
    setRulesVisible(true);
  };

  const closeRules = () => {
    setRulesVisible(false);
  };

  async function refresh() {
    if (refreshing) {
      return;
    }
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
      emptyContent = (
        <ErrorState message={top.error.message} onRetry={retryTop} />
      );
    } else if (top.fetchStatus === "paused") {
      emptyContent = (
        <ErrorState message="网络未连接，请连接后重试" onRetry={retryTop} />
      );
    } else {
      emptyContent = <LoadingState message="榜单加载中…" />;
    }
  } else {
    emptyContent = (
      <View style={styles.empty}>
        <EmptyState message="本期暂无上榜用户" />
        <Text style={styles.emptyHint}>试试其他游戏或切换榜单周期</Text>
        {board.hasGame && filters.gameId !== "0" ? (
          <Pressable
            accessibilityRole="button"
            style={styles.reset}
            onPress={() => setFilters((value) => ({ ...value, gameId: "0" }))}
          >
            <Text style={styles.resetLabel}>查看总榜</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        embedded && styles.embeddedScreen,
        {
          paddingTop: embedded ? 0 : insets.top,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {embedded ? null : <RankingBackground />}
      <View style={styles.boardTabsArea}>
        <RankingBoardTabs value={filters.boardCode} onChange={changeBoard} />
      </View>
      <RankingTitle board={filters.boardCode} />
      <View style={styles.panel}>
        <LinearGradient
          colors={["rgba(255,255,255,0.6)", "#FFFFFF", "#FFFFFF"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.controls}
        >
          {board.hasGame ? (
            <>
              <RankingGameFilter
                games={games.data ?? []}
                value={filters.gameId}
                onChange={(gameId) =>
                  setFilters((value) => ({ ...value, gameId }))
                }
              />
              {games.isError ? (
                <RetryNotice message="游戏筛选加载失败" onRetry={retryGames} />
              ) : games.data === undefined ? (
                <Text style={styles.gameStatus}>
                  {games.fetchStatus === "paused"
                    ? "网络未连接，暂无法加载游戏"
                    : "游戏筛选加载中…"}
                </Text>
              ) : null}
            </>
          ) : null}
          <View style={styles.periodRow}>
            <RankingPeriodTabs
              value={filters.rankType}
              onChange={(rankType) =>
                setFilters((value) => ({ ...value, rankType }))
              }
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看榜单规则"
              onPress={openRules}
              style={styles.rulesButton}
            >
              <Info16Regular color="#656566" />
              <Text style={styles.rulesLabel}>榜单规则</Text>
            </Pressable>
          </View>
        </LinearGradient>
        <RankingColumnHeader
          nameLabel={board.nameColumnLabel}
          metricLabel={board.metricLabel}
        />
        <FlatList
          key={listKey}
          data={top.data ?? emptyRows}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            visibleMyRank && styles.listContentWithMyRank,
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#FE1F4C"
              colors={["#FE1F4C"]}
            />
          }
          ListHeaderComponent={
            top.data !== undefined && top.isError ? (
              <RetryNotice
                message="刷新失败，当前显示上次榜单"
                onRetry={retryTop}
              />
            ) : null
          }
          ListEmptyComponent={emptyContent}
        />
      </View>
      {isAuthenticated && myRank.isError ? (
        <View style={styles.myRankNotice}>
          <RetryNotice message="我的排名暂不可用" onRetry={retryMyRank} />
        </View>
      ) : null}
      {visibleMyRank ? (
        <View
          style={[
            styles.myRank,
            { bottom: TAB_BAR_HEIGHT + insets.bottom + 10 },
          ]}
        >
          <MyRankingCard
            rank={visibleMyRank}
            board={filters.boardCode}
            avatar={user?.headImage}
            nickname={user?.nickname}
          />
        </View>
      ) : null}
      <RankingRulesSheet
        visible={active && rulesVisible}
        board={filters.boardCode}
        period={filters.rankType}
        onClose={closeRules}
      />
    </View>
  );
}

function RankingTitle({ board }: { board: RankingBoard }) {
  const titleSource =
    board === "GOD"
      ? godLabel
      : board === "ORDER_RECEIVE"
        ? orderLabel
        : turnoverLabel;

  return (
    <View style={styles.title}>
      <Image
        source={titleSource}
        contentFit="contain"
        style={styles.titleLabel}
      />
      <Image source={trophy} contentFit="contain" style={styles.trophy} />
    </View>
  );
}

function RankingColumnHeader({
  nameLabel,
  metricLabel,
}: {
  nameLabel: string;
  metricLabel: string;
}) {
  return (
    <View style={styles.columns}>
      <Text style={[styles.columnLabel, styles.rankColumn]}>排名</Text>
      <Text style={[styles.columnLabel, styles.nameColumn]}>{nameLabel}</Text>
      <Text style={[styles.columnLabel, styles.metricColumn]}>
        {metricLabel}
      </Text>
    </View>
  );
}

function RetryNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${message}，点击重试`}
      onPress={onRetry}
      style={styles.notice}
    >
      <Text style={styles.noticeMessage}>{message}</Text>
      <Text style={styles.retryLabel}>重试</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF8F1",
    overflow: "hidden",
  },
  embeddedScreen: { backgroundColor: "transparent" },
  boardTabsArea: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    height: 88,
    width: "100%",
    paddingTop: 24,
    position: "relative",
  },
  titleLabel: {
    height: 32,
    position: "absolute",
    left: 12,
    bottom: 25,
    width: 128,
  },
  trophy: {
    position: "absolute",
    bottom: -4,
    right: 12,
    width: 72,
    height: 72,
  },
  panel: {
    flex: 1,
    overflow: "hidden",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    borderTopColor: "#FFFFFF",
    backgroundColor: "#FFFFFF",
  },
  controls: { paddingTop: 4 },
  periodRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  rulesButton: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 12,
  },
  rulesLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
    color: "#656566",
  },
  gameStatus: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    lineHeight: 16,
    color: "#979799",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  columns: {
    minHeight: 34,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  columnLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
    color: "#979799",
  },
  rankColumn: { width: 44, textAlign: "center" },
  nameColumn: { flex: 1, paddingLeft: 40 },
  metricColumn: { width: 64, textAlign: "right" },
  list: { flex: 1, backgroundColor: "#FFFFFF" },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  listContentWithMyRank: { paddingBottom: 92 },
  empty: { alignItems: "center" },
  emptyHint: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    color: "#979799",
    marginTop: -12,
  },
  reset: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    marginTop: 12,
  },
  resetLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#FE1F4C",
  },
  myRank: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
  },
  myRankNotice: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: TAB_BAR_HEIGHT + 10,
    zIndex: 10,
  },
  notice: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    gap: 12,
    backgroundColor: "#FFF5F5",
    borderRadius: 8,
  },
  noticeMessage: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    lineHeight: 17,
    color: "#656566",
  },
  retryLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#FE1F4C",
  },
});
