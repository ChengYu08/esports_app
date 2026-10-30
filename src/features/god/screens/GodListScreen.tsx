import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchGodPage,
  GOD_EMPTY_FILTERS,
  type GodFilters,
  type GodListItem,
} from "@/features/god/api/god.api";
import { fetchGames } from "@/features/home/api/home.api";
import { VoicePlayButton } from "@/shared/audio/VoicePlayButton";
import { useVoicePlayer } from "@/shared/audio/use-voice-player";
import { EmptyState } from "@/shared/ui/AsyncStates";

const maleIcon = require("../../../../assets/home/club-detail/male.svg");
const femaleIcon = require("../../../../assets/mine/figma/mine-female.svg");
const diamondIcon = require("../../../../assets/home/club-detail/icon-diamond.svg");
const emptyAvatar = require("../../../../assets/mine/figma/mine-avatar.png");
const allGamesIcon = require("../../../../assets/mine/figma/god-all-games.svg");
const arrowDownIcon = require("../../../../assets/home/club-detail/arrow-fill-down.svg");
const arrowUpDownIcon = require("../../../../assets/home/club-detail/arrow-fill-up-down.svg");
const statusPlayingIcon = require("../../../../assets/home/club-detail/status-playing.svg");
const statusIdleIcon = require("../../../../assets/home/club-detail/status-idle.svg");

const PAGE_SIZE = 10;

type FilterKey = keyof GodFilters;

const FILTER_DEFS: {
  key: FilterKey;
  label: string;
  /** sort 为价格排序的双向箭头，其余为下拉箭头 */
  arrow: "down" | "sort";
  options: { value: string; label: string }[];
}[] = [
  {
    key: "gender",
    label: "性别",
    arrow: "down",
    options: [
      { value: "", label: "不限" },
      { value: "male", label: "男" },
      { value: "female", label: "女" },
    ],
  },
  {
    key: "status",
    label: "状态",
    arrow: "down",
    options: [
      { value: "", label: "不限" },
      { value: "online", label: "空闲中" },
      { value: "busy", label: "游戏中" },
    ],
  },
  {
    key: "price",
    label: "价格",
    arrow: "sort",
    options: [
      { value: "", label: "不限" },
      { value: "asc", label: "从低到高" },
      { value: "desc", label: "从高到低" },
    ],
  },
];

const ALL_GAME_KEY = "all";

/** 筛选行高度与其底部的弹层/蒙层起点 */
const FILTER_BAR_HEIGHT = 34;

