import { Search24Regular } from "@fluentui/react-native-icons";
import type {
  HomeBannerSlot,
  Game,
  GameCategory,
  GameKey,
  HomeTab,
} from "@/features/home/api/home.types";
import { DOUYIN_SANS, SYSTEM_FONT } from "@/shared/theme/typography";
import { GameCategoryTabs } from "./GameCategoryTabs";
import { HomeBannerSections } from "./HomeBannerSections";
import { COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { CachedImage } from "@/shared/ui/CachedImage";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const tabLeftCorner = require("../../../../assets/home/h_tab_left.svg");
const tabRightCorner = require("../../../../assets/home/h_tab_right.svg");
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
  onTabChange: (tab: HomeTab) => void;
  onGameChange: (game: GameKey) => void;
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
  onTabChange,
  onGameChange,
}: HomeHeaderProps) {
  return (
    <>
      {tab === "home" && (
        <>
          <HomeBannerSections slots={bannerSlots} />
          <GameCategoryTabs categories={categories} selectedId={category} onChange={onCategoryChange} />
          {filterError && (
            <Pressable accessibilityRole="button" onPress={onRetryFilters} style={styles.filterRetry}>
              <Text style={styles.filterRetryText}>筛选项加载失败，点击重试</Text>
            </Pressable>
          )}
          <ScrollView
            key={category}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gameTabsContent}
            style={styles.gameTabs}
          >
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: game === "" }}
              onPress={() => onGameChange("")}
              style={[styles.gameTab, game === "" && styles.gameTabSelected]}
            >
              <Text style={[styles.gameLabel, game === "" && styles.gameLabelSelected]}>全部</Text>
              {game === "" && (
                <>
                  <View style={styles.gameIndicator} />
                  <Image source={tabLeftCorner} style={[styles.tabCorner, styles.tabCornerLeft]} pointerEvents="none" />
                  <Image source={tabRightCorner} style={[styles.tabCorner, styles.tabCornerRight]} pointerEvents="none" />
                </>
              )}
            </Pressable>
            {games.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: game === String(item.id) }}
                onPress={() => onGameChange(String(item.id))}
                style={[
                  styles.gameTab,
                  game === String(item.id) && styles.gameTabSelected,
                ]}
              >
                <View
                  style={[
                    styles.gameLogo,
                    {
                      backgroundColor:
                        item.category === 1 ? "#3ec8a5" : "#ecb34f",
                    },
                  ]}
                >
                  {item.iconUrl ? (
                    <CachedImage
                      source={{ uri: item.iconUrl }}
                      style={styles.gameIcon}
                    />
                  ) : (
                    <Text style={styles.gameLogoText}>△</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.gameLabel,
                    game === String(item.id) && styles.gameLabelSelected,
                  ]}
                >
                  {item.name}
                </Text>
                {game === String(item.id) && (
                  <>
                    <View style={styles.gameIndicator} />
                    <Image
                      source={tabLeftCorner}
                      style={[styles.tabCorner, styles.tabCornerLeft]}
                      pointerEvents="none"
                    />
                    <Image
                      source={tabRightCorner}
                      style={[styles.tabCorner, styles.tabCornerRight]}
                      pointerEvents="none"
                    />
                  </>
                )}
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>热门俱乐部</Text>
          </View>
        </>
      )}
    </>
  );
}

export function HomeTopBar({ tab, onTabChange }: Pick<HomeHeaderProps, "tab" | "onTabChange">) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topTabs}>
        <Tab label="首页" court={tab === "court"} selected={tab === "home"} onPress={() => onTabChange("home")} />
        <Tab label="小法庭" court={tab === "court"} selected={tab === "court"} onPress={() => onTabChange("court")} />
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityLabel="搜索" style={styles.search} onPress={() => router.push({ pathname: "/search", params: { type: "club" } })}>
          <View style={styles.searchIcon}>
            <Search24Regular color="#1A1A1A" width={20} height={20} />
          </View>
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
    <Pressable onPress={onPress} style={styles.tab}>
      {selected && <View style={styles.line} />}
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
  courtTabText: { fontFamily: COURT_FONT_FAMILY, color: "#CACACC", fontWeight: "600", lineHeight: 26 },
  courtTabSelected: { color: "#0D0D0F", lineHeight: 28 },
  line: {
    position: "absolute",
    bottom: 11,
    left: 3,
    right: 3,
    height: 6,
    borderRadius: 2,
    backgroundColor: "#FFC2C6",
  },
  actions: { alignItems: "center", flexDirection: "row", gap: 10, height: "100%", paddingRight: 12 },
  search: { alignItems: "center", height: 44, justifyContent: "center", width: 40 },
  searchIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  gameTabs: {
    height: 38,
  },
  gameTabsContent: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  gameTab: {
    flexShrink: 0,
    height: 38,
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
  gameIcon: { width: 16, height: 16, borderRadius: 4 },
  gameLabel: {
    fontFamily: SYSTEM_FONT,
    color: "#999",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    flexShrink: 0,
  },
  gameLabelSelected: { color: "#0A0A0A" },
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
});
