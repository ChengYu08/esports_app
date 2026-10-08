import type {
  Banner,
  Game,
  GameKey,
  HomeTab,
} from "@/features/home/api/home.types";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const banner = require("../../../../assets/home/h_banner.png");
const searchIcon = require("../../../../assets/home/h_search.svg");
const filterIcon = require("../../../../assets/home/h_filter_list.svg");
const tabLeftCorner = require("../../../../assets/home/h_tab_left.svg");
const tabRightCorner = require("../../../../assets/home/h_tab_right.svg");
type HomeHeaderProps = {
  tab: HomeTab;
  game: GameKey;
  games: Game[];
  bannerIndex: number;
  banners: Banner[];
  onTabChange: (tab: HomeTab) => void;
  onGameChange: (game: GameKey) => void;
};

export function HomeHeader({
  tab,
  game,
  games,
  bannerIndex,
  banners,
  onTabChange,
  onGameChange,
}: HomeHeaderProps) {
  return (
    <>
      <View style={styles.topBar}>
        <View style={styles.topTabs}>
          <Tab
            label="首页"
            selected={tab === "home"}
            onPress={() => onTabChange("home")}
          />
          {/* <Tab
            label="小法庭"
            selected={tab === "court"}
            onPress={() => onTabChange("court")}
          /> */}
        </View>
        <Pressable
          accessibilityLabel="搜索"
          style={styles.search}
          onPress={() =>
            router.push({ pathname: "/search", params: { type: "club" } })
          }
        >
          <Image source={searchIcon} style={styles.searchIcon} />
        </Pressable>
      </View>
      <View style={styles.banner}>
        <Image
          source={
            banners[bannerIndex]?.imageUrl
              ? { uri: banners[bannerIndex].imageUrl }
              : banner
          }
          style={styles.bannerImage}
          contentFit="cover"
        />
      </View>
      {tab === "home" && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gameTabsContent}
            style={styles.gameTabs}
          >
            {games.map((item) => (
              <Pressable
                key={item.id}
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
                    <Image
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
            {/* <Image source={filterIcon} style={styles.filter} /> */}
          </View>
        </>
      )}
    </>
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
    <Pressable onPress={onPress} style={styles.tab}>
      {selected && <View style={styles.line} />}
      <Text style={[styles.tabText, selected && styles.tabSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  search: { paddingRight: 12 },
  searchIcon: { width: 48, height: 48 },
  banner: {
    marginHorizontal: 12,
    alignSelf: "stretch",
    height: 80,
    marginTop: 8,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1b2739",
  },
  bannerImage: { width: "100%", height: "100%" },
  gameTabs: {
    height: 55,
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
    fontFamily: DOUYIN_SANS,
    color: "#999",
    fontSize: 13,
    flexShrink: 0,
  },
  gameLabelSelected: { fontFamily: DOUYIN_SANS, color: "#333" },
  gameIndicator: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: "#fff",
  },
  tabCorner: { position: "absolute", width: 17, height: 17, bottom: -1 },
  tabCornerLeft: { left: -17 },
  tabCornerRight: { right: -17 },
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
