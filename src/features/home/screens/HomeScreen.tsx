import { HomeBackground } from "@/features/home/components/HomeBackground";
import { ClubCard } from "@/features/home/components/ClubCard";
import { HomeBottomNav } from "@/features/home/components/HomeBottomNav";
import { HomeHeader } from "@/features/home/components/HomeHeader";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { useHomeBanners, useHomeClubs } from "@/features/home/hooks/use-home-data";
import type { GameKey, HomeTab } from "@/features/home/api/home.types";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [topTab, setTopTab] = useState<HomeTab>("home");
  const [game, setGame] = useState<GameKey>("pc");
  const [bannerIndex, setBannerIndex] = useState(0);
  const banners = useHomeBanners(topTab);
  const clubs = useHomeClubs(topTab, game);
  const bannerItems = banners.data ?? [];
  useEffect(() => {
    if (bannerItems.length < 2) return undefined;
    const timer = setInterval(
      () => setBannerIndex((v) => (v + 1) % bannerItems.length),
      4000,
    );
    return () => clearInterval(timer);
  }, [bannerItems.length]);
  const clubItems = useMemo(
    () => clubs.data?.pages.flatMap((p) => p.items) ?? [],
    [clubs.data],
  );
  const selectTopTab = (tab: HomeTab) => {
    setBannerIndex(0);
    setTopTab(tab);
  };
  const header = <HomeHeader tab={topTab} game={game} bannerIndex={bannerIndex} banners={bannerItems} onTabChange={selectTopTab} onGameChange={setGame} />;
  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <HomeBackground />
      {topTab === "court" ? (
        <FlatList
          data={[]}
          ListHeaderComponent={header}
          renderItem={null}
          ListEmptyComponent={
            <View style={s.emptyCourt}>
              <Text style={s.empty}>小法庭</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={clubItems}
          keyExtractor={(x) => x.id}
          renderItem={({ item }) => <ClubCard club={item} />}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
          refreshControl={
            <RefreshControl
              refreshing={clubs.isRefetching && !clubs.isFetchingNextPage}
              onRefresh={() => clubs.refetch()}
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
              <Text style={s.empty}>加载中…</Text>
            ) : clubs.isError ? (
              <Retry onRetry={() => clubs.refetch()} />
            ) : (
              <Text style={s.empty}>暂无俱乐部</Text>
            )
          }
        />
      )}
      <HomeBottomNav insetsBottom={insets.bottom} />
    </View>
  );
}
function Retry({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={s.retryWrap}>
      <Text style={s.empty}>加载失败，请重试</Text>
      <Pressable onPress={onRetry} style={s.retry}>
        <Text style={s.retryText}>重试</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, width: "100%", backgroundColor: "#fff" },
  topBar: {
    height: 44,
    paddingLeft: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTabs: { flexDirection: "row", gap: 20, height: "100%" },
  tab: { justifyContent: "center", minWidth: 42, position: "relative" },
  tabText: {
    fontFamily: DOUYIN_SANS,
    color: "#999",
    fontSize: 18,
    fontWeight: "400",
  },
  tabSelected: {
    fontFamily: DOUYIN_SANS,
    color: "#1a1a1a",
    fontSize: 20,
    fontWeight: "700",
  },
  line: {
    position: "absolute",
    bottom: 11,
    left: 3,
    right: 3,
    height: 6,
    borderRadius: 2,
    backgroundColor: "#FFC2C6",
  },
  search: {
    paddingRight: 12,
  },
  searchIcon: { width: 24, height: 24, backgroundColor: "#FFC2C6" },
  banner: {
    marginHorizontal: 12,
    alignSelf: "stretch",
    height: 80,
    marginTop: 8,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1b2739",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  gameTabs: {
    height: 55,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  gameTab: {
    width: 112,
    height: 38,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gameTabSelected: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  gameLogo: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  gameLogoText: {
    fontFamily: DOUYIN_SANS,
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  gameLabel: { fontFamily: DOUYIN_SANS, color: "#999", fontSize: 13 },
  gameLabelSelected: { fontFamily: DOUYIN_SANS, color: "#333" },
  section: {
    height: 50,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
  },
  sectionTitle: {
    fontFamily: DOUYIN_SANS,
    color: "#111216",
    fontSize: 17,
    fontWeight: "700",
  },
  filter: { width: 24, height: 24 },
  club: { minHeight: 104, marginHorizontal: 16, flexDirection: "row", gap: 12 },
  cover: {
    width: 84,
    height: 84,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  coverText: {
    fontFamily: DOUYIN_SANS,
    color: "rgba(255,255,255,.78)",
    fontSize: 34,
    fontWeight: "800",
  },
  body: { flex: 1, paddingTop: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 22,
  },
  self: {
    fontFamily: DOUYIN_SANS,
    color: "#fff",
    backgroundColor: "#ff1f4c",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 10,
    fontWeight: "700",
  },
  name: {
    fontFamily: DOUYIN_SANS,
    color: "#0a0a0a",
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1,
  },
  online: { fontFamily: DOUYIN_SANS, color: "#2fc273", fontSize: 12 },
  desc: {
    fontFamily: DOUYIN_SANS,
    color: "#666",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  meta: {
    fontFamily: DOUYIN_SANS,
    color: "#999",
    fontSize: 11,
  },
  metaIcon: { width: 12, height: 12 },
  empty: {
    fontFamily: DOUYIN_SANS,
    color: "#999",
    fontSize: 14,
    textAlign: "center",
    paddingTop: 40,
  },
  emptyCourt: {
    minHeight: 500,
    alignItems: "center",
    justifyContent: "center",
  },
  retryWrap: { alignItems: "center", paddingTop: 60 },
  retry: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#ff1f4c",
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  retryText: { fontFamily: DOUYIN_SANS, color: "#ff1f4c", fontSize: 13 },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 76,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e7e7e7",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    paddingTop: 7,
  },
  bottomItem: { width: 52, alignItems: "center", gap: 1 },
  bottomIcon: { width: 30, height: 30 },
  bottomLabel: { fontFamily: DOUYIN_SANS, color: "#c8c8cc", fontSize: 11 },
  bottomActive: { fontFamily: DOUYIN_SANS, color: "#333" },
  match: {
    width: 56,
    height: 56,
    marginTop: -15,
    alignItems: "center",
    justifyContent: "center",
  },
  publish: { width: 56, height: 56 },
});
