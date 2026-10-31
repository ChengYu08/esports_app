import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { useVoicePlayer } from "@/shared/audio/use-voice-player";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { CompanionCard } from "@/shared/ui/CompanionCard";

const allGamesIcon = require("../../../../assets/mine/figma/god-all-games.svg");
const arrowDownIcon = require("../../../../assets/home/club-detail/arrow-fill-down.svg");
const arrowUpDownIcon = require("../../../../assets/home/club-detail/arrow-fill-up-down.svg");

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

/** 标签兜底配色：后台未下发移动端背景色时使用（对齐设计稿 Tag/陪玩 组件色板 node 1126-176457） */
function levelTagColor(tagName: string) {
  // 注意顺序：魔王pro 要先于 魔王 判断
  if (tagName.includes("魔王pro")) return "#BB3EFA";
  if (tagName.includes("颜值")) return "#3DA5FF";
  if (tagName.includes("人气")) return "#13AEBD";
  if (tagName.includes("大神")) return "#8BAD23";
  if (tagName.includes("魔王")) return "#FF42A1";
  if (tagName.includes("顶尖")) return "#FE4267";
  if (tagName.includes("明星")) return "#7D47FC";
  if (tagName.includes("金")) return "#D19643";
  if (tagName.includes("娱乐")) return "#477BFE";
  return "#C0C4CC";
}

/**
 * 大神列表卡片中间层：隔离屏幕级 state（筛选、语音播放状态）变化，
 * 让 CompanionCard 的 memo 命中，仅重渲染播放状态实际变化的卡片。
 */
const GodCard = memo(function GodCard({
  item,
  gameIconUrl,
  playingUrl,
  onToggleVoice,
  onItemPress,
}: {
  item: GodListItem;
  gameIconUrl: string | undefined;
  playingUrl: string | null;
  onToggleVoice: (voiceUrl: string) => void;
  onItemPress: (item: GodListItem) => void;
}) {
  return (
    <CompanionCard
      nickname={item.nickname}
      avatar={item.avatar}
      sex={item.sex}
      age={item.age}
      introTagText={item.tagName}
      introTagColor={item.tagColor || levelTagColor(item.tagName)}
      gameName={item.gameName}
      gameIconUrl={gameIconUrl}
      modeName={item.modeName}
      levelName={item.levelName}
      serviceName={item.serviceName}
      signature={item.signature}
      onlineStatus={item.onlineStatus}
      gameStatus={item.gameStatus}
      price={item.price}
      orderCount={item.orderCount}
      voiceUrl={item.voiceUrl}
      voiceDurationSeconds={item.voiceDurationSeconds}
      voicePlayingUrl={playingUrl}
      onToggleVoice={onToggleVoice}
      onPress={() => onItemPress(item)}
    />
  );
});

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

  const handleItemPress = useCallback(
    (item: GodListItem) => {
      router.push({
        pathname: "/profile",
        params: {
          clubId: String(item.clubId),
          userId: String(item.userId),
          ...(item.gameName
            ? { gameId: gameKey === ALL_GAME_KEY ? "" : gameKey }
            : {}),
        },
      });
    },
    [gameKey],
  );

  const renderCard = useCallback(
    ({ item }: { item: GodListItem }) => (
      <GodCard
        item={item}
        gameIconUrl={gameIconByName.get(item.gameName)}
        playingUrl={voicePlayer.playingUrl}
        onToggleVoice={voicePlayer.toggle}
        onItemPress={handleItemPress}
      />
    ),
    [
      gameIconByName,
      handleItemPress,
      voicePlayer.playingUrl,
      voicePlayer.toggle,
    ],
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
          windowSize={7}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          initialNumToRender={6}
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
});
