import { CourtHomeScreen } from "@/features/court/screens/CourtHomeScreen";
import GodListScreen from "@/features/god/screens/GodListScreen";
import RankingScreen from "@/features/ranking/screens/RankingScreen";
import type { GameKey, HomeTab } from "@/features/home/api/home.types";
import { ClubCard } from "@/features/home/components/ClubCard";
import {
  beginClubListScroll,
  CLUB_LIST_SCROLL_SETTLE_MS,
  initialClubListScrollState,
  markClubListEndReached,
  settleClubListScroll,
} from "@/features/home/club-list-scroll";
import { HomeHeader, HomeTopBar } from "@/features/home/components/HomeHeader";
import { HomeSkeleton } from "@/features/home/components/HomeSkeleton";
import {
  useHomeBanners,
  useHomeClubs,
  useHomeGameCategories,
  useHomeGames,
} from "@/features/home/hooks/use-home-data";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { showToast, toastDurations } from "@/shared/ui/app-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { reviewerApplied, ticketSubmitted } = useLocalSearchParams<{
    reviewerApplied?: string;
    ticketSubmitted?: string;
  }>();
  const [topTab, setTopTab] = useState<HomeTab>("home");
  // 顶部频道首次选中才挂载，之后保留筛选状态和列表滚动位置。
  const [mountedTabs, setMountedTabs] = useState<Record<HomeTab, boolean>>({
    home: true,
    god: false,
    ranking: false,
    court: false,
  });
  const [courtEntry, setCourtEntry] = useState(0);
  const [courtInitialPage, setCourtInitialPage] = useState<"court" | "ticket">(
    "court",
  );
  const [game, setGame] = useState<GameKey>("");
  const [category, setCategory] = useState("");
  const games = useHomeGames(topTab === "home" && focused);
  const categories = useHomeGameCategories(topTab === "home" && focused);
  const { refetch: refetchGames } = games;
  const { refetch: refetchCategories } = categories;
  const selectedCategory = categories.data?.some((item) => item.id === category)
    ? category
    : "";
  const categoryGames = useMemo(
    () =>
      (games.data ?? []).filter(
        (item) => !selectedCategory || item.gameCategoryId === selectedCategory,
      ),
    [games.data, selectedCategory],
  );
  // 后台移除已选品类时，同时清除该品类下的游戏筛选。
  const isCategoryAvailable = !category || selectedCategory !== "";
  const selectedGame =
    isCategoryAvailable &&
    categoryGames.some((item) => String(item.id) === game)
      ? game
      : "";
  const banners = useHomeBanners(topTab, focused);
  const clubs = useHomeClubs(
    topTab,
    {
      gameId: selectedGame || undefined,
      gameCategoryId: selectedCategory || undefined,
    },
    focused,
  );
  const bannerSlots = useMemo(() => banners.data ?? [], [banners.data]);

  // 用拖拽/惯性的起止事件跟踪列表滚动，不在逐帧 onScroll 里做 JS 状态更新。
  const scrollStateRef = useRef(initialClubListScrollState);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const clubsRef = useRef(clubs);
  useEffect(() => {
    clubsRef.current = clubs;
  });
  const markListScrollActive = useCallback(() => {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    const wasScrolling = scrollStateRef.current.scrolling;
    scrollStateRef.current = beginClubListScroll(scrollStateRef.current);
    if (!wasScrolling) {
      setCarouselPaused(true);
    }
  }, []);
  const flushPendingEndReached = useCallback(() => {
    const { pendingEndReached } = scrollStateRef.current;
    scrollStateRef.current = settleClubListScroll(scrollStateRef.current);
    setCarouselPaused(false);
    const current = clubsRef.current;
    if (pendingEndReached && current.hasNextPage && !current.isFetching) {
      current.fetchNextPage();
    }
  }, []);
  const scheduleListScrollSettle = useCallback(() => {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
    }
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      flushPendingEndReached();
    }, CLUB_LIST_SCROLL_SETTLE_MS);
  }, [flushPendingEndReached]);
  // 切走频道/失焦会中断惯性滚动事件流，滚动标志可能永远停在 true（轮播暂停、分页挂起失效），事件侧兜底复位。
  const resetListScrollState = useCallback(() => {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    if (scrollStateRef.current.scrolling || scrollStateRef.current.pendingEndReached) {
      scrollStateRef.current = initialClubListScrollState;
      setCarouselPaused(false);
    }
  }, []);
  useEffect(() => {
    return () => {
      if (settleTimer.current !== null) {
        clearTimeout(settleTimer.current);
      }
    };
  }, []);
  // 失焦（跳俱乐部详情等）时惯性事件流被切断，回来前先复位滚动标志。
  useFocusEffect(
    useCallback(() => {
      return () => {
        resetListScrollState();
      };
    }, [resetListScrollState]),
  );

  useFocusEffect(
    useCallback(() => {
      if (reviewerApplied !== "1" && ticketSubmitted !== "1") {
        return;
      }
      const timer = setTimeout(() => {
        setTopTab("court");
        setCourtInitialPage(ticketSubmitted === "1" ? "ticket" : "court");
        // 流程完成后打开对应的新加载列表。
        setCourtEntry((entry) => entry + 1);
        router.setParams({
          reviewerApplied: undefined,
          ticketSubmitted: undefined,
        });
        showToast(
          ticketSubmitted === "1"
            ? "提交成功"
            : "申请成功，请等待平台通知审核结果",
          {
            duration: toastDurations.LONG,
          },
        );
      }, 0);
      return () => clearTimeout(timer);
    }, [reviewerApplied, ticketSubmitted]),
  );

  const clubItems = useMemo(
    () => clubs.data?.pages.flatMap((page) => page.items) ?? [],
    [clubs.data],
  );
  const selectTopTab = useCallback((tab: HomeTab) => {
    resetListScrollState();
    setTopTab(tab);
    setMountedTabs((current) =>
      current[tab] ? current : { ...current, [tab]: true },
    );
  }, [resetListScrollState]);
  const selectCategory = useCallback((id: string) => {
    setCategory(id);
    setGame("");
  }, []);
  const retryFilters = useCallback(async () => {
    await Promise.all([refetchGames(), refetchCategories()]);
  }, [refetchGames, refetchCategories]);
  const refreshHome = async () => {
    await Promise.all([
      clubs.refetch(),
      games.refetch(),
      categories.refetch(),
      banners.refetch(),
    ]);
  };
  const loadMoreClubs = () => {
    if (!clubs.hasNextPage || clubs.isFetching) {
      return;
    }
    // 惯性滚动中触底先挂起，滚动稳定后补发，避免分页数据落地时整页重渲染与滚动抢主线程。
    if (scrollStateRef.current.scrolling) {
      scrollStateRef.current = markClubListEndReached(scrollStateRef.current);
      return;
    }
    clubs.fetchNextPage();
  };
  const renderClub = useCallback(
    ({ item }: { item: (typeof clubItems)[number] }) => (
      <ClubCard club={item} />
    ),
    [],
  );
  const header = useMemo(
    () => (
      <View style={styles.homeHeader}>
        <HomeHeader
          tab={topTab}
          game={selectedGame}
          games={categoryGames}
          categories={categories.data ?? []}
          category={selectedCategory}
          onCategoryChange={selectCategory}
          filterError={games.isError || categories.isError}
          onRetryFilters={retryFilters}
          bannerSlots={bannerSlots}
          onTabChange={selectTopTab}
          onGameChange={setGame}
          carouselPaused={carouselPaused}
        />
      </View>
    ),
    [
      topTab,
      selectedGame,
      categoryGames,
      categories.data,
      selectedCategory,
      selectCategory,
      games.isError,
      categories.isError,
      retryFilters,
      bannerSlots,
      selectTopTab,
      carouselPaused,
    ],
  );
  const isHomeLoading = games.isLoading || categories.isLoading;

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top },
      ]}
    >
      <HomeTopBar tab={topTab} onTabChange={selectTopTab} />
      <View style={styles.paneContainer}>
        {mountedTabs.home && (
          <View style={[styles.pane, topTab !== "home" && styles.paneHidden]}>
            {isHomeLoading ? (
              <HomeSkeleton bottomPadding={100 + insets.bottom} />
            ) : (
              <FlatList
                style={styles.clubList}
                data={clubItems}
                keyExtractor={(item) => item.id}
                renderItem={renderClub}
                ListHeaderComponent={header}
                contentContainerStyle={{
                  flexGrow: 1,
                  backgroundColor: "#fff",
                  paddingBottom: 100 + insets.bottom,
                }}
                refreshControl={
                  <RefreshControl
                    refreshing={
                      (clubs.isRefetching && !clubs.isFetchingNextPage) ||
                      games.isRefetching ||
                      categories.isRefetching ||
                      banners.isRefetching
                    }
                    onRefresh={refreshHome}
                    tintColor="#ff214b"
                  />
                }
                onEndReached={loadMoreClubs}
                onEndReachedThreshold={0.3}
                windowSize={7}
                maxToRenderPerBatch={6}
                updateCellsBatchingPeriod={50}
                initialNumToRender={8}
                onScrollBeginDrag={markListScrollActive}
                onScrollEndDrag={scheduleListScrollSettle}
                onMomentumScrollBegin={markListScrollActive}
                onMomentumScrollEnd={scheduleListScrollSettle}
                ListEmptyComponent={
                  clubs.isLoading ? (
                    <LoadingState />
                  ) : clubs.isError ? (
                    <ErrorState onRetry={clubs.refetch} />
                  ) : (
                    <EmptyState message="暂无俱乐部" />
                  )
                }
              />
            )}
          </View>
        )}
        {mountedTabs.god && (
          <View style={[styles.pane, topTab !== "god" && styles.paneHidden]}>
            <GodListScreen active={topTab === "god"} />
          </View>
        )}
        {mountedTabs.ranking && (
          <View style={[styles.pane, topTab !== "ranking" && styles.paneHidden]}>
            <RankingScreen embedded active={topTab === "ranking"} />
          </View>
        )}
        {topTab === "court" && (
          <CourtHomeScreen
            key={courtEntry}
            bottomInset={insets.bottom}
            initialPage={courtInitialPage}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: "100%", backgroundColor: "#F5F6F7" },
  homeHeader: { backgroundColor: "#F5F6F7" },
  clubList: { backgroundColor: "#F5F6F7" },
  paneContainer: { flex: 1 },
  pane: { flex: 1 },
  paneHidden: { display: "none" },
  emptyCourt: {
    minHeight: 500,
    alignItems: "center",
    justifyContent: "center",
  },
});
