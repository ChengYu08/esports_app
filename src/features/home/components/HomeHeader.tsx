import { COURT_FONT_FAMILY } from "@/features/court/court.theme";
import type {
  HomeBannerSlot,
  Game,
  GameCategory,
  GameKey,
  HomeTab,
} from "@/features/home/api/home.types";
import { SYSTEM_FONT } from "@/shared/theme/typography";
import { GameCategoryTabs } from "./GameCategoryTabs";
import { HomeBannerSections } from "./HomeBannerSections";
import { CachedImage } from "@/shared/ui/CachedImage";
import { Image } from "expo-image";
import { router } from "expo-router";
import { memo, useCallback, useMemo, type ReactNode } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

const allGamesIcon = require("../../../../assets/svgs/god-all-games.svg");
const searchIcon = require("../../../../assets/svgs/h_search.svg");
const tabLeftCorner = require("../../../../assets/svgs/h_tab_left.svg");
const tabRightCorner = require("../../../../assets/svgs/h_tab_right.svg");
type HomeHeaderProps = {
  tab: HomeTab;
  game: GameKey;
  games: Game[];
  categories: GameCategory[];
  category: string;
  onCategoryChange: (category: string) => void;
  filterError?: boolean;
  onRetryFilters: () => void;
  bannerSlots: HomeBannerSlot[];
  highlights?: ReactNode;
  onTabChange: (tab: HomeTab) => void;
  onGameChange: (game: GameKey) => void;
  /** 外层列表滚动期间暂停轮播自动跳页。 */
  carouselPaused?: boolean;
};

export function HomeHeader({
  tab,
  game,
  games,
  categories,
  category,
  onCategoryChange,
  filterError,
  onRetryFilters,
  bannerSlots,
  highlights,
  onTabChange,
  onGameChange,
  carouselPaused = false,
}: HomeHeaderProps) {
  /** "全部" 与游戏项结构对齐，交给同一个虚拟化行渲染 */
  const gameTabItems = useMemo<HomeGameTabItem[]>(
    () => [
      { id: "", label: "全部", iconUrl: null, category: 0 },
      ...games.map((item) => ({
        id: String(item.id),
        label: item.name,
        iconUrl: item.iconUrl ?? null,
        category: item.category ?? 0,
      })),
    ],
    [games],
  );
  return (
    <>
      {tab === "home" && (
        <>
          {/* 二、三楼预留位改为真实热门内容，顶部活动轮播继续读取广告配置。 */}
          <HomeBannerSections slots={highlights ? bannerSlots.filter((slot) => slot.code === "APP_HOME_FLOOR1") : bannerSlots} carouselPaused={carouselPaused} />
          {highlights}
          <GameCategoryTabs categories={categories} selectedId={category} onChange={onCategoryChange} />
          {filterError && (
            <Pressable accessibilityRole="button" onPress={onRetryFilters} style={styles.filterRetry}>
              <Text style={styles.filterRetryText}>筛选项加载失败，点击重试</Text>
            </Pressable>
          )}
          {/* key 挂分类：切分类时整行重建，横向滚动位置回到起点 */}
          <HomeGameTabBar key={category} items={gameTabItems} activeKey={game} onSelect={onGameChange} />
        </>
      )}
    </>
  );
}

type HomeGameTabItem = {
  id: string;
  label: string;
  iconUrl: string | null;
  category: number;
};

const homeGameTabKey = (item: HomeGameTabItem) => item.id || "all";

/** 游戏行横向虚拟化：游戏数量增长后只渲染窗口内的 tab */
const HomeGameTabBar = memo(function HomeGameTabBar({
  items,
  activeKey,
  onSelect,
}: {
  items: HomeGameTabItem[];
  activeKey: GameKey;
  onSelect: (gameKey: GameKey) => void;
}) {
  const renderItem = useCallback(
    ({ item }: { item: HomeGameTabItem }) => (
      <HomeGameTab
        id={item.id}
        label={item.label}
        iconUrl={item.iconUrl}
        category={item.category}
        active={item.id === activeKey}
        onSelect={onSelect}
      />
    ),
    [activeKey, onSelect],
  );
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={homeGameTabKey}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      style={styles.gameTabs}
      contentContainerStyle={styles.gameTabsContent}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
});