function FilterMenu({
  options,
  value,
  onSelect,
  onClose,
}: {
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const progress = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <>
      <Animated.View style={[styles.menuOverlay, { opacity: progress }]}>
        <Pressable
          accessibilityLabel="关闭筛选"
          onPress={onClose}
          style={styles.menuOverlayPress}
        />
      </Animated.View>
      <Animated.View style={[styles.menuPanel, { transform: [{ translateY }] }]}>
        <View style={styles.menuOptions}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelect(option.value)}
                style={[styles.menuOption, selected && styles.menuOptionSelected]}
              >
                <Text style={[styles.menuOptionText, selected && styles.menuOptionTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </>
  );
}

export default function GodListScreen() {
  const insets = useSafeAreaInsets();
  const voicePlayer = useVoicePlayer();
  const [gameKey, setGameKey] = useState(ALL_GAME_KEY);
  const [filters, setFilters] = useState<GodFilters>(GOD_EMPTY_FILTERS);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);

  const openFilterMenu = (key: FilterKey) => {
    setOpenFilter((current) => (current === key ? null : key));
  };

  const closeFilterMenu = () => {
    setOpenFilter(null);
  };

  const activeFilterDef = FILTER_DEFS.find((def) => def.key === openFilter) ?? null;

  const games = useQuery({ queryKey: ["god-games"], queryFn: ({ signal }) => fetchGames(signal) });

  const gameId = useMemo(() => {
    if (gameKey === ALL_GAME_KEY) return null;
    const hit = games.data?.find((game) => String(game.id) === gameKey);
    return hit ? hit.id : null;
  }, [gameKey, games.data]);

  /** 卡内游戏标签的图标：接口未返回游戏图标，用游戏列表按名称匹配 */
  const gameIconByName = useMemo(() => {
    const map = new Map<string, string>();
    (games.data ?? []).forEach((game) => {
      if (game.iconUrl) map.set(game.name, game.iconUrl);
    });
    return map;
  }, [games.data]);

  const godList = useInfiniteQuery({
    queryKey: ["god-list", gameId, filters],
    queryFn: ({ pageParam, signal }) =>
      fetchGodPage({ gameId, filters, page: pageParam, pageSize: PAGE_SIZE, signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return fetched < lastPage.total ? allPages.length + 1 : undefined;
    },
  });

  const list = useMemo(
    () => godList.data?.pages.flatMap((page) => page.items) ?? [],
    [godList.data],
  );

  const renderCard = ({ item }: { item: GodListItem }) => (
    <GodCard
      item={item}
      gameIconUrl={gameIconByName.get(item.gameName)}
      voicePlayingUrl={voicePlayer.playingUrl}
      onToggleVoice={voicePlayer.toggle}
      onPress={() =>
        router.push({
          pathname: "/profile",
          params: {
            clubId: String(item.clubId),
            userId: String(item.userId),
            ...(item.gameName ? { gameId: gameKey === ALL_GAME_KEY ? "" : gameKey } : {}),
          },
        })
      }
    />
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.gameBar}
        contentContainerStyle={styles.gameBarContent}
      >
        <GamePill
          label="全部"
          iconUrl={null}
          selected={gameKey === ALL_GAME_KEY}
          onPress={() => setGameKey(ALL_GAME_KEY)}
        />
        {(games.data ?? []).map((game) => (
          <GamePill
            key={game.id}
            label={game.name}
            iconUrl={game.iconUrl}
            selected={gameKey === String(game.id)}
            onPress={() => setGameKey(String(game.id))}
          />
        ))}
      </ScrollView>
      <View style={styles.listSheet}>
        <View style={styles.filterBar}>
          {FILTER_DEFS.map((def) => {
            const active = Boolean(filters[def.key]);
            const selected = def.options.find((option) => option.value === filters[def.key]);
            const open = openFilter === def.key;
            return (
              <View key={def.key} style={styles.filterWrap}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => openFilterMenu(def.key)}
                  style={styles.filterChip}
                >
                  <Text
                    style={[
                      styles.filterText,
                      (active || open) && styles.filterTextActive,
                      open && styles.filterTextOpen,
                    ]}
                  >
                    {active ? `${def.label}·${selected?.label ?? ""}` : def.label}
                  </Text>
                  <Image
                    source={def.arrow === "sort" ? arrowUpDownIcon : arrowDownIcon}
                    style={[
                      styles.filterArrowIcon,
                      (active || open) && styles.filterArrowActive,
                      def.arrow === "down" && open && styles.filterArrowOpen,
                    ]}
                  />
                </Pressable>
              </View>
            );
          })}
        </View>
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.userId)}
          renderItem={renderCard}
          ItemSeparatorComponent={CardDivider}
          ListEmptyComponent={
            godList.isLoading ? null : (
              <EmptyState message="暂无大神，换个筛选条件试试" />
            )
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 + insets.bottom }}
          refreshControl={
            <RefreshControl
              refreshing={godList.isRefetching && !godList.isFetchingNextPage}
              onRefresh={() => void godList.refetch()}
              tintColor="#ff214b"
            />
          }
          onEndReached={() => {
            if (godList.hasNextPage && !godList.isFetchingNextPage) {
              void godList.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.2}
        />
        {activeFilterDef ? (
          <FilterMenu
            options={activeFilterDef.options}
            value={filters[activeFilterDef.key]}
            onSelect={(value) => {
              setFilters((current) => ({ ...current, [activeFilterDef.key]: value }));
              closeFilterMenu();
            }}
            onClose={closeFilterMenu}
          />
        ) : null}
      </View>
    </View>
  );
}

function CardDivider() {
  return <View style={styles.divider} />;
}

