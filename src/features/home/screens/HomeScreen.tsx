import { HomeBackground } from "@/features/home/components/HomeBackground";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import {
  Club,
  GameKey,
  fetchBanners,
  fetchClubPage,
} from "@/features/home/api/home.api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Image } from "expo-image";
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

const banner = require("../../../../assets/home/h_banner.png");
const icons = {
  search: require("../../../../assets/home/h_search.svg"),
  filter: require("../../../../assets/home/h_filter_list.svg"),
  user: require("../../../../assets/home/h_user.svg"),
  id: require("../../../../assets/home/h_id.svg"),
  home: require("../../../../assets/home/h_home-selected.svg"),
  order: require("../../../../assets/home/h_order-selected.svg"),
  message: require("../../../../assets/home/h_message-selected.svg"),
  mine: require("../../../../assets/home/h_mine.svg"),
  publish: require("../../../../assets/home/h_publish.svg"),
};
type TopTab = "home" | "court";
const games = [
  { key: "pc" as GameKey, label: "三角洲端游", color: "#3ec8a5" },
  { key: "mobile" as GameKey, label: "三角洲手游", color: "#ecb34f" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [topTab, setTopTab] = useState<TopTab>("home");
  const [game, setGame] = useState<GameKey>("pc");
  const [bannerIndex, setBannerIndex] = useState(0);
  const banners = useQuery({
    queryKey: ["home-banners", topTab],
    queryFn: () => fetchBanners(topTab),
  });
  const clubs = useInfiniteQuery({
    queryKey: ["home-clubs", topTab, game],
    enabled: topTab === "home",
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchClubPage(game, pageParam),
    getNextPageParam: (last) => (last.hasMore ? last.nextPage : undefined),
  });
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
  const selectTopTab = (tab: TopTab) => {
    setBannerIndex(0);
    setTopTab(tab);
  };
  const header = (
    <>
      <View style={s.topBar}>
        <View style={s.topTabs}>
          <Tab
            label="首页"
            selected={topTab === "home"}
            onPress={() => selectTopTab("home")}
          />
          <Tab
            label="小法庭"
            selected={topTab === "court"}
            onPress={() => selectTopTab("court")}
          />
        </View>
        <Pressable
          accessibilityLabel="搜索"
          style={s.search}
          onPress={() => undefined}
        >
          <Image source={icons.search} style={[s.searchIcon]} />
        </Pressable>
      </View>
      <View style={s.banner}>
        <Image
          source={
            bannerItems[bannerIndex]?.imageUrl
              ? { uri: bannerItems[bannerIndex].imageUrl }
              : banner
          }
          style={s.bannerImage}
          contentFit="cover"
        />
      </View>
      {topTab === "home" && (
        <>
          <View style={s.gameTabs}>
            {games.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => setGame(item.key)}
                style={[
                  s.gameTab,
                  game === item.key && s.gameTabSelected,
                  game === item.key && { position: "relative" },
                ]}
              >
                <View style={[s.gameLogo, { backgroundColor: item.color }]}>
                  <Text style={s.gameLogoText}>△</Text>
                </View>
                <Text
                  style={[
                    s.gameLabel,
                    game === item.key && s.gameLabelSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {game === item.key && (
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 4,
                      backgroundColor: "#fff",
                    }}
                  />
                )}
              </Pressable>
            ))}
          </View>
          <View style={s.section}>
            <Text style={s.sectionTitle}>热门俱乐部</Text>
            <Image source={icons.filter} style={s.filter} />
          </View>
        </>
      )}
    </>
  );
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
      <Bottom insetsBottom={insets.bottom} />
    </View>
  );
}
function Tab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={s.tab}>
      {selected && <View style={s.line} />}
      <Text style={[s.tabText, selected && s.tabSelected]}>{label}</Text>
    </Pressable>
  );
}
function ClubCard({ club }: { club: Club }) {
  const colors = ["#24354b", "#4a2637", "#2e4650", "#493e2e"];
  const hue = colors[Number(club.id.match(/\d+$/)?.[0] ?? 0) % 4];
  return (
    <Pressable style={s.club} onPress={() => undefined}>
      <View style={[s.cover, { backgroundColor: hue }]}>
        <Text style={s.coverText}>{club.name.slice(0, 1)}</Text>
      </View>
      <View style={s.body}>
        <View style={s.titleRow}>
          {club.isSelfOperated && <Text style={s.self}>自营</Text>}
          <Text numberOfLines={1} style={s.name}>
            {club.name}
          </Text>
          <Text style={s.online}>• {club.onlineCount}人</Text>
        </View>
        <Text numberOfLines={2} style={s.desc}>
          {club.description}
        </Text>
        <View style={s.metaRow}>
          <Text style={s.meta}>
            <Image source={icons.user} style={s.metaIcon} /> {club.memberCount}
            人
          </Text>
          <Text style={s.meta}>
            <Image source={icons.id} style={s.metaIcon} /> {club.clubCode}
          </Text>
        </View>
      </View>
    </Pressable>
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
function Bottom({ insetsBottom }: { insetsBottom: number }) {
  const items = [
    { label: "首页", icon: icons.home, active: true },
    { label: "订单", icon: icons.order },
    { label: "消息", icon: icons.message },
    { label: "我的", icon: icons.mine },
  ];
  return (
    <View style={[s.bottom, { paddingBottom: Math.max(8, insetsBottom) }]}>
      {items.slice(0, 2).map((x, i) => (
        <Pressable
          key={x.label}
          style={s.bottomItem}
          onPress={() => (i ? router.push("/login") : undefined)}
        >
          <Image source={x.icon} style={s.bottomIcon} />
          <Text style={[s.bottomLabel, x.active && s.bottomActive]}>
            {x.label}
          </Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityLabel="快速匹配"
        style={s.match}
        onPress={() => router.push("/match")}
      >
        <Image source={icons.publish} style={s.publish} />
      </Pressable>
      {items.slice(2).map((x) => (
        <Pressable
          key={x.label}
          style={s.bottomItem}
          onPress={() => router.push("/login")}
        >
          <Image source={x.icon} style={s.bottomIcon} />
          <Text style={s.bottomLabel}>{x.label}</Text>
        </Pressable>
      ))}
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