const HomeGameTab = memo(function HomeGameTab({
  id,
  label,
  iconUrl,
  category,
  active,
  onSelect,
}: {
  id: string;
  label: string;
  iconUrl: string | null;
  category: number;
  active: boolean;
  onSelect: (gameKey: GameKey) => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => onSelect(id)}
      style={[styles.gameTab, active && styles.gameTabSelected]}
    >
      {id === "" ? (
        <Image source={allGamesIcon} style={styles.allGamesIcon} contentFit="contain" />
      ) : (
        <View
          style={[
            styles.gameLogo,
            { backgroundColor: category === 1 ? "#3ec8a5" : "#ecb34f" },
          ]}
        >
          {iconUrl ? (
            <CachedImage source={{ uri: iconUrl }} style={styles.gameIcon} />
          ) : (
            <Text style={styles.gameLogoText}>△</Text>
          )}
        </View>
      )}
      <Text style={[styles.gameLabel, active && styles.gameLabelSelected]}>{label}</Text>
      {active && (
        <>
          <View style={styles.gameIndicator} />
          <Image source={tabLeftCorner} style={[styles.tabCorner, styles.tabCornerLeft]} pointerEvents="none" />
          <Image source={tabRightCorner} style={[styles.tabCorner, styles.tabCornerRight]} pointerEvents="none" />
        </>
      )}
    </Pressable>
  );
});

export function HomeTopBar({ tab, onTabChange }: Pick<HomeHeaderProps, "tab" | "onTabChange">) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topTabs}>
        <Tab label="首页" court={tab === "court"} selected={tab === "home"} onPress={() => onTabChange("home")} />
        <Tab label="大神" court={tab === "court"} selected={tab === "god"} onPress={() => onTabChange("god")} />
        <Tab label="排行榜" court={tab === "court"} selected={tab === "ranking"} onPress={() => onTabChange("ranking")} />
        <Tab label="小法庭" court={tab === "court"} selected={tab === "court"} onPress={() => onTabChange("court")} />
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityLabel="搜索" style={styles.search} onPress={() => router.push({ pathname: "/search", params: { type: "club" } })}>
          <Image source={searchIcon} style={styles.searchIcon} />
        </Pressable>
      </View>
    </View>
  );
}

function Tab({
  label,
  selected,
  onPress,
  court = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  court?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.tab}
    >
      {selected && <View style={[styles.line, { width: label.length === 2 ? 34 : 51 }]} />}
      <Text style={[styles.tabText, selected && styles.tabSelected, court && styles.courtTabText, court && selected && styles.courtTabSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 44,
    paddingLeft: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTabs: { flexDirection: "row", gap: 20, height: "100%" },
  tab: { justifyContent: "center", minWidth: 42, position: "relative" },
  tabText: {
    fontFamily: SYSTEM_FONT,
    color: "#CACACC",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
  },
  tabSelected: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
  },
  courtTabText: { fontFamily: COURT_FONT_FAMILY, color: "#CACACC", fontWeight: "700", lineHeight: 26 },
  courtTabSelected: { color: "#0D0D0F", lineHeight: 28 },
  line: {
    position: "absolute",
    bottom: 11,
    alignSelf: "center",
    height: 6,
    borderRadius: 2,
    backgroundColor: "#FFC2CE",
  },
  actions: { alignItems: "center", flexDirection: "row", gap: 10, height: "100%", paddingRight: 12 },
  search: { alignItems: "center", height: 44, justifyContent: "center", width: 40 },
  searchIcon: { width: 18, height: 18 },
  gameTabs: {
    height: 42,
  },
  gameTabsContent: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  gameTab: {
    flexShrink: 0,
    height: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  gameTabSelected: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  allGamesIcon: { width: 20, height: 20 },
  gameLogo: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  gameLogoText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  gameIcon: { width: 16, height: 16, borderRadius: 4 },
  gameLabel: {
    fontFamily: SYSTEM_FONT,
    color: "#999",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
    flexShrink: 0,
  },
  gameLabelSelected: { color: "#0A0A0A", fontWeight: "500" },
  filterRetry: { alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 8 },
  filterRetryText: { fontFamily: SYSTEM_FONT, fontSize: 12, lineHeight: 18, color: "#979799" },
  gameIndicator: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: "#fff",
  },
  tabCorner: { position: "absolute", width: 17, height: 17, bottom: -1 },
  tabCornerLeft: { left: -16 },
  tabCornerRight: { right: -16 },
  section: {
    backgroundColor: "#fff",
    borderTopRightRadius: 12,
    height: 50,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
  },
  filter: { width: 24, height: 24 },
});
