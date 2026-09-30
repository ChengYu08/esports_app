import { DOUYIN_SANS } from "@/shared/theme/typography";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { demoClubs } from "../api/home.mock";
import type { GameKey } from "../api/home.types";
import { useHomeGames } from "../hooks/use-home-data";

const clubLogo = require("../../../../assets/home/club-detail/member-1.jpg");
const tabLeftCorner = require("../../../../assets/home/h_tab_left.svg");
const tabRightCorner = require("../../../../assets/home/h_tab_right.svg");
const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
const searchIcon = require("../../../../assets/home/club-detail/icon-search.svg");
const maleIcon = require("../../../../assets/home/club-detail/male.svg");
const femaleIcon = require("../../../../assets/home/club-detail/female.svg");
const memberIcon = require("../../../../assets/home/h_user.svg");
const filterArrowIcon = require("../../../../assets/home/club-detail/arrow-fill-down.svg");
const idleIcon = require("../../../../assets/home/club-detail/status-idle.svg");
const playingIcon = require("../../../../assets/home/club-detail/status-playing.svg");
const diamondIcon = require("../../../../assets/home/club-detail/icon-diamond.svg");
const playIcon = require("../../../../assets/home/club-detail/icon-play.svg");
const memberImages = [
  require("../../../../assets/home/club-detail/member-2.jpg"),
  require("../../../../assets/home/club-detail/member-3.jpg"),
  require("../../../../assets/home/club-detail/member-4.jpg"),
  require("../../../../assets/home/club-detail/member-5.jpg"),
];