function GamePill({
  label,
  iconUrl,
  selected,
  onPress,
}: {
  label: string;
  iconUrl: string | null | undefined;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.gamePill, selected && styles.gamePillSelected]}
    >
      {iconUrl ? (
        <Image source={{ uri: iconUrl }} style={styles.gameIcon} contentFit="cover" />
      ) : (
        <Image source={allGamesIcon} style={styles.gameIcon} contentFit="cover" />
      )}
      <Text style={[styles.gamePillText, selected && styles.gamePillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** 卡片等级标签颜色：与设计稿色板一致 */
function levelTagColor(levelName: string) {
  if (levelName.includes("颜值")) return "#3DA5FF";
  if (levelName.includes("人气")) return "#13AEBD";
  if (levelName.includes("魔王")) return "#BB3EFA";
  if (levelName.includes("顶尖")) return "#FE4267";
  if (levelName.includes("明星")) return "#7D47FC";
  if (levelName.includes("金")) return "#D19643";
  if (levelName.includes("娱乐")) return "#477BFE";
  return "#C0C4CC";
}

function GodCard({
  item,
  gameIconUrl,
  voicePlayingUrl,
  onToggleVoice,
  onPress,
}: {
  item: GodListItem;
  gameIconUrl: string | undefined;
  voicePlayingUrl: string | null;
  onToggleVoice: (url: string) => void;
  onPress: () => void;
}) {
  const online = item.onlineStatus === 1;
  const busy = item.gameStatus === 1;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardLeft}>
        <Image
          source={item.avatar ? { uri: item.avatar } : emptyAvatar}
          style={styles.avatar}
          contentFit="cover"
        />
        {item.voiceUrl ? (
          <View style={styles.voicePill}>
            <VoicePlayButton
              url={item.voiceUrl}
              duration={item.voiceDurationSeconds}
              tone="light"
              playingUrl={voicePlayingUrl}
              onToggleVoice={onToggleVoice}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.cardRight}>
        <View style={styles.cardContent}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {item.nickname}
            </Text>
            {item.sex === 1 || item.sex === 2 ? (
              <Image
                source={item.sex === 1 ? maleIcon : femaleIcon}
                style={[styles.genderIcon, item.sex === 1 ? styles.genderMale : styles.genderFemale]}
              />
            ) : null}
            {item.age != null && (item.sex === 1 || item.sex === 2) ? (
              <Text
                style={[
                  styles.ageText,
                  item.sex === 1 ? styles.ageTextMale : styles.ageTextFemale,
                ]}
              >
                {item.age}
              </Text>
            ) : null}
            {online ? (
              <View style={[styles.statusTag, busy ? styles.statusBusyBg : styles.statusIdleBg]}>
                <Image
                  source={busy ? statusPlayingIcon : statusIdleIcon}
                  style={[
                    styles.statusTagIcon,
                    busy ? styles.statusIconBusy : styles.statusIconIdle,
                  ]}
                />
                <Text style={[styles.statusTagText, busy ? styles.statusBusyText : styles.statusIdleText]}>
                  {busy ? "游戏中" : "空闲中"}
                </Text>
              </View>
            ) : null}
          </View>
          {item.gameName ? (
            <View style={styles.gameTag}>
              {gameIconUrl ? (
                <Image source={{ uri: gameIconUrl }} style={styles.gameTagIcon} contentFit="cover" />
              ) : null}
              <Text style={styles.gameTagText}>{item.gameName}</Text>
            </View>
          ) : null}
          <View style={styles.introRow}>
            {item.levelName ? (
              <View style={[styles.levelTag, { backgroundColor: levelTagColor(item.levelName) }]}>
                <Text style={styles.levelTagText}>{item.levelName}</Text>
              </View>
            ) : null}
            <Text numberOfLines={1} style={styles.introText}>
              {item.signature || "保持一点神秘感..."}
            </Text>
          </View>
        </View>
        <View style={styles.priceRow}>
          <View style={styles.priceWrap}>
            <Text style={styles.price}>{item.price}</Text>
            <Image source={diamondIcon} style={styles.diamond} />
          </View>
          <View style={styles.salesWrap}>
            <Text style={styles.salesLabel}>销量</Text>
            <Text style={styles.salesValue}>{item.orderCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F6F7" },
  gameBar: {
    flexGrow: 0,
  },
  gameBarContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  gamePill: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  gamePillSelected: {
    backgroundColor: "#FFF5F7",
    borderWidth: 1,
    borderColor: "#FF99AD",
  },
  gamePillText: { color: "#0D0D0F", fontSize: 12, lineHeight: 18 },
  gamePillTextSelected: { color: "#FE1F4C", fontWeight: "500" },
  gameIcon: { width: 20, height: 20, borderRadius: 4 },
  listSheet: {
    flex: 1,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 6,
  },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
  },
  filterWrap: { flex: 1, position: "relative" },
  filterChip: {
    width: "100%",
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  filterText: { color: "#656566", fontSize: 12, lineHeight: 18 },
  filterTextActive: { color: "#FE1F4C" },
  filterTextOpen: { fontWeight: "500" },
  filterArrowIcon: { width: 12, height: 12, tintColor: "#656566" },
  filterArrowActive: { tintColor: "#FE1F4C" },
  filterArrowOpen: { transform: [{ rotate: "180deg" }] },
  menuOverlay: {
    position: "absolute",
    top: 6 + FILTER_BAR_HEIGHT,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  menuOverlayPress: { flex: 1 },
  menuPanel: {
    position: "absolute",
    top: 6 + FILTER_BAR_HEIGHT,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  menuOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  menuOption: {
    flexGrow: 1,
    flexBasis: "30%",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: "#F7F7F7",
    alignItems: "center",
    justifyContent: "center",
  },
  menuOptionSelected: { backgroundColor: "#FFF5F5" },
  menuOptionText: { color: "#0A0A0A", fontSize: 12, lineHeight: 18, textAlign: "center" },
  menuOptionTextSelected: { color: "#FE1F4C", fontWeight: "500" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E9E9EB",
    marginHorizontal: 16,
  },
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  cardPressed: { backgroundColor: "#F7F7F7" },
  cardLeft: { width: 100, height: 100 },
  avatar: { width: 100, height: 100, borderRadius: 8 },
  voicePill: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFF",
    borderRadius: 99,
    paddingTop: 3,
    paddingRight: 2,
    paddingBottom: 3,
    paddingLeft: 2,
  },
  cardRight: {
    flex: 1,
    justifyContent: "space-between",
  },
  cardContent: { gap: 4 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    flexShrink: 1,
  },
  genderIcon: { width: 12, height: 12 },
  genderMale: { tintColor: "#3DA5FF" },
  genderFemale: { tintColor: "#FF42A1" },
  ageText: { fontSize: 12, lineHeight: 18, fontWeight: "500" },
  ageTextMale: { color: "#3DA5FF" },
  ageTextFemale: { color: "#FF42A1" },
  statusTag: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 3,
    // 设计稿 L2 Tag：高 16（文字 14 + 上下 1）、左右 3
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  statusBusyBg: { backgroundColor: "#FFF4EB" },
  statusIdleBg: { backgroundColor: "#E6FAEF" },
  statusTagIcon: { width: 10, height: 10 },
  statusIconBusy: { tintColor: "#F5821D" },
  statusIconIdle: { tintColor: "#14A357" },
  statusTagText: { fontSize: 10, lineHeight: 14, fontWeight: "500" },
  statusBusyText: { color: "#F5821D" },
  statusIdleText: { color: "#14A357" },
  gameTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF4EB",
    borderRadius: 3,
    // 设计稿 tag/game：高 16（文字 14 + 上下 1）、右 4
    paddingRight: 4,
    paddingVertical: 1,
  },
  gameTagIcon: { width: 16, height: 16, borderRadius: 3 },
  gameTagText: { color: "#B25C15", fontSize: 10, lineHeight: 14, fontWeight: "500" },
  introRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  levelTag: {
    borderRadius: 2,
    paddingHorizontal: 2,
    // 文字 lineHeight 13 + 中文字形下沉，14 高会贴住底边；抬高到 16 并
    // 额外给 1 底边距，视觉重心略微上提
    height: 16,
    paddingBottom: 1,
    justifyContent: "center",
  },
  levelTagText: { color: "#FFF", fontSize: 10, lineHeight: 13, fontWeight: "500" },
  introText: {
    flex: 1,
    color: "#979799",
    fontSize: 11,
    lineHeight: 16,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  priceWrap: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  price: {
    color: "#FE1F4C",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
  },
  diamond: { width: 15, height: 15, marginBottom: 3 },
  salesWrap: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 },
  salesLabel: { color: "#979799", fontSize: 12, lineHeight: 18 },
  salesValue: { color: "#7F7F80", fontSize: 12, lineHeight: 18 },
});
