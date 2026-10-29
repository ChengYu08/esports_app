import { CourtHomeScreen } from "@/features/court/screens/CourtHomeScreen";
import GodListScreen from "@/features/god/screens/GodListScreen";
import type { GameKey, HomeTab } from "@/features/home/api/home.types";
import { ClubCard } from "@/features/home/components/ClubCard";
import { HomeBackground } from "@/features/home/components/HomeBackground";
import { HomeHeader, HomeTopBar } from "@/features/home/components/HomeHeader";
import { HomeSkeleton } from "@/features/home/components/HomeSkeleton";
import {
  useHomeBanners,
  useHomeClubs,
  useHomeGameCategories,
  useHomeGames,
} from "@/features/home/hooks/use-home-data";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  RefreshControl,
  StyleSheet,
  View,
  useAnimatedValue,
  type LayoutChangeEvent,
} from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { reviewerApplied, ticketSubmitted } = useLocalSearchParams<{
    reviewerApplied?: string;
    ticketSubmitted?: string;
  }>();
  const [topTab, setTopTab] = useState<HomeTab>("home");
  const [courtEntry, setCourtEntry] = useState(0);
  const [courtInitialPage, setCourtInitialPage] = useState<"court" | "ticket">(
    "court",
  );
  const [game, setGame] = useState<GameKey>("");
  const [category, setCategory] = useState("");
  const scrollY = useAnimatedValue(0);
  const [headerHeight, setHeaderHeight] = useState(1);
  const measureHeader = useCallback((event: LayoutChangeEvent) => {
    setHeaderHeight(Math.max(1, event.nativeEvent.layout.height));
  }, []);
  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );
  const backgroundOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, headerHeight],
        outputRange: [0, 1],
        extrapolate: "clamp",
      }),
    [headerHeight, scrollY],
  );
  const games = useHomeGames();
  const categories = useHomeGameCategories();
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
  const banners = useHomeBanners(topTab);
  const clubs = useHomeClubs(topTab, {
    gameId: selectedGame || undefined,
    gameCategoryId: selectedCategory || undefined,
  });
  const bannerSlots = useMemo(() => banners.data ?? [], [banners.data]);

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
        Toast.show(
          ticketSubmitted === "1"
            ? "提交成功"
            : "申请成功，请等待平台通知审核结果",
          {
            duration: Toast.durations.LONG,
            position: Toast.positions.CENTER,
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
    setTopTab(tab);
  }, []);
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
    if (clubs.hasNextPage && !clubs.isFetching) {
      clubs.fetchNextPage();
    }
  };
  const renderClub = useCallback(
    ({ item }: { item: (typeof clubItems)[number] }) => (
      <ClubCard club={item} />
    ),
    [],
  );
  const header = useMemo(
    () => (
      <View onLayout={measureHeader} style={styles.homeHeader}>
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
      measureHeader,
    ],
  );
  const isHomeLoading = games.isLoading || categories.isLoading;

  // 切换顶部频道或重新挂载列表时，背景回到首屏状态。
  useEffect(() => {
    scrollY.setValue(0);
  }, [topTab, isHomeLoading, scrollY]);

  return (
    <View
      style={[
        styles.screen,
        topTab === "home" && styles.homeScreen,
        { paddingTop: insets.top },
      ]}
    >
      {topTab === "home" ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.topBackground,
            { height: insets.top + 44, opacity: backgroundOpacity },
          ]}
        >
          <HomeBackground />
        </Animated.View>
      ) : (
        <HomeBackground />
      )}
      <HomeTopBar tab={topTab} onTabChange={selectTopTab} />
      {isHomeLoading && topTab === "home" ? (
        <HomeSkeleton bottomPadding={100 + insets.bottom} />
      ) : topTab === "god" ? (
        <GodListScreen />
      ) : topTab === "court" ? (
        <CourtHomeScreen
          key={courtEntry}
          bottomInset={insets.bottom}
          initialPage={courtInitialPage}
        />
      ) : (
        <Animated.FlatList
          style={styles.clubList}
          data={clubItems}
          keyExtractor={(item) => item.id}
          renderItem={renderClub}
          ListHeaderComponent={header}
          contentContainerStyle={{
            flexGrow: 1,
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
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: "100%", backgroundColor: "#fff" },
  homeScreen: { backgroundColor: "#F5F6F7" },
  homeHeader: { backgroundColor: "#F5F6F7" },
  clubList: { backgroundColor: "#fff" },
  topBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  emptyCourt: {
    minHeight: 500,
    alignItems: "center",
    justifyContent: "center",
  },
});