export default function ClubDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [game, setGame] = useState<GameKey>("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const gamesQuery = useHomeGames();
  const games = gamesQuery.data?.length
    ? gamesQuery.data
    : [
        { id: 1, name: "三角洲端游", category: 1 },
        { id: 2, name: "三角洲手游", category: 2 },
      ];
  const selectedGame = game || String(games[0].id);
  const club = useMemo(
    () =>
      Object.values(demoClubs)
        .flat()
        .find((item) => item.id === id) ?? demoClubs.pc[0],
    [id],
  );
  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={["#3b6f75", "#2a6681"]}
        end={{ x: 1, y: 0.8 }}
        start={{ x: 0, y: 0 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={[styles.nav, { height: 44 }]}>
          <Pressable
            accessibilityLabel="返回"
            hitSlop={10}
            onPress={() => router.back()}
          >
            <Image source={backIcon} style={styles.navIconImage} />
          </Pressable>
          <View style={styles.navTitleSpacer} />
          <View style={styles.navActions}>
            <Pressable
              accessibilityLabel="搜索"
              hitSlop={10}
              onPress={() => undefined}
            >
              <Image source={searchIcon} style={styles.navIconImage} />
            </Pressable>
          </View>
        </View>
        <View style={styles.clubInfo}>
          <Image source={clubLogo} style={styles.clubLogo} contentFit="cover" />
          <View style={styles.clubCopy}>
            <View style={styles.titleLine}>
              <Text style={styles.selfTag}>自营</Text>
              <Text numberOfLines={1} style={styles.clubName}>
                {club.name}
              </Text>
            </View>
            <View style={styles.clubMeta}>
              <Image source={memberIcon} style={styles.clubMetaIcon} />
              <Text style={styles.metaText}>{club.memberCount}</Text>
            </View>
            <Text numberOfLines={1} style={styles.clubDescription}>
              这是一段俱乐部简介，这是一段俱乐部简介，这是一...
            </Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.gameTabs}
          contentContainerStyle={styles.gameTabsContent}
        >
          {games.map((item, index) => (
            <GameTab
              key={item.id}
              label={item.name}
              iconUrl={item.iconUrl}
              first={index === 0}
              active={selectedGame === String(item.id)}
              onPress={() => setGame(String(item.id))}
            />
          ))}
        </ScrollView>
      </LinearGradient>
      <View style={styles.filterRow}>
        {["模式", "等级", "性别", "筛选"].map((label) => (
          <Pressable
            key={label}
            accessibilityLabel={`筛选${label}`}
            style={[
              styles.filterItem,
              activeFilter === label && styles.filterItemActive,
            ]}
            onPress={() =>
              setActiveFilter((value) => (value === label ? null : label))
            }
          >
            <Text style={styles.filterText}>{label}</Text>
            <Image source={filterArrowIcon} style={styles.filterArrowIcon} />
          </Pressable>
        ))}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 92 + insets.bottom }}
        style={styles.listScroll}
      >
        <View style={styles.list}>
          {memberImages.map((image, index) => (
            <MemberCard
              key={index}
              image={image}
              gender={index === 1 ? "male" : "female"}
              status={index === 1 ? "游戏中" : "空闲中"}
              statusColor={index === 1 ? "#4a7fff" : "#16c978"}
            />
          ))}
        </View>
      </ScrollView>
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Pressable
          style={styles.priceButton}
          onPress={() => Alert.alert("价目表", "价目表功能即将开放")}
        >
          <Text style={styles.priceText}>价目表</Text>
        </Pressable>
        <Pressable
          style={styles.matchButton}
          onPress={() => Alert.alert("一键匹配", "正在为你匹配合适的陪玩")}
        >
          <LinearGradient
            colors={["#ff1f2e", "#ff1f69"]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.matchButtonGradient}
          >
            <Text style={styles.matchText}>一键匹配</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function GameTab({
  label,
  iconUrl,
  first,
  active,
  onPress,
}: {
  label: string;
  iconUrl?: string;
  first: boolean;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.gameTab,
        first && styles.gameTabFirst,
        active && styles.gameTabActive,
        active && !first && styles.gameTabActiveAfterFirst,
      ]}
    >
      <View style={styles.gameLogo}>
        {iconUrl ? (
          <Image source={{ uri: iconUrl }} style={styles.gameIcon} />
        ) : (
          <Text style={styles.gameTriangle}>△</Text>
        )}
      </View>
      <Text style={[styles.gameLabel, active && styles.gameLabelActive]}>
        {label}
      </Text>
      {active && (
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
  );
}
function MemberCard({
  image,
  gender,
  status,
  statusColor,
}: {
  image: number;
  gender: "male" | "female";
  status: string;
  statusColor: string;
}) {
  const isPlaying = status === "游戏中";
  return (
    <Pressable style={styles.memberCard} onPress={() => undefined}>
      <View style={styles.avatarWrap}>
        <Image source={image} contentFit="cover" style={styles.avatar} />
        <View style={styles.voice}>
          <Image source={playIcon} style={styles.playIcon} />
          <Text style={styles.voiceText}>12&apos;&apos;</Text>
        </View>
      </View>
      <View style={styles.memberBody}>
        <View style={styles.memberTitle}>
          <Text style={styles.memberName}>小非-认证野王</Text>
          <View style={styles.genderGroup}>
            <Image
              source={gender === "male" ? maleIcon : femaleIcon}
              style={styles.genderIcon}
            />
            <Text
              style={[styles.gender, gender === "male" && styles.maleGender]}
            >
              24
            </Text>
          </View>
          <View
            style={[styles.status, { backgroundColor: `${statusColor}20` }]}
          >
            <Image
              source={isPlaying ? playingIcon : idleIcon}
              style={styles.statusIcon}
            />
            <Text
              numberOfLines={1}
              style={[styles.statusText, { color: statusColor }]}
            >
              {status}
            </Text>
          </View>
        </View>
        <Text numberOfLines={2} style={styles.memberDesc}>
          清一色暖男声线，情绪价值拉满，你的日常陪伴，情绪价值拉满
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>300</Text>
          <Image source={diamondIcon} style={styles.diamondIcon} />
          <Text style={styles.orders}>2010订单</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gameTabsContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },
  gameIcon: { width: 16, height: 16, borderRadius: 3 },
  gameIndicator: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "#fff",
  },
  tabCorner: { position: "absolute", width: 17, height: 17, bottom: -1 },
  tabCornerLeft: { left: -15 },
  tabCornerRight: { right: -15 },
  navIconImage: { width: 24, height: 24 },
  playIcon: { width: 16, height: 16 },
  genderIcon: { width: 12, height: 12 },
  genderGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  maleGender: { color: "#0095ee" },
  statusIcon: { width: 12, height: 12 },
  diamondIcon: { width: 20, height: 20, marginLeft: 5 },
  screen: { flex: 1, backgroundColor: "#fff" },
  header: { width: "100%" },
  nav: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { color: "#fff", fontSize: 44, fontWeight: "200", lineHeight: 38 },
  navTitleSpacer: { flex: 1 },
  navActions: { width: 32, alignItems: "flex-end" },
  navIcon: { color: "#fff", fontSize: 29, lineHeight: 26 },
  clubInfo: {
    minHeight: 104,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clubLogo: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: "#162a36",
  },
  clubCopy: { flex: 1, minWidth: 0, gap: 6 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  selfTag: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#ff3158",
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    fontWeight: "600",
  },
  clubName: {
    flexShrink: 1,
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  clubMeta: { flexDirection: "row", alignItems: "center", gap: 2 },
  clubMetaIcon: { width: 14, height: 14, opacity: 0.65 },
  metaText: {
    color: "rgba(255,255,255,.6)",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  clubDescription: {
    color: "rgba(255,255,255,.6)",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  gameTabs: { height: 40, flexDirection: "row" },
  gameTab: {
    height: 40,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderTopRightRadius: 12,
  },
  gameTabFirst: { borderTopLeftRadius: 0 },
  gameTabActive: { backgroundColor: "#fff" },
  gameTabActiveAfterFirst: { borderTopLeftRadius: 12 },
  gameLogo: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: "#082d35",
    alignItems: "center",
    justifyContent: "center",
  },
  gameTriangle: { color: "#19e5a5", fontSize: 15, lineHeight: 16 },
  gameLabel: {
    flexShrink: 0,
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
  },
  gameLabelActive: { color: "#111", fontWeight: "600" },
  filterRow: {
    height: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  filterItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 34,
    borderRadius: 4,
  },
  filterItemActive: { backgroundColor: "#f5f5f5" },
  filterText: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 12 },
  filterArrowIcon: { width: 12, height: 12 },
  listScroll: { flex: 1 },
  list: { paddingHorizontal: 0 },
  memberCard: {
    minHeight: 124,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 12,
  },
  avatarWrap: { width: 100, height: 100, position: "relative" },
  avatar: { width: 100, height: 100, borderRadius: 8 },
  voice: {
    position: "absolute",
    left: 6,
    bottom: 6,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: "#ff3158",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  play: {
    color: "#ff3158",
    backgroundColor: "#fff",
    width: 16,
    height: 16,
    borderRadius: 8,
    textAlign: "center",
    lineHeight: 16,
    fontSize: 8,
  },
  voiceText: { color: "#fff", fontFamily: DOUYIN_SANS, fontSize: 12 },
  memberBody: { flex: 1, minWidth: 0 },
  memberTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  memberName: {
    flexShrink: 1,
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    fontWeight: "600",
  },
  gender: {
    flexShrink: 0,
    color: "#ff4770",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
  status: {
    marginLeft: "auto",
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 14,
    maxHeight: 14,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  statusText: { fontFamily: DOUYIN_SANS, fontSize: 10 },
  memberDesc: {
    marginTop: 5,
    color: "#777",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 19,
  },
  priceRow: { marginTop: 8, flexDirection: "row", alignItems: "center" },
  price: {
    color: "#ff3158",
    fontFamily: DOUYIN_SANS,
    fontSize: 22,
    fontWeight: "600",
  },
  diamond: { marginLeft: 5, color: "#ff3158", fontSize: 15 },
  orders: {
    marginLeft: "auto",
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 76,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 12,
  },
  priceButton: {
    width: 104,
    height: 42,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  priceText: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
  matchButton: {
    flex: 1,
    height: 42,
    borderRadius: 9,
    overflow: "hidden",
  },
  matchButtonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  matchText: {
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
});
