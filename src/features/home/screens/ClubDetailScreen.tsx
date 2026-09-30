import { DOUYIN_SANS } from "@/shared/theme/typography";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CompanionFilters, GameKey } from "../api/home.types";
import { useClubCompanions, useClubDetail, useClubGameModes } from "../hooks/use-home-data";

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

type FilterKey = "gender" | "mode" | "status" | "price";
const filterDefinitions: { key: FilterKey; label: string }[] = [
  { key: "gender", label: "性别" },
  { key: "mode", label: "模式" },
  { key: "status", label: "状态" },
  { key: "price", label: "价格" },
];

export default function ClubDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [game, setGame] = useState<GameKey>("");
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [priceSort, setPriceSort] = useState<CompanionFilters["priceSort"]>("DEFAULT");
  const [selectedSex, setSelectedSex] = useState<CompanionFilters["sex"]>();
  const [selectedStatus, setSelectedStatus] = useState<CompanionFilters["gameStatus"]>();
  const [selectedMode, setSelectedMode] = useState<number>();
  const clubQuery = useClubDetail(id);
  const club = clubQuery.data;
  const games = club?.games ?? [];
  const selectedGame = game || String(games[0]?.id ?? "");
  const modesQuery = useClubGameModes(selectedGame);
  const selectedModeLabel = modesQuery.data?.find((mode) => mode.id === selectedMode)?.modeName;
  const companionFilters = useMemo<CompanionFilters | null>(() => (
    club && selectedGame ? { clubId: club.id, gameId: selectedGame, priceSort, sex: selectedSex, gameStatus: selectedStatus, gameModeId: selectedMode } : null
  ), [club, priceSort, selectedGame, selectedMode, selectedSex, selectedStatus]);
  const companionsQuery = useClubCompanions(companionFilters);
  const members = companionsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  if (clubQuery.isLoading) return <View style={styles.state}><Text style={styles.stateText}>加载中...</Text></View>;
  if (clubQuery.isError || !club) return <View style={styles.state}><Text style={styles.stateText}>俱乐部详情加载失败</Text><Pressable onPress={() => void clubQuery.refetch()}><Text style={styles.retryText}>重试</Text></Pressable></View>;
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
          <Image source={club.logoUrl ? { uri: club.logoUrl } : undefined} style={styles.clubLogo} contentFit="cover" />
          <View style={styles.clubCopy}>
            <View style={styles.titleLine}>
              <Text style={styles.selfTag}>自营</Text>
              <Text numberOfLines={1} style={styles.clubName}>
                {club.name}
              </Text>
              <View style={styles.clubMeta}>
                <Image source={memberIcon} style={styles.clubMetaIcon} />
                <Text style={styles.metaText}>{club.memberCount}</Text>
              </View>
            </View>

            <Text numberOfLines={1} style={styles.clubDescription}>
              {club.intro}
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
              onPress={() => { setGame(String(item.id)); setSelectedMode(undefined); }}
            />
          ))}
        </ScrollView>
      </LinearGradient>
      <View style={styles.filterRow}>
        {filterDefinitions.map(({ key, label }) => {
          const displayLabel = key === "gender"
            ? selectedSex === 1 ? "男" : selectedSex === 2 ? "女" : label
            : key === "mode" ? selectedModeLabel || label
            : key === "status" ? selectedStatus === 0 ? "空闲中" : selectedStatus === 1 ? "游戏中" : label
            : priceSort === "ASC" ? "从低到高" : priceSort === "DESC" ? "从高到低" : label;
          const hasSelection = displayLabel !== label;
          const filterDisplay = hasSelection ? `${label} ${displayLabel}` : label;
          return (
          <Pressable
            key={key}
            accessibilityLabel={`筛选${label}`}
            style={[
              styles.filterItem,
              openFilter === key && styles.filterItemActive,
            ]}
            onPress={() => setOpenFilter(key)}
          >
            <Text numberOfLines={1} style={[styles.filterText, hasSelection && styles.filterTextSelected]}>{filterDisplay}</Text>
            <Image source={filterArrowIcon} style={styles.filterArrowIcon} />
          </Pressable>
          );
        })}
      </View>
      <Modal transparent visible={openFilter !== null} animationType="slide" onRequestClose={() => setOpenFilter(null)}>
        <Pressable style={styles.filterBackdrop} onPress={() => setOpenFilter(null)}>
          <Pressable style={styles.filterSheet} onPress={() => undefined}>
            <View style={styles.filterSheetHeader}><Text style={styles.filterSheetTitle}>{filterDefinitions.find((item) => item.key === openFilter)?.label}</Text><Pressable onPress={() => setOpenFilter(null)}><Text style={styles.filterClose}>×</Text></Pressable></View>
            {openFilter === "gender" && <><FilterOption label="不限" selected={!selectedSex} onPress={() => { setSelectedSex(undefined); setOpenFilter(null); }} /><FilterOption label="男" selected={selectedSex === 1} onPress={() => { setSelectedSex(1); setOpenFilter(null); }} /><FilterOption label="女" selected={selectedSex === 2} onPress={() => { setSelectedSex(2); setOpenFilter(null); }} /></>}
            {openFilter === "mode" && <><FilterOption label="不限" selected={!selectedMode} onPress={() => { setSelectedMode(undefined); setOpenFilter(null); }} />{modesQuery.data?.map((mode) => <FilterOption key={mode.id} label={mode.modeName} selected={selectedMode === mode.id} onPress={() => { setSelectedMode(mode.id); setOpenFilter(null); }} />)}</>}
            {openFilter === "status" && <><FilterOption label="不限" selected={selectedStatus === undefined} onPress={() => { setSelectedStatus(undefined); setOpenFilter(null); }} /><FilterOption label="空闲中" selected={selectedStatus === 0} onPress={() => { setSelectedStatus(0); setOpenFilter(null); }} /><FilterOption label="游戏中" selected={selectedStatus === 1} onPress={() => { setSelectedStatus(1); setOpenFilter(null); }} /></>}
            {openFilter === "price" && <><FilterOption label="默认排序" selected={priceSort === "DEFAULT"} onPress={() => { setPriceSort("DEFAULT"); setOpenFilter(null); }} /><FilterOption label="从高到低" selected={priceSort === "DESC"} onPress={() => { setPriceSort("DESC"); setOpenFilter(null); }} /><FilterOption label="从低到高" selected={priceSort === "ASC"} onPress={() => { setPriceSort("ASC"); setOpenFilter(null); }} /></>}
          </Pressable>
        </Pressable>
      </Modal>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 92 + insets.bottom }}
        style={styles.listScroll}
      >
        <View style={styles.list}>
          {members.map((member) => (
            <MemberCard
              key={member.profileId}
              clubId={club.id}
              userId={member.userId}
              image={member.headImage}
              name={member.nickname}
              description={member.signature}
              gender={member.sex === 1 ? "male" : "female"}
              price={member.price}
              orderCount={member.orderCount}
              voiceDuration={member.voiceDurationSeconds}
              status={member.gameStatus === 1 ? "游戏中" : member.onlineStatus === 1 ? "空闲中" : undefined}
              statusColor={member.gameStatus === 1 ? "#1e5eff" : member.onlineStatus === 1 ? "#16c978" : undefined}
            />
          ))}
          {!companionsQuery.isLoading && members.length === 0 && <Text style={styles.stateText}>暂无陪玩</Text>}
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

function FilterOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={styles.filterOption}>
      <Text style={[styles.filterOptionText, selected && styles.filterOptionTextSelected]}>{label}</Text>
      {selected && <Text style={styles.filterCheck}>✓</Text>}
    </Pressable>
  );
}

function MemberCard({
  clubId,
  userId,
  image,
  name,
  description,
  gender,
  price,
  orderCount,
  voiceDuration,
  status,
  statusColor,
}: {
  clubId: string;
  userId: number;
  image?: string;
  name: string;
  description?: string;
  gender: "male" | "female";
  price: number;
  orderCount: number;
  voiceDuration?: number;
  status?: string;
  statusColor?: string;
}) {
  const isPlaying = status === "游戏中";
  return (
    <Pressable
      style={styles.memberCard}
      onPress={() => router.push({
        pathname: "/profile",
        params: { clubId, userId: String(userId) },
      })}
    >
      <View style={styles.avatarWrap}>
        <Image source={image ? { uri: image } : undefined} contentFit="cover" style={styles.avatar} />
        <View style={styles.voice}>
          <Image source={playIcon} style={styles.playIcon} />
          <Text style={styles.voiceText}>{voiceDuration ?? 0}&apos;&apos;</Text>
        </View>
      </View>
      <View style={styles.memberBody}>
        <View style={styles.memberTitle}>
          <Text numberOfLines={1} style={styles.memberName}>{name}</Text>
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
          {status && statusColor && (
            <View style={[styles.status, { backgroundColor: `${statusColor}20` }] }>
              <Image source={isPlaying ? playingIcon : idleIcon} style={styles.statusIcon} />
              <Text numberOfLines={1} style={[styles.statusText, { color: statusColor }]}>{status}</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={2} style={styles.memberDesc}>
          {description || "暂无个人简介"}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{price}</Text>
          <Image source={diamondIcon} style={styles.diamondIcon} />
          <Text style={styles.orders}>{orderCount}订单</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#fff" },
  stateText: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 14, textAlign: "center", padding: 24 },
  retryText: { color: "#ff3158", fontFamily: DOUYIN_SANS, fontSize: 14 },
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
  diamondIcon: { width: 15, height: 15, marginLeft: 4 },
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
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selfTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: "#ff3158",
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    fontWeight: "700",
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
    flexDirection: "row",
    alignItems: "center",
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
    minWidth: 0,
    paddingHorizontal: 4,
  },
  filterItemActive: { backgroundColor: "#f5f5f5" },
  filterText: { flexShrink: 1, color: "#666", fontFamily: DOUYIN_SANS, fontSize: 12 },
  filterTextSelected: { color: "#0A0A0A", fontWeight: "600" },
  filterArrowIcon: { width: 12, height: 12 },
  filterBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.35)" },
  filterSheet: { maxHeight: "65%", paddingBottom: 28, backgroundColor: "#fff", borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  filterSheetHeader: { height: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ebebeb" },
  filterSheetTitle: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600" },
  filterClose: { width: 32, color: "#666", fontSize: 26, lineHeight: 32, textAlign: "center" },
  filterOption: { height: 48, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterOptionText: { color: "#333", fontFamily: DOUYIN_SANS, fontSize: 14 },
  filterOptionTextSelected: { color: "#ff3158", fontWeight: "600" },
  filterCheck: { color: "#ff3158", fontSize: 17, fontWeight: "700" },
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
  avatar: { width: 106, height: 106, borderRadius: 8 },
  voice: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingLeft: 6,
    paddingTop: 4,
    paddingRight: 6,
    paddingBottom: 4,
    borderRadius: 12,
    backgroundColor: "#ff3158",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
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
  memberBody: { flex: 1, minWidth: 0, marginLeft: 8 },
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
    fontSize: 14,
    fontWeight: "500",
  },
  gender: {
    flexShrink: 0,
    color: "#ff4770",
    fontSize: 12,
    fontWeight: 500,
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
    marginTop: 4,
    color: "#777",
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 19,
  },
  priceRow: { marginTop: 17, flexDirection: "row", alignItems: "center" },
  price: {
    color: "#ff3158",
    fontFamily: DOUYIN_SANS,
    fontSize: 20,
    fontWeight: "700",
  },
  diamond: { marginLeft: 5, color: "#ff3158", fontSize: 15 },
  orders: {
    marginLeft: "auto",
    color: "#999",
    fontSize: 12,
    fontWeight: 400,
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
