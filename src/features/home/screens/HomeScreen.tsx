import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeBackground } from "@/features/home/components/HomeBackground";
import { ClubCard } from "@/features/home/components/ClubCard";
import { HomeHeader } from "@/features/home/components/HomeHeader";
import { HomeSkeleton } from "@/features/home/components/HomeSkeleton";
import { useHomeBanners, useHomeClubs, useHomeGames } from "@/features/home/hooks/use-home-data";
import type { GameKey, HomeTab } from "@/features/home/api/home.types";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [topTab, setTopTab] = useState<HomeTab>("home");
  const [game, setGame] = useState<GameKey>("");
  const games = useHomeGames();
  const selectedGame = game || String(games.data?.[0]?.id ?? "");
  const [bannerIndex, setBannerIndex] = useState(0);
  const banners = useHomeBanners(topTab);
  const clubs = useHomeClubs(topTab, selectedGame);
  const bannerItems = useMemo(() => banners.data ?? [], [banners.data]);

  useEffect(() => {
    if (bannerItems.length < 2) return undefined;
    const timer = setInterval(() => setBannerIndex((value) => (value + 1) % bannerItems.length), 4000);
    return () => clearInterval(timer);
  }, [bannerItems.length]);

  const clubItems = useMemo(() => clubs.data?.pages.flatMap((page) => page.items) ?? [], [clubs.data]);
  const selectTopTab = useCallback((tab: HomeTab) => { setBannerIndex(0); setTopTab(tab); }, []);
  const renderClub = useCallback(
    ({ item }: { item: (typeof clubItems)[number] }) => <ClubCard club={item} />,
    [],
  );
  const header = useMemo(
    () => <HomeHeader tab={topTab} game={selectedGame} games={games.data ?? []} bannerIndex={bannerIndex} banners={bannerItems} onTabChange={selectTopTab} onGameChange={setGame} />,
    [topTab, selectedGame, games.data, bannerIndex, bannerItems, selectTopTab],
  );
  const isHomeLoading = games.isLoading || banners.isLoading || (selectedGame.length > 0 && clubs.isLoading);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <HomeBackground />
      {isHomeLoading && topTab === "home" ? (
        <HomeSkeleton bottomPadding={100 + insets.bottom} />
      ) : topTab === "court" ? (
        <FlatList data={[]} ListHeaderComponent={header} renderItem={null} ListEmptyComponent={<View style={styles.emptyCourt}><EmptyState message="小法庭功能即将上线" /></View>} />
      ) : (
        <FlatList
          data={clubItems}
          keyExtractor={(item) => item.id}
          renderItem={renderClub}
          ListHeaderComponent={header}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={clubs.isRefetching && !clubs.isFetchingNextPage} onRefresh={() => void clubs.refetch()} tintColor="#ff214b" />}
          onEndReached={() => { if (clubs.hasNextPage && !clubs.isFetchingNextPage) void clubs.fetchNextPage(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={clubs.isLoading ? <LoadingState /> : clubs.isError ? <ErrorState onRetry={() => void clubs.refetch()} /> : <EmptyState message="暂无俱乐部" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: "100%", backgroundColor: "#fff" },
  emptyCourt: { minHeight: 500, alignItems: "center", justifyContent: "center" },
});
