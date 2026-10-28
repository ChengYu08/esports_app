import { CourtHomeScreen } from "@/features/court/screens/CourtHomeScreen";
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
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
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
  const games = useHomeGames();
  const categories = useHomeGameCategories();
  const { refetch: refetchGames } = games;
  const { refetch: refetchCategories } = categories;
  const selectedCategory = categories.data?.some((item) => item.id === category) ? category : "";
  const categoryGames = useMemo(
    () => (games.data ?? []).filter((item) => !selectedCategory || item.gameCategoryId === selectedCategory),
    [games.data, selectedCategory],
  );
  // 后台移除已选品类时，同时清除该品类下的游戏筛选。
  const isCategoryAvailable = !category || selectedCategory !== "";
  const selectedGame = isCategoryAvailable && categoryGames.some((item) => String(item.id) === game) ? game : "";
  const [bannerIndex, setBannerIndex] = useState(0);
  const banners = useHomeBanners(topTab);
  const clubs = useHomeClubs(topTab, {
    gameId: selectedGame || undefined,
    gameCategoryId: selectedCategory || undefined,
  });
  const bannerItems = useMemo(() => banners.data ?? [], [banners.data]);

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

  useEffect(() => {
    if (bannerItems.length < 2) {
      return undefined;
    }
    const timer = setInterval(
      () => setBannerIndex((value) => (value + 1) % bannerItems.length),
      4000,
    );
    return () => clearInterval(timer);
  }, [bannerItems.length]);

  const clubItems = useMemo(
    () => clubs.data?.pages.flatMap((page) => page.items) ?? [],
    [clubs.data],
  );
  const selectTopTab = useCallback((tab: HomeTab) => {
    setBannerIndex(0);
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
    await Promise.all([clubs.refetch(), games.refetch(), categories.refetch()]);
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
      <HomeHeader
        tab={topTab}
        game={selectedGame}
        games={categoryGames}
        categories={categories.data ?? []}
        category={selectedCategory}
        onCategoryChange={selectCategory}
        filterError={games.isError || categories.isError}
        onRetryFilters={retryFilters}
        bannerIndex={bannerIndex}
        banners={bannerItems}
        onTabChange={selectTopTab}
        onGameChange={setGame}
      />
    ),
    [topTab, selectedGame, categoryGames, categories.data, selectedCategory, selectCategory, games.isError, categories.isError, retryFilters, bannerIndex, bannerItems, selectTopTab],
  );
  const isHomeLoading = games.isLoading || categories.isLoading || banners.isLoading;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <HomeBackground />
      <HomeTopBar tab={topTab} onTabChange={selectTopTab} />
      {isHomeLoading && topTab === "home" ? (
        <HomeSkeleton bottomPadding={100 + insets.bottom} />
      ) : topTab === "court" ? (
        <CourtHomeScreen
          key={courtEntry}
          bottomInset={insets.bottom}
          initialPage={courtInitialPage}
        />
      ) : (
        <FlatList
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
              refreshing={(clubs.isRefetching && !clubs.isFetchingNextPage) || games.isRefetching || categories.isRefetching}
              onRefresh={refreshHome}
              tintColor="#ff214b"
            />
          }
          onEndReached={loadMoreClubs}
          onEndReachedThreshold={0.3}
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
  emptyCourt: {
    minHeight: 500,
    alignItems: "center",
    justifyContent: "center",
  },
});
