import { CourtHomeScreen } from "@/features/court/screens/CourtHomeScreen";
import type { GameKey, HomeTab } from "@/features/home/api/home.types";
import { ClubCard } from "@/features/home/components/ClubCard";
import { HomeBackground } from "@/features/home/components/HomeBackground";
import { HomeHeader, HomeTopBar } from "@/features/home/components/HomeHeader";
import { HomeSkeleton } from "@/features/home/components/HomeSkeleton";
import {
  useHomeBanners,
  useHomeClubs,
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
  const games = useHomeGames();
  const selectedGame = game || String(games.data?.[0]?.id ?? "");
  const [bannerIndex, setBannerIndex] = useState(0);
  const banners = useHomeBanners(topTab);
  const clubs = useHomeClubs(topTab, selectedGame);
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
    if (bannerItems.length < 2) return undefined;
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
        games={games.data ?? []}
        bannerIndex={bannerIndex}
        banners={bannerItems}
        onTabChange={selectTopTab}
        onGameChange={setGame}
      />
    ),
    [topTab, selectedGame, games.data, bannerIndex, bannerItems, selectTopTab],
  );
  const isHomeLoading = games.isLoading || banners.isLoading;

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
              refreshing={clubs.isRefetching && !clubs.isFetchingNextPage}
              onRefresh={() => void clubs.refetch()}
              tintColor="#ff214b"
            />
          }
          onEndReached={() => {
            if (clubs.hasNextPage && !clubs.isFetchingNextPage)
              void clubs.fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            clubs.isLoading ? (
              <LoadingState />
            ) : clubs.isError ? (
              <ErrorState onRetry={() => void clubs.refetch()} />
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
